# S3 EnvOps — 项目实现文档

## 项目概述

Web 端 S3 存储环境运维管理平台，支持一键解析环境信息文本、多环境管理、S3 存储运维操作、节点 Xshell 连接、快捷命令管理和操作日志。

- **技术栈**: React 19 + TypeScript (strict) + Vite 8 + Ant Design 6 + AWS S3 SDK v3
- **架构**: 纯前端 SPA，无后端。S3 操作通过 AWS SDK v3 浏览器直连，数据持久化使用 localStorage。
- **开发代理**: Vite dev server 内置 S3 CORS 代理中间件，开发模式下自动绕过浏览器 CORS 限制。
- **构建**: `tsc -b` 零错误，`vite build` 正常通过

---

## 目录结构

```
src/
├── types/
│   └── index.ts              # 全局 TypeScript 类型定义
├── utils/
│   ├── storage.ts            # localStorage CRUD 封装
│   ├── parser.ts             # 环境信息文本解析器（高容错）
│   └── s3Proxy.ts            # 开发模式 fetch 拦截，自动代理跨域 S3 请求
├── store/
│   └── logStore.tsx           # 全局日志状态管理（React Context）
├── components/
│   ├── AppLayout.tsx          # 主布局：Header + 左侧边栏 + 右内容 + 日志面板
│   ├── LogPanel.tsx           # 底部可折叠日志面板（flex 布局，非 fixed）
│   ├── EnvParser.tsx          # 环境信息粘贴→解析→预览→保存
│   ├── EnvInfoPanel.tsx       # 环境详情展示（含编辑按钮 + EnvEditModal）
│   ├── EnvEditModal.tsx       # 环境信息编辑 Modal（Form + Form.List 动态节点）
│   ├── NodeList.tsx           # 节点表格（IP复制/Xshell/快捷命令）
│   ├── ObjectManager.tsx      # S3 对象管理（上传/下载/删除）
│   ├── CommandManager.tsx     # 快捷命令模板 CRUD + 命令预览（环境/节点选择器）
│   └── UploadConfig.tsx       # 上传下载路径配置
├── App.tsx                    # 根组件（LogProvider 包裹）
├── main.tsx                   # 入口（ConfigProvider 中文 locale + S3 代理初始化）
├── App.css                    # 布局样式（最小化）
└── index.css                  # 全局 CSS reset
```

---

## 类型定义 (`src/types/index.ts`)

```typescript
// 节点信息
interface NodeInfo {
  name: string;        // 节点名称，如 "FSM", "FSA_0"
  internalIp: string;  // 内网 IP
  externalIp: string;  // 外网 IP
  credentials: string; // 登录凭证，如 "root/Emulat"
}

// S3 配置
interface S3Config {
  endpoint: string;    // S3 Endpoint URL
  ak: string;          // Access Key
  sk: string;          // Secret Key
}

// 环境信息
interface Environment {
  id: string;                // UUID
  name: string;              // 环境名称
  model: string;             // 型号
  cpuArch: string;           // CPU 架构
  diskInfo: string;          // 盘信息
  managementUrl: string;     // 管理界面 URL
  managementAccount: string; // 管理界面账号
  managementPassword: string;// 管理界面密码
  nodes: NodeInfo[];         // 节点列表
  s3Config: S3Config;        // S3 配置
  createdAt: number;         // 创建时间戳
}

// 命令模板
interface CommandTemplate {
  id: string;
  name: string;
  content: string;      // 支持变量: {internalIp}, {externalIp}, {credentials}, {nodeName}
  createdAt: number;
}

// 日志
type LogStatus = 'success' | 'error' | 'info' | 'warning';
interface LogEntry {
  id: string;
  timestamp: number;
  action: string;       // 操作描述
  status: LogStatus;
  detail: string;       // 详细信息
}

// 路径配置
interface PathConfig { uploadPath: string; downloadPath: string; }
interface BucketPathConfig { [bucketName: string]: PathConfig; }
interface GlobalConfig {
  defaultPathConfig: PathConfig;
  bucketPathConfigs: BucketPathConfig;
}
```

---

## 模块详细说明

### 1. 环境信息解析与序列化 (`src/utils/parser.ts`)

**核心函数**:
- `parseEnvironment(text: string): Environment | null` — 解析
- `serializeEnvironment(env: Environment): string` — 序列化（新增）

**解析策略**（高容错）：
- 使用正则表达式逐行匹配，不依赖严格行号
- `extractField(text, pattern)` — 通用字段提取
- 节点解析: 匹配 `名称 内网IP 外网IP 凭证` 格式的行，校验 IP 格式和凭证格式
- S3 配置: 在 `S3配置:` 标记后的文本中匹配 `Endpoint:`, `AK:`, `SK:`
- 支持中英文冒号 (`:` / `：`)
- 无效行自动跳过，缺失字段默认空字符串
- 全部解析失败返回 `null`

**序列化** (`serializeEnvironment`)：
- 将结构化 `Environment` 对象还原为原始文本格式
- 输出格式与解析器期望的输入格式一致（中文冒号分隔）
- 用途：环境编辑时将现有数据填充到文本编辑器

### 2. 数据持久化 (`src/utils/storage.ts`)

localStorage 键名:
- `s3env_environments` — 环境列表 (JSON)
- `s3env_commands` — 命令模板列表 (JSON)
- `s3env_global_config` — 全局配置 (JSON)

所有函数带 try/catch，读取失败返回空数组/默认值。
`saveEnvironment()` 支持幂等写入（按 id 匹配，存在则更新，不存在则新增）。

### 3. S3 CORS 代理 (`src/utils/s3Proxy.ts`)

**函数**: `setupS3CorsProxy()`

开发模式下（`import.meta.env.DEV`）拦截 `window.fetch`，将跨域 S3 请求透明转发到 Vite 中间件：
- 判断条件：URL 以 `http` 开头且不包含当前页面 host
- 重写 URL 为 `/s3-cors-proxy?url=<encoded>`，保留原始 method/headers/body
- 在 `main.tsx` 中最早调用，确保所有 S3Client 创建前生效
- **生产模式不生效**，需要 S3 服务端配置 CORS

### 4. 日志系统 (`src/store/logStore.tsx`)

基于 React Context 的全局日志管理：
- `LogProvider` — 包裹在 App 根组件
- `useLogStore()` — 返回 `{ logs, addLog, clearLogs }`
- 最多保留 200 条日志，按时间倒序排列
- 所有 S3 操作自动调用 `addLog()` 记录成功/失败

### 5. 主布局 (`src/components/AppLayout.tsx`)

```
+--------------------------------------------------+
| Header: "S3 EnvOps - S3 环境运维平台"              |
+----------+---------------------------------------+
| 左侧栏   | 右侧主内容区                            |
| (Splitter)|                                      |
| +-------+ |  envInfo → EnvInfoPanel              |
| |添加环境| |  bucketObjects → ObjectManager       |
| +-------+ |  commands → CommandManager           |
| | 环境1 🔄| |  empty → 空状态                       |
| |  ├ 桶A | |                                      |
| |  └ 桶B | |                                      |
| | 环境2 🔄| |                                      |
| |  ├ 桶C | |                                      |
| +-------+ |                                      |
| |快捷命令| |                                      |
| +-------+ |                                      |
+----------+---------------------------------------+
| LogPanel (flex 子元素，可折叠/展开)                  |
+--------------------------------------------------+
```

**左侧环境项按钮**: 每个环境名称右侧显示 `+`（创建桶）和 `↻`（刷新桶列表）图标按钮，`onClick` 时 `stopPropagation` 防止误触菜单展开/选中。

**关键状态**:
- `environments` — 从 localStorage 加载，增删改时刷新
- `commands` — 从 localStorage 加载
- `openEnvKeys` — 左侧栏展开的环境项
- `selectedKey` — 当前选中的菜单项
- `envBucketMap` — 每个环境的桶列表缓存
- `bucketLoadingMap` — 每个环境的桶加载状态
- `rightView` — 右面板视图（discriminated union: empty | envInfo | bucketObjects | commands）
- `clientCache` — S3Client 实例缓存（useRef）

**菜单 key 格式**:
- 环境：`env-{envId}`
- 桶：`bucket::{envId}::{bucketName}`（用 `::` 分隔避免 UUID 中的 `-` 冲突）
- 命令：`commands`

**S3Client 创建逻辑**:
```typescript
// 自动从 endpoint 提取 region
const awsRegionMatch = endpoint.match(/\.([a-z]+-[a-z]+-\d+)\.amazonaws\.com/);
const region = awsRegionMatch ? awsRegionMatch[1] : 'us-east-1';
const isAws = endpoint.includes('.amazonaws.com');
// AWS S3 用 virtual-hosted style，自定义 S3 用 path style
new S3Client({ region, endpoint, credentials, forcePathStyle: !isAws });
```

**环境编辑回调** (`handleEnvUpdate`):
- 调用 `saveEnvironment()` 更新 localStorage
- 检测 S3 配置变化 → 清除缓存的 S3Client + 清空桶列表缓存
- 记录日志 + message 提示

### 6. 环境详情 (`src/components/EnvInfoPanel.tsx`)

Props: `{ env: Environment; onDelete: (id: string) => void; commands: CommandTemplate[]; onSave: (env: Environment) => void }`

展示内容:
- 标题行: 环境名称 + 型号/架构/节点数 + **编辑按钮** + 删除按钮
- Collapse 折叠面板:
  - 基本信息: Descriptions 展示型号/CPU/盘/管理界面/账号密码/S3配置
  - 节点列表: 嵌入 `NodeList` 组件
- 点击"编辑" → 打开 `EnvEditModal`

### 7. 环境编辑 (`src/components/EnvEditModal.tsx`)

Props: `{ open: boolean; env: Environment; onSave: (env: Environment) => void; onCancel: () => void }`

文本编辑模式（非表单）：
- 打开时调用 `serializeEnvironment(env)` 将结构化数据还原为原始文本格式
- Modal 内显示 TextArea（等宽字体，15行），用户直接编辑文本
- 点击"解析" → 调用 `parseEnvironment(text)` → 显示 Descriptions 预览（环境名称/型号/节点数/S3配置等）
- 点击"确认保存" → 保留原始 `id` 和 `createdAt`，覆盖其余字段 → 回调 `onSave`
- 与 `EnvParser`（添加环境）使用相同的解析器，编辑体验一致

### 8. 环境解析 UI (`src/components/EnvParser.tsx`)

Props: `{ open: boolean; onClose: () => void; onSaved: (env: Environment) => void }`

流程:
1. Modal 打开，显示 TextArea (15行，等宽字体)
2. 用户粘贴环境信息文本
3. 点击"解析" → 调用 `parseEnvironment()` → 显示 `Descriptions` 预览
4. 预览包含：环境名称、型号、CPU架构、盘信息、管理界面、节点数量、S3 配置
5. 点击"确认添加" → `saveEnvironment()` → 回调 `onSaved` → 关闭 Modal

### 9. 节点列表 (`src/components/NodeList.tsx`)

Props: `{ nodes: NodeInfo[]; commands: CommandTemplate[] }`

表格列:
- 节点名称
- 内网 IP — `Typography.Text` 可复制
- 外网 IP — `Typography.Text` 可复制
- 凭证 — 默认掩码 `••••••••`，点击"显示/隐藏"切换
- 操作:
  - **Xshell 连接**: 解析 `root/password` → 打开 `ssh://username:password@externalIp`
  - **快捷命令**: Dropdown 列出所有命令模板，选中后替换变量并复制到剪贴板

变量替换规则:
```
{internalIp}  → node.internalIp
{externalIp}  → node.externalIp
{credentials} → node.credentials
{nodeName}    → node.name
```

### 10. 对象管理 (`src/components/ObjectManager.tsx`)

Props: `{ client: S3Client; bucketName: string; onBack: () => void }`

功能:
- **浏览**: `ListObjectsV2Command` + Delimiter='/' 实现文件夹导航
  - 面包屑导航，CommonPrefixes 显示为文件夹，Contents 显示为文件
- **上传**:
  - 普通上传: `PutObjectCommand`
  - 多段上传: `@aws-sdk/lib-storage` Upload 类，可配置分段大小（默认 8MB）
  - 上传进度条 `Progress` 组件
- **下载**:
  - 优先使用 File System Access API (`showSaveFilePicker`) 让用户选择保存路径
  - 不支持时回退标准 Blob URL 下载
- **删除**: `Popconfirm` → `DeleteObjectCommand`
- 所有操作均有 loading 状态、try/catch + `addLog()`

### 11. 快捷命令管理 (`src/components/CommandManager.tsx`)

直接使用 storage 和 logStore，无外部 Props。

功能:
- 命令模板 Table（名称 + 内容预览 + 操作：复制/编辑/删除）
- 新增/编辑 Modal：名称 Input + 内容 TextArea
- **命令预览** Card:
  - 三级联动 Select: 环境 → 节点 → 命令模板
  - 选择后实时显示变量替换后的命令文本
  - 一键复制到剪贴板
- 变量参考表: `{internalIp}`, `{externalIp}`, `{credentials}`, `{nodeName}` 含说明和复制按钮

### 12. 日志面板 (`src/components/LogPanel.tsx`)

无 Props，使用 `useLogStore()` hook。

- 作为 Layout 的 flex 子元素（不再用 `position: fixed`）
- 默认折叠（约 40px），显示日志条数 + "展开日志"按钮
- 有新日志时自动展开
- 展开后最大高度 30vh，内部滚动
- 每条日志: 时间戳 + 操作名 + 状态 Tag + 详情
- 颜色: success=绿, error=红, info=蓝, warning=橙
- "清除日志"按钮 + "收起"按钮

### 13. 上传下载配置 (`src/components/UploadConfig.tsx`)

无 Props，直接使用 storage 和 logStore。

功能:
- 默认路径配置: 上传路径 + 下载路径 Input，保存到 GlobalConfig
- 按桶覆盖配置: Table 显示桶名 + 路径，支持新增/编辑/删除
- Modal 表单: 桶名称 + 上传路径 + 下载路径

---

## 组件依赖关系

```
App (LogProvider)
└── AppLayout
    ├── Splitter 左侧栏
    │   └── Menu (环境→桶 树形 + 快捷命令)
    ├── Splitter 右侧面板
    │   ├── envInfo → EnvInfoPanel
    │   │           ├── EnvEditModal (编辑)
    │   │           └── NodeList (节点表)
    │   ├── bucketObjects → ObjectManager
    │   ├── commands → CommandManager
    │   └── empty → Empty
    ├── EnvParser (Modal)
    ├── 创建桶 Modal
    └── LogPanel (flex 子元素)
```

---

## Vite 开发代理 (`vite.config.ts`)

S3 CORS 代理中间件，在 `configureServer` 中注册：

```
浏览器 fetch → /s3-cors-proxy?url=<encoded S3 URL>
  → Vite 中间件接收
    → 过滤 accept-encoding 头（阻止 S3 返回压缩响应）
    → 转发请求（保留签名头，过滤 host/origin）
      → S3 响应 → 过滤 content-encoding/content-length + 附加 CORS 允许头 → 返回浏览器
```

**请求头过滤**: `host`, `connection`, `origin`, `referer`, `accept-encoding`
- `accept-encoding` 过滤是下载功能的关键修复：防止浏览器自动追加的 `Accept-Encoding: gzip` 被
  转发给 S3，导致 Node.js fetch 自动解压后 body 与 content-length 不匹配（[undici#2514](https://github.com/nodejs/undici/issues/2514)）

**响应头过滤**: `transfer-encoding`, `content-encoding`, `content-length`
- 兜底安全措施：即使 S3 因其他原因返回压缩响应，也不会转发矛盾的头给浏览器

---

## localStorage 数据结构

```json
// s3env_environments
[
  {
    "id": "uuid",
    "name": "单FSM_modngoyp",
    "model": "pacific",
    "cpuArch": "arm",
    "diskInfo": "SATA_SSD: 960GB",
    "managementUrl": "https://7.197.106.190:8088",
    "managementAccount": "admin",
    "managementPassword": "Admi",
    "nodes": [
      { "name": "FSM", "internalIp": "192.168.22.45", "externalIp": "7.197.106.000", "credentials": "root/Emulat" }
    ],
    "s3Config": { "endpoint": "http://7.243.69.151:5080", "ak": "7D440DC8B4040A6D2B65", "sk": "dEOYg8t8srGoHebDtclhSzCp" },
    "createdAt": 1714886400000
  }
]

// s3env_commands
[
  { "id": "uuid", "name": "查看磁盘", "content": "ssh {internalIp} df -h", "createdAt": 1714886400000 }
]

// s3env_global_config
{
  "defaultPathConfig": { "uploadPath": "C:\\uploads", "downloadPath": "C:\\downloads" },
  "bucketPathConfigs": { "my-bucket": { "uploadPath": "/data", "downloadPath": "/tmp" } }
}
```

---

## S3 SDK 使用说明

```typescript
// 创建客户端 — 自动检测 AWS/自定义 S3
import { S3Client } from '@aws-sdk/client-s3';
const endpoint = env.s3Config.endpoint.replace(/\/+$/, '');
const awsRegionMatch = endpoint.match(/\.([a-z]+-[a-z]+-\d+)\.amazonaws\.com/);
const region = awsRegionMatch ? awsRegionMatch[1] : 'us-east-1';
const isAws = endpoint.includes('.amazonaws.com');
const client = new S3Client({
  region,
  endpoint,
  credentials: { accessKeyId: env.s3Config.ak, secretAccessKey: env.s3Config.sk },
  forcePathStyle: !isAws,  // AWS S3 用 virtual-hosted style，自定义 S3 用 path style
});

// 桶操作
import { ListBucketsCommand, CreateBucketCommand, DeleteBucketCommand } from '@aws-sdk/client-s3';

// 对象操作
import { ListObjectsV2Command, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// 多段上传
import { Upload } from '@aws-sdk/lib-storage';
const upload = new Upload({
  client,
  params: { Bucket, Key, Body: file },
  partSize: 8 * 1024 * 1024, // 8MB
});
upload.on('httpUploadProgress', (progress) => { /* 更新进度 */ });
await upload.done();
```

---

## 开发命令

```bash
npm run dev      # 启动开发服务器（含 S3 CORS 代理）
npm run build    # TypeScript 编译 + Vite 生产构建
npm run lint     # ESLint 检查
npm run preview  # 预览生产构建
```

---

## 已知限制

1. **生产环境 CORS**: 开发模式下通过 Vite 代理绕过。生产环境需要 S3 服务端配置 CORS（适用于 MinIO 等自建服务），或部署反向代理
2. **File System Access API**: 仅 Chromium 浏览器支持 `showSaveFilePicker`，其他浏览器回退为标准下载
3. **Xshell**: 依赖本地安装 Xshell 客户端并注册 `ssh://` 协议处理器
4. **localStorage**: 数据仅存于当前浏览器，清除浏览器数据会丢失
5. **日志**: 刷新页面后日志清空（仅保留在内存中，最多 200 条）
