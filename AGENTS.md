# S3 EnvOps — 项目实现文档

## 项目概述

Web 端 S3 存储环境运维管理平台，支持一键解析环境信息文本、多环境管理、S3 存储运维操作、节点 Xshell 连接、快捷命令管理和操作日志。

- **技术栈**: React 19 + TypeScript (strict) + Vite 8 + Ant Design 6 + AWS S3 SDK v3
- **架构**: 纯前端 SPA，无后端。S3 操作通过 AWS SDK v3 浏览器直连，数据持久化使用 localStorage。
- **构建**: `tsc -b` 零错误，`vite build` 正常通过

---

## 目录结构

```
src/
├── types/
│   └── index.ts              # 全局 TypeScript 类型定义
├── utils/
│   ├── storage.ts            # localStorage CRUD 封装
│   └── parser.ts             # 环境信息文本解析器（高容错）
├── store/
│   └── logStore.tsx           # 全局日志状态管理（React Context）
├── components/
│   ├── AppLayout.tsx          # 主布局：Header + Tabs + 日志面板
│   ├── LogPanel.tsx           # 底部可折叠日志面板
│   ├── EnvParser.tsx          # 环境信息粘贴→解析→预览→保存
│   ├── EnvCard.tsx            # 单环境信息卡片展示
│   ├── NodeList.tsx           # 节点表格（IP复制/Xshell/快捷命令）
│   ├── BucketManager.tsx      # S3 桶 CRUD 管理
│   ├── ObjectManager.tsx      # S3 对象管理（上传/下载/删除）
│   ├── UploadConfig.tsx       # 上传下载路径配置
│   └── CommandManager.tsx     # 快捷命令模板 CRUD
├── App.tsx                    # 根组件（LogProvider 包裹）
├── main.tsx                   # 入口（ConfigProvider 中文 locale）
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

### 1. 环境信息解析 (`src/utils/parser.ts`)

**核心函数**: `parseEnvironment(text: string): Environment | null`

解析策略（高容错）：
- 使用正则表达式逐行匹配，不依赖严格行号
- `extractField(text, pattern)` — 通用字段提取
- 节点解析: 匹配 `名称 内网IP 外网IP 凭证` 格式的行，校验 IP 格式和凭证格式
- S3 配置: 在 `S3配置:` 标记后的文本中匹配 `Endpoint:`, `AK:`, `SK:`
- 支持中英文冒号 (`:` / `：`)
- 无效行自动跳过，缺失字段默认空字符串
- 全部解析失败返回 `null`

**输入格式示例**:
```
--------单FSM_modngoyp环境信息--------
 环境名称:单FSM_modngoyp
 型号:pacific
 CPU架构:arm
 盘:SATA_SSD: 960GB
 管理界面:https://7.197.106.190:8088
 账号:admin
 密码:Admi
 节点:
   FSM 192.168.22.45 7.197.106.000 root/Emulat
   FSA_0 192.168.13.8 7.241.133.00 root/Emulati
 S3配置:
   Endpoint: http://7.243.69.151:5080
   AK: 7D440DC8B4040A6D2B65
   SK: dEOYg8t8srGoHebDtclhSzCp
```

### 2. 数据持久化 (`src/utils/storage.ts`)

localStorage 键名:
- `s3env_environments` — 环境列表 (JSON)
- `s3env_commands` — 命令模板列表 (JSON)
- `s3env_global_config` — 全局配置 (JSON)

所有函数带 try/catch，读取失败返回空数组/默认值。

### 3. 日志系统 (`src/store/logStore.tsx`)

基于 React Context 的全局日志管理：
- `LogProvider` — 包裹在 App 根组件
- `useLogStore()` — 返回 `{ logs, addLog, clearLogs }`
- 最多保留 200 条日志，按时间倒序排列
- 所有 S3 操作自动调用 `addLog()` 记录成功/失败

### 4. 主布局 (`src/components/AppLayout.tsx`)

```
+--------------------------------------------------+
| Header: "S3 EnvOps - S3 环境运维平台"              |
+--------------------------------------------------+
| Tabs: 环境管理 | S3运维 | 快捷命令                  |
|   - Tab 1: 添加环境按钮 + EnvCard 列表             |
|   - Tab 2: BucketManager                          |
|   - Tab 3: CommandManager                         |
+--------------------------------------------------+
| Footer: LogPanel (200px, 固定底部)                 |
+--------------------------------------------------+
```

状态管理:
- `environments` — 从 localStorage 加载，增删时刷新
- `commands` — 从 localStorage 加载
- `parserOpen` — 控制 EnvParser Modal 开关

### 5. 环境解析 UI (`src/components/EnvParser.tsx`)

Props: `{ open: boolean; onClose: () => void; onSaved: (env: Environment) => void }`

流程:
1. Modal 打开，显示 TextArea (15行，等宽字体)
2. 用户粘贴环境信息文本
3. 点击"解析" → 调用 `parseEnvironment()` → 显示 `Descriptions` 预览
4. 预览包含：环境名称、型号、CPU架构、盘信息、管理界面、节点数量、S3 配置
5. 点击"确认添加" → `saveEnvironment()` → 回调 `onSaved` → 关闭 Modal

### 6. 环境卡片 (`src/components/EnvCard.tsx`)

Props: `{ env: Environment; onDelete: (id: string) => void; commands: CommandTemplate[] }`

展示内容:
- Card 标题: 环境名称 + 节点数量 Tag
- 基本信息 Descriptions: 型号、CPU架构、盘信息
- 管理界面: 可点击 URL 链接 + 账号/密码（密码掩码，可复制）
- S3 配置: Endpoint + AK/SK（掩码，可复制）
- 节点列表: 嵌入 `NodeList` 组件
- 删除按钮: `Popconfirm` 确认后删除

### 7. 节点列表 (`src/components/NodeList.tsx`)

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

### 8. 桶管理 (`src/components/BucketManager.tsx`)

Props: `{ environments: Environment[] }`

功能:
- 顶部 `Select` 选择环境 → 创建 S3Client:
  ```typescript
  new S3Client({
    region: 'us-east-1',
    endpoint: env.s3Config.endpoint,
    credentials: { accessKeyId: env.s3Config.ak, secretAccessKey: env.s3Config.sk },
    forcePathStyle: true,
  })
  ```
- 创建桶: Modal 输入桶名 → `CreateBucketCommand`
- 刷新: `ListBucketsCommand` → Table 展示桶名 + 创建时间
- 删除: `Popconfirm` → `DeleteBucketCommand`
- 点击桶行: 切换到 `ObjectManager` 视图

### 9. 对象管理 (`src/components/ObjectManager.tsx`)

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
  - 支持下载不存在的对象（try/catch 捕获 S3 错误并记录日志）
- **删除**: `Popconfirm` → `DeleteObjectCommand`
- 所有操作均有 loading 状态、try/catch + `addLog()`

### 10. 快捷命令管理 (`src/components/CommandManager.tsx`)

无 Props，直接使用 storage 和 logStore。

功能:
- 命令模板 Table（名称 + 内容预览 + 操作）
- 新增/编辑 Modal：名称 Input + 内容 TextArea
- 删除: `Popconfirm` 确认
- 变量参考表: `{internalIp}`, `{externalIp}`, `{credentials}`, `{nodeName}` 含说明和复制按钮
- 命令列表从 localStorage 读取，NodeList 组件也读取同一数据源

### 11. 上传下载配置 (`src/components/UploadConfig.tsx`)

无 Props，直接使用 storage 和 logStore。

功能:
- 默认路径配置: 上传路径 + 下载路径 Input，保存到 GlobalConfig
- 按桶覆盖配置: Table 显示桶名 + 路径，支持新增/编辑/删除
- Modal 表单: 桶名称 + 上传路径 + 下载路径

### 12. 日志面板 (`src/components/LogPanel.tsx`)

无 Props，使用 `useLogStore()` hook。

- 固定在页面底部 (`position: fixed`)
- 默认折叠，显示日志条数 + "展开日志"按钮
- 有新日志时自动展开
- 展开后显示日志列表（倒序），最大高度 40vh
- 每条日志: 时间戳 + 操作名 + 状态 Tag + 详情
- 颜色: success=绿, error=红, info=蓝, warning=橙
- "清除日志"按钮 + "收起"按钮

---

## 组件依赖关系

```
App (LogProvider)
└── AppLayout
    ├── Tabs[1]: 环境管理
    │   ├── EnvParser (Modal)
    │   └── EnvCard[]
    │       └── NodeList
    ├── Tabs[2]: S3运维
    │   └── BucketManager
    │       └── ObjectManager
    ├── Tabs[3]: 快捷命令
    │   └── CommandManager
    └── Footer: LogPanel
```

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
// 创建客户端（forcePathStyle 适配非 AWS S3 服务）
import { S3Client } from '@aws-sdk/client-s3';
const client = new S3Client({
  region: 'us-east-1',
  endpoint: env.s3Config.endpoint,
  credentials: { accessKeyId: env.s3Config.ak, secretAccessKey: env.s3Config.sk },
  forcePathStyle: true,
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
npm run dev      # 启动开发服务器
npm run build    # TypeScript 编译 + Vite 生产构建
npm run lint     # ESLint 检查
npm run preview  # 预览生产构建
```

---

## 已知限制

1. **CORS**: S3 Endpoint 需要配置 CORS 允许浏览器直接访问
2. **File System Access API**: 仅 Chromium 浏览器支持 `showSaveFilePicker`，其他浏览器回退为标准下载
3. **Xshell**: 依赖本地安装 Xshell 客户端并注册 `ssh://` 协议处理器
4. **localStorage**: 数据仅存于当前浏览器，清除浏览器数据会丢失
5. **日志**: 刷新页面后日志清空（仅保留在内存中，最多 200 条）
