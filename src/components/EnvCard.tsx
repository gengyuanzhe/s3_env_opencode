import { Card, Descriptions, Typography, Button, Tag, Divider, Popconfirm, Space } from 'antd';
import { DeleteOutlined, CloudServerOutlined } from '@ant-design/icons';
import type { Environment, CommandTemplate } from '../types';
import NodeList from './NodeList';

const { Text, Link } = Typography;

interface EnvCardProps {
  env: Environment;
  onDelete: (id: string) => void;
  commands: CommandTemplate[];
}

export default function EnvCard({ env, onDelete, commands }: EnvCardProps) {
  return (
    <Card
      title={
        <Space>
          <CloudServerOutlined />
          <span>{env.name}</span>
          <Tag color="blue" style={{ marginLeft: 8 }}>
            {env.nodes.length} 个节点
          </Tag>
        </Space>
      }
      extra={
        <Popconfirm
          title="确认删除"
          description="确定要删除此环境吗？此操作不可恢复。"
          onConfirm={() => onDelete(env.id)}
          okText="确认"
          cancelText="取消"
        >
          <Button danger size="small" icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      }
      style={{ marginBottom: 16 }}
    >
      <Descriptions title="基本信息" column={2} size="small" bordered>
        <Descriptions.Item label="型号">{env.model || '-'}</Descriptions.Item>
        <Descriptions.Item label="CPU架构">{env.cpuArch || '-'}</Descriptions.Item>
        <Descriptions.Item label="盘信息" span={2}>{env.diskInfo || '-'}</Descriptions.Item>
      </Descriptions>

      <Divider>管理界面</Divider>
      <Descriptions column={2} size="small" bordered>
        <Descriptions.Item label="URL">
          {env.managementUrl ? (
            <Link href={env.managementUrl} target="_blank">
              {env.managementUrl}
            </Link>
          ) : (
            '-'
          )}
        </Descriptions.Item>
        <Descriptions.Item label="账号">{env.managementAccount || '-'}</Descriptions.Item>
        <Descriptions.Item label="密码" span={2}>
          {env.managementPassword ? (
            <Text copyable={{ text: env.managementPassword, tooltips: ['复制密码', '已复制'] }}>
              ••••••••
            </Text>
          ) : (
            '-'
          )}
        </Descriptions.Item>
      </Descriptions>

      <Divider>S3 配置</Divider>
      <Descriptions column={3} size="small" bordered>
        <Descriptions.Item label="Endpoint">
          {env.s3Config.endpoint || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="AK">
          {env.s3Config.ak ? (
            <Text copyable={{ text: env.s3Config.ak, tooltips: ['复制AK', '已复制'] }}>
              ••••••••
            </Text>
          ) : (
            '-'
          )}
        </Descriptions.Item>
        <Descriptions.Item label="SK">
          {env.s3Config.sk ? (
            <Text copyable={{ text: env.s3Config.sk, tooltips: ['复制SK', '已复制'] }}>
              ••••••••
            </Text>
          ) : (
            '-'
          )}
        </Descriptions.Item>
      </Descriptions>

      <Divider>节点列表</Divider>
      <NodeList nodes={env.nodes} commands={commands} />
    </Card>
  );
}