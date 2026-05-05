import { useMemo, useState } from 'react';
import { Table, Button, Typography, Dropdown, message } from 'antd';
import { LinkOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { NodeInfo, CommandTemplate } from '../types';

interface NodeListProps {
  nodes: NodeInfo[];
  commands: CommandTemplate[];
}

interface CredentialState {
  [key: string]: boolean;
}

export default function NodeList({ nodes, commands }: NodeListProps) {
  const [credentialVisible, setCredentialVisible] = useState<CredentialState>({});

  const toggleCredential = (nodeName: string) => {
    setCredentialVisible((prev) => ({
      ...prev,
      [nodeName]: !prev[nodeName],
    }));
  };

  const handleXshellConnect = (node: NodeInfo) => {
    const credParts = node.credentials.split('/');
    if (credParts.length >= 2) {
      const username = credParts[0];
      const password = credParts.slice(1).join('/');
      const sshUrl = `ssh://${username}:${encodeURIComponent(password)}@${node.externalIp}`;
      window.open(sshUrl, '_blank');
      message.success(`正在连接 ${node.name}...`);
    } else {
      message.error('凭证格式不正确，无法解析用户名和密码');
    }
  };

  const substituteVariables = (template: string, node: NodeInfo): string => {
    return template
      .replace(/{internalIp}/g, node.internalIp)
      .replace(/{externalIp}/g, node.externalIp)
      .replace(/{credentials}/g, node.credentials)
      .replace(/{nodeName}/g, node.name);
  };

  const handleQuickCommand = (command: CommandTemplate, node: NodeInfo) => {
    const substituted = substituteVariables(command.content, node);
    navigator.clipboard.writeText(substituted);
    message.success(`命令「${command.name}」已复制到剪贴板`);
  };

  const columns: ColumnsType<NodeInfo> = useMemo(() => [
    {
      title: '节点名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
    },
    {
      title: '内网IP',
      dataIndex: 'internalIp',
      key: 'internalIp',
      width: 180,
      render: (ip: string) => (
        <Typography.Text copyable={{ text: ip, tooltips: ['复制', '已复制'] }}>
          {ip}
        </Typography.Text>
      ),
    },
    {
      title: '外网IP',
      dataIndex: 'externalIp',
      key: 'externalIp',
      width: 180,
      render: (ip: string) => (
        <Typography.Text copyable={{ text: ip, tooltips: ['复制', '已复制'] }}>
          {ip}
        </Typography.Text>
      ),
    },
    {
      title: '凭证',
      dataIndex: 'credentials',
      key: 'credentials',
      width: 200,
      render: (credentials: string, record: NodeInfo) => {
        const isVisible = credentialVisible[record.name];
        const displayText = isVisible ? credentials : '••••••••';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Typography.Text
              copyable={isVisible ? { text: credentials, tooltips: ['复制', '已复制'] } : false}
            >
              {displayText}
            </Typography.Text>
            <Button
              type="link"
              size="small"
              onClick={() => toggleCredential(record.name)}
            >
              {isVisible ? '隐藏' : '显示'}
            </Button>
          </div>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: unknown, record: NodeInfo) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            type="primary"
            size="small"
            icon={<LinkOutlined />}
            onClick={() => handleXshellConnect(record)}
          >
            Xshell 连接
          </Button>
          {commands.length > 0 && (
            <Dropdown
              menu={{
                items: commands.map((cmd) => ({
                  key: cmd.id,
                  label: cmd.name,
                  onClick: () => handleQuickCommand(cmd, record),
                })),
              }}
              trigger={['click']}
            >
              <Button size="small" icon={<ThunderboltOutlined />}>
                快捷命令
              </Button>
            </Dropdown>
          )}
        </div>
      ),
    },
  ], [credentialVisible, commands]);

  if (nodes.length === 0) {
    return (
      <div style={{ color: '#8c8c8c', textAlign: 'center', padding: 16 }}>
        暂无节点信息
      </div>
    );
  }

  return (
    <Table
      dataSource={nodes}
      columns={columns}
      rowKey="name"
      size="small"
      pagination={false}
    />
  );
}