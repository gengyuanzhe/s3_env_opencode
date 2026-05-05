import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Layout, Splitter, Menu, Button, Empty, Space, Modal, Input, Spin, message } from 'antd';
import {
  PlusOutlined,
  CloudServerOutlined,
  ThunderboltOutlined,
  DesktopOutlined,
  DatabaseOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { S3Client, ListBucketsCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import type { MenuProps } from 'antd';
import type { Environment, CommandTemplate } from '../types';
import { getEnvironments, getCommands, deleteEnvironment, saveEnvironment } from '../utils/storage';
import { useLogStore } from '../store/logStore';
import LogPanel from './LogPanel';
import EnvParser from './EnvParser';
import EnvInfoPanel from './EnvInfoPanel';
import ObjectManager from './ObjectManager';
import CommandManager from './CommandManager';

const { Header, Content } = Layout;

interface BucketInfo {
  name: string;
  creationDate?: Date;
}

type RightView =
  | { type: 'empty' }
  | { type: 'envInfo'; envId: string }
  | { type: 'bucketObjects'; envId: string; bucketName: string }
  | { type: 'commands' };

function AppLayout() {
  const { addLog } = useLogStore();
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [commands, setCommands] = useState<CommandTemplate[]>([]);
  const [parserOpen, setParserOpen] = useState(false);

  // Left panel state
  const [openEnvKeys, setOpenEnvKeys] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [envBucketMap, setEnvBucketMap] = useState<Record<string, BucketInfo[]>>({});
  const [bucketLoadingMap, setBucketLoadingMap] = useState<Record<string, boolean>>({});

  // Right panel state
  const [rightView, setRightView] = useState<RightView>({ type: 'empty' });

  // Create bucket modal
  const [createBucketModalOpen, setCreateBucketModalOpen] = useState(false);
  const [newBucketEnvId, setNewBucketEnvId] = useState<string | null>(null);
  const [newBucketName, setNewBucketName] = useState('');

  // S3Client cache
  const clientCache = useRef<Record<string, S3Client>>({});

  useEffect(() => {
    setEnvironments(getEnvironments());
    setCommands(getCommands());
  }, []);

  // Refresh commands when switching to commands view
  useEffect(() => {
    if (rightView.type === 'commands') {
      setCommands(getCommands());
    }
  }, [rightView.type]);

  const getS3Client = useCallback((env: Environment): S3Client => {
    if (!clientCache.current[env.id]) {
      const endpoint = env.s3Config.endpoint.replace(/\/+$/, '');
      // 自动从 AWS endpoint 提取 region，如 s3.ap-northeast-2.amazonaws.com → ap-northeast-2
      const awsRegionMatch = endpoint.match(/\.([a-z]+-[a-z]+-\d+)\.amazonaws\.com/);
      const region = awsRegionMatch ? awsRegionMatch[1] : 'us-east-1';
      const isAws = endpoint.includes('.amazonaws.com');
      clientCache.current[env.id] = new S3Client({
        region,
        endpoint,
        credentials: { accessKeyId: env.s3Config.ak, secretAccessKey: env.s3Config.sk },
        forcePathStyle: !isAws,
      });
    }
    return clientCache.current[env.id];
  }, []);

  const loadBucketsForEnv = useCallback(async (envId: string) => {
    const env = environments.find(e => e.id === envId);
    if (!env) return;
    setBucketLoadingMap(prev => ({ ...prev, [envId]: true }));
    try {
      const client = getS3Client(env);
      const response = await client.send(new ListBucketsCommand({}));
      const buckets: BucketInfo[] = (response.Buckets || []).map(b => ({
        name: b.Name || '',
        creationDate: b.CreationDate,
      }));
      setEnvBucketMap(prev => ({ ...prev, [envId]: buckets }));
      addLog('列出桶', 'success', `环境 ${env.name} 成功获取 ${buckets.length} 个桶`);
      message.success(`已刷新，共 ${buckets.length} 个桶`);
    } catch (err) {
      const error = err as Error;
      addLog('列出桶', 'error', `环境 ${env.name} 列出桶失败: ${error.message}`);
      message.error(`列出桶失败: ${error.message}`);
    } finally {
      setBucketLoadingMap(prev => ({ ...prev, [envId]: false }));
    }
  }, [environments, getS3Client, addLog]);

  const handleSaved = (_env: Environment) => {
    setEnvironments(getEnvironments());
    setParserOpen(false);
  };

  const handleEnvUpdate = useCallback((updatedEnv: Environment) => {
    const oldEnv = environments.find(e => e.id === updatedEnv.id);
    const s3Changed = oldEnv && (
      oldEnv.s3Config.endpoint !== updatedEnv.s3Config.endpoint ||
      oldEnv.s3Config.ak !== updatedEnv.s3Config.ak ||
      oldEnv.s3Config.sk !== updatedEnv.s3Config.sk
    );

    saveEnvironment(updatedEnv);
    setEnvironments(getEnvironments());

    if (s3Changed) {
      delete clientCache.current[updatedEnv.id];
      setEnvBucketMap(prev => {
        const next = { ...prev };
        delete next[updatedEnv.id];
        return next;
      });
    }

    addLog('编辑环境', 'success', `环境 "${updatedEnv.name}" 已更新`);
    message.success('保存成功');
  }, [environments, addLog]);

  const handleDelete = (id: string) => {
    deleteEnvironment(id);
    delete clientCache.current[id];
    setEnvironments(getEnvironments());
    setEnvBucketMap(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (rightView.type === 'envInfo' && rightView.envId === id) {
      setRightView({ type: 'empty' });
    }
    if (rightView.type === 'bucketObjects' && rightView.envId === id) {
      setRightView({ type: 'empty' });
    }
    setSelectedKey(null);
  };

  // Menu open/close — lazy load buckets
  const handleOpenChange = useCallback((keys: string[]) => {
    const prevKeys = openEnvKeys;
    setOpenEnvKeys(keys);
    // Newly opened env — load its buckets
    const newKey = keys.find(k => !prevKeys.includes(k));
    if (newKey && newKey.startsWith('env-')) {
      loadBucketsForEnv(newKey.slice(4));
    }
  }, [openEnvKeys, loadBucketsForEnv]);

  // Menu click
  const handleMenuClick: NonNullable<MenuProps['onClick']> = useCallback(({ key }) => {
    if (key === 'commands') {
      setRightView({ type: 'commands' });
      setSelectedKey(null);
      return;
    }
    if (key.startsWith('env-')) {
      const envId = key.slice(4);
      setRightView({ type: 'envInfo', envId });
      setSelectedKey(key);
    } else if (key.startsWith('bucket::')) {
      // bucket::{envId}::{bucketName} — 用 :: 分隔避免 UUID 中的 - 冲突
      const rest = key.slice(8);
      const separatorIdx = rest.indexOf('::');
      if (separatorIdx > 0) {
        const envId = rest.slice(0, separatorIdx);
        const bucketName = rest.slice(separatorIdx + 2);
        setRightView({ type: 'bucketObjects', envId, bucketName });
        setSelectedKey(key);
      }
    }
  }, []);

  // Build menu items
  const menuItems = useMemo<MenuProps['items']>(() => [
    ...environments.map(env => ({
      key: `env-${env.id}`,
      icon: <DesktopOutlined />,
      label: (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#262626', lineHeight: '20px' }}>{env.name}</div>
            <div style={{ fontSize: 11, color: '#8c8c8c', lineHeight: '16px' }}>
              {env.model} · {env.cpuArch} · {env.nodes.length} 节点
            </div>
          </div>
          <Space size={2} style={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
              title="创建桶"
              style={{ fontSize: 12, width: 22, height: 22, minWidth: 22 }}
              onClick={(e) => { e.stopPropagation(); setNewBucketEnvId(env.id); setCreateBucketModalOpen(true); }}
            />
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              title="刷新桶列表"
              style={{ fontSize: 12, width: 22, height: 22, minWidth: 22 }}
              onClick={(e) => { e.stopPropagation(); loadBucketsForEnv(env.id); }}
            />
          </Space>
        </div>
      ),
      onTitleClick: () => {
        setRightView({ type: 'envInfo', envId: env.id });
        setSelectedKey(`env-${env.id}`);
        const envKey = `env-${env.id}`;
        if (!openEnvKeys.includes(envKey)) {
          setOpenEnvKeys(prev => [...prev, envKey]);
          loadBucketsForEnv(env.id);
        }
      },
      children: bucketLoadingMap[env.id] ? [
        { key: `loading-${env.id}`, label: <Spin size="small" />, disabled: true }
      ] : (envBucketMap[env.id] || []).map(bucket => ({
        key: `bucket::${env.id}::${bucket.name}`,
        icon: <DatabaseOutlined />,
        label: bucket.name,
      })),
    })),
    { type: 'divider' as const },
    {
      key: 'commands',
      icon: <ThunderboltOutlined />,
      label: '快捷命令',
    },
  ], [environments, envBucketMap, bucketLoadingMap, openEnvKeys, loadBucketsForEnv]);

  // Right panel content
  const selectedEnv = useMemo(() => {
    if (rightView.type === 'envInfo') return environments.find(e => e.id === rightView.envId) ?? null;
    if (rightView.type === 'bucketObjects') return environments.find(e => e.id === rightView.envId) ?? null;
    return null;
  }, [rightView, environments]);

  const rightPanel = useMemo(() => {
    if (rightView.type === 'commands') {
      return <CommandManager />;
    }

    if (rightView.type === 'bucketObjects' && selectedEnv) {
      const client = getS3Client(selectedEnv);
      return (
        <ObjectManager
          client={client}
          bucketName={rightView.bucketName}
          onBack={() => setRightView({ type: 'envInfo', envId: rightView.envId })}
        />
      );
    }

    if (rightView.type === 'envInfo' && selectedEnv) {
      return (
        <div style={{ padding: 16, overflow: 'auto', height: '100%' }}>
          <EnvInfoPanel
            env={selectedEnv}
            onDelete={handleDelete}
            commands={commands}
            onSave={handleEnvUpdate}
          />

        </div>
      );
    }

    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请选择环境或桶" />
      </div>
    );
  }, [rightView, selectedEnv, commands, handleDelete, handleEnvUpdate, getS3Client, loadBucketsForEnv]);

  // Create bucket handler
  const handleCreateBucket = async () => {
    if (!newBucketEnvId || !newBucketName.trim()) return;
    const env = environments.find(e => e.id === newBucketEnvId);
    if (!env) return;
    try {
      const client = getS3Client(env);
      await client.send(new CreateBucketCommand({ Bucket: newBucketName.trim() }));
      addLog('创建桶', 'success', `成功创建桶: ${newBucketName}`);
      message.success('桶创建成功');
      setCreateBucketModalOpen(false);
      setNewBucketName('');
      await loadBucketsForEnv(newBucketEnvId);
    } catch (err) {
      const error = err as Error;
      addLog('创建桶', 'error', `失败: ${error.message}`);
      message.error(`创建桶失败: ${error.message}`);
    }
  };

  return (
    <Layout style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Header style={{ background: '#001529', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <Space>
          <CloudServerOutlined style={{ fontSize: '24px', color: '#fff' }} />
          <span style={{ color: '#fff', fontSize: '18px', fontWeight: 500 }}>S3 EnvOps - S3 环境运维平台</span>
        </Space>
      </Header>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Content style={{ flex: 1, overflow: 'hidden' }}>
          <Splitter style={{ height: '100%', boxShadow: '0 0 10px rgba(0,0,0,0.06)' }}>
            <Splitter.Panel defaultSize={300} min={240} max={420}>
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff', borderRight: '1px solid #f0f0f0' }}>
                <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid #f0f0f0' }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setParserOpen(true)} block>
                    添加环境
                  </Button>
                </div>
                <div style={{ flex: 1, overflow: 'auto' }}>
                  {environments.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: '#8c8c8c' }}>暂无环境数据</div>
                  ) : (
                    <Menu
                      mode="inline"
                      openKeys={openEnvKeys}
                      selectedKeys={selectedKey ? [selectedKey] : (rightView.type === 'commands' ? ['commands'] : [])}
                      onOpenChange={handleOpenChange}
                      onClick={handleMenuClick}
                      items={menuItems}
                      style={{ borderInlineEnd: 'none' }}
                    />
                  )}
                </div>
              </div>
            </Splitter.Panel>
            <Splitter.Panel>
              {rightPanel}
            </Splitter.Panel>
          </Splitter>
        </Content>
        <LogPanel />
      </div>
      <EnvParser open={parserOpen} onClose={() => setParserOpen(false)} onSaved={handleSaved} />
      <Modal
        title="创建桶"
        open={createBucketModalOpen}
        onOk={handleCreateBucket}
        onCancel={() => { setCreateBucketModalOpen(false); setNewBucketName(''); }}
        okText="创建"
        cancelText="取消"
      >
        <Input
          placeholder="请输入桶名称"
          value={newBucketName}
          onChange={(e) => setNewBucketName(e.target.value)}
          onPressEnter={handleCreateBucket}
        />
      </Modal>
    </Layout>
  );
}

export default AppLayout;
