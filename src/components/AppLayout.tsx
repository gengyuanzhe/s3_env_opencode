import { useState, useEffect } from 'react';
import { Layout, Tabs, Button, Empty, Space } from 'antd';
import { PlusOutlined, CloudServerOutlined, DatabaseOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { Environment, CommandTemplate } from '../types';
import { getEnvironments, getCommands, deleteEnvironment } from '../utils/storage';
import LogPanel from './LogPanel';
import EnvParser from './EnvParser';
import EnvCard from './EnvCard';
import BucketManager from './BucketManager';
import CommandManager from './CommandManager';

const { Header, Content, Footer } = Layout;

function AppLayout() {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [commands, setCommands] = useState<CommandTemplate[]>([]);
  const [parserOpen, setParserOpen] = useState(false);
  const [activeKey, setActiveKey] = useState('1');

  useEffect(() => {
    setEnvironments(getEnvironments());
    setCommands(getCommands());
  }, []);

  const handleSaved = (_env: Environment) => {
    setEnvironments(getEnvironments());
    setParserOpen(false);
  };

  const handleDelete = (id: string) => {
    deleteEnvironment(id);
    setEnvironments(getEnvironments());
  };

  const tabItems = [
    {
      key: '1',
      label: '环境管理',
      icon: <CloudServerOutlined />,
      children: (
        <div style={{ padding: '16px' }}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setParserOpen(true)}
            >
              添加环境
            </Button>
            {environments.length === 0 ? (
              <Empty description="暂无环境数据" />
            ) : (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {environments.map(env => (
                  <EnvCard
                    key={env.id}
                    env={env}
                    onDelete={handleDelete}
                    commands={commands}
                  />
                ))}
              </Space>
            )}
          </Space>
        </div>
      ),
    },
    {
      key: '2',
      label: 'S3运维',
      icon: <DatabaseOutlined />,
      children: <BucketManager environments={environments} />,
    },
    {
      key: '3',
      label: '快捷命令',
      icon: <ThunderboltOutlined />,
      children: <CommandManager />,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ 
        background: '#001529', 
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
      }}>
        <Space>
          <CloudServerOutlined style={{ fontSize: '24px', color: '#fff' }} />
          <span style={{ color: '#fff', fontSize: '18px', fontWeight: 500 }}>
            S3 EnvOps - S3 环境运维平台
          </span>
        </Space>
      </Header>
      <Content style={{ 
        padding: '24px', 
        background: '#f0f2f5',
        flex: '1 0 auto',
        overflow: 'auto',
      }}>
        <Tabs
          activeKey={activeKey}
          onChange={setActiveKey}
          items={tabItems}
          size="large"
        />
      </Content>
      <Footer style={{ 
        padding: '0',
        background: '#fff',
        borderTop: '1px solid #e8e8e8',
        height: '200px',
        overflow: 'hidden',
      }}>
        <LogPanel />
      </Footer>
      <EnvParser
        open={parserOpen}
        onClose={() => setParserOpen(false)}
        onSaved={handleSaved}
      />
    </Layout>
  );
}

export default AppLayout;