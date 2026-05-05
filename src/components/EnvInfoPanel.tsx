import { useState } from 'react';
import { Typography, Button, Collapse, Popconfirm, Descriptions, Space } from 'antd';
import { DeleteOutlined, CloudServerOutlined, EditOutlined } from '@ant-design/icons';
import type { Environment, CommandTemplate } from '../types';
import NodeList from './NodeList';
import EnvEditModal from './EnvEditModal';

const { Text, Link } = Typography;

interface EnvInfoPanelProps {
  env: Environment;
  onDelete: (id: string) => void;
  commands: CommandTemplate[];
  onSave: (env: Environment) => void;
}

export default function EnvInfoPanel({ env, onDelete, commands, onSave }: EnvInfoPanelProps) {
  const [editModalOpen, setEditModalOpen] = useState(false);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <CloudServerOutlined style={{ fontSize: 16, color: '#1890ff' }} />
        <Text strong style={{ fontSize: 16 }}>{env.name}</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {env.model} · {env.cpuArch} · {env.nodes.length} 节点
        </Text>
        <div style={{ flex: 1 }} />
        <Button
          type="primary"
          size="small"
          icon={<EditOutlined />}
          onClick={() => setEditModalOpen(true)}
        >
          编辑
        </Button>
        <Popconfirm
          title="确认删除"
          description="确定要删除此环境吗？此操作不可恢复。"
          onConfirm={() => onDelete(env.id)}
          okText="确认"
          cancelText="取消"
        >
          <Button danger size="small" icon={<DeleteOutlined />}>
            删除环境
          </Button>
        </Popconfirm>
      </div>

      <Collapse
        size="small"
        defaultActiveKey={['basic']}
        style={{ marginBottom: 12 }}
        items={[
          {
            key: 'basic',
            label: '基本信息',
            children: (
              <Descriptions column={3} size="small" bordered>
                <Descriptions.Item label="型号">{env.model || '-'}</Descriptions.Item>
                <Descriptions.Item label="CPU架构">{env.cpuArch || '-'}</Descriptions.Item>
                <Descriptions.Item label="盘信息">{env.diskInfo || '-'}</Descriptions.Item>
                <Descriptions.Item label="管理界面">
                  {env.managementUrl ? (
                    <Link href={env.managementUrl} target="_blank">
                      {env.managementUrl}
                    </Link>
                  ) : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="账号">{env.managementAccount || '-'}</Descriptions.Item>
                <Descriptions.Item label="密码">
                  {env.managementPassword ? (
                    <Text copyable={{ text: env.managementPassword, tooltips: ['复制密码', '已复制'] }}>
                      ••••••••
                    </Text>
                  ) : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="S3 Endpoint" span={2}>
                  {env.s3Config.endpoint || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="AK/SK">
                  <Space size={4}>
                    {env.s3Config.ak ? (
                      <Text copyable={{ text: env.s3Config.ak, tooltips: ['复制AK', '已复制'] }}>
                        AK: ••••••
                      </Text>
                    ) : 'AK: -'}
                    {env.s3Config.sk ? (
                      <Text copyable={{ text: env.s3Config.sk, tooltips: ['复制SK', '已复制'] }}>
                        SK: ••••••
                      </Text>
                    ) : 'SK: -'}
                  </Space>
                </Descriptions.Item>
              </Descriptions>
            ),
          },
          {
            key: 'nodes',
            label: `节点列表 (${env.nodes.length})`,
            children: <NodeList nodes={env.nodes} commands={commands} />,
          },
        ]}
      />

      <EnvEditModal
        open={editModalOpen}
        env={env}
        onSave={(updatedEnv) => { onSave(updatedEnv); setEditModalOpen(false); }}
        onCancel={() => setEditModalOpen(false)}
      />
    </div>
  );
}
