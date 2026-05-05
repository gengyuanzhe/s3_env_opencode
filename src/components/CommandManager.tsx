import { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, Modal, Input, Button, Popconfirm, Card, Typography, Tooltip, Alert, message, Select, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined, SnippetsOutlined } from '@ant-design/icons';
import type { CommandTemplate, Environment, NodeInfo } from '../types';
import { getCommands, saveCommand, deleteCommand, getEnvironments } from '../utils/storage';
import { useLogStore } from '../store/logStore';

const { Text } = Typography;
const { TextArea } = Input;

interface VariableReference {
  key: string;
  variable: string;
  description: string;
}

const variableReferences: VariableReference[] = [
  { key: '1', variable: '{internalIp}', description: '节点内网 IP' },
  { key: '2', variable: '{externalIp}', description: '节点外网 IP' },
  { key: '3', variable: '{credentials}', description: '节点登录凭证' },
  { key: '4', variable: '{nodeName}', description: '节点名称' },
];

function substituteVariables(template: string, node: NodeInfo): string {
  return template
    .replace(/{internalIp}/g, node.internalIp)
    .replace(/{externalIp}/g, node.externalIp)
    .replace(/{credentials}/g, node.credentials)
    .replace(/{nodeName}/g, node.name);
}

export default function CommandManager() {
  const { addLog } = useLogStore();
  const [commands, setCommands] = useState<CommandTemplate[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formContent, setFormContent] = useState('');

  // Preview state
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [previewEnvId, setPreviewEnvId] = useState<string | undefined>(undefined);
  const [previewNodeIdx, setPreviewNodeIdx] = useState<number | undefined>(undefined);
  const [previewCmdId, setPreviewCmdId] = useState<string | undefined>(undefined);

  const loadCommands = useCallback(() => {
    const loaded = getCommands();
    setCommands(loaded.sort((a, b) => b.createdAt - a.createdAt));
  }, []);

  useEffect(() => {
    loadCommands();
    setEnvironments(getEnvironments());
  }, [loadCommands]);

  const selectedEnv = useMemo(() => environments.find(e => e.id === previewEnvId), [environments, previewEnvId]);
  const nodeOptions = useMemo(() => selectedEnv?.nodes ?? [], [selectedEnv]);
  const previewCmd = useMemo(() => commands.find(c => c.id === previewCmdId), [commands, previewCmdId]);
  const previewNode = useMemo(() => {
    if (previewNodeIdx !== undefined && nodeOptions[previewNodeIdx]) {
      return nodeOptions[previewNodeIdx];
    }
    return null;
  }, [previewNodeIdx, nodeOptions]);

  const substitutedText = useMemo(() => {
    if (previewCmd && previewNode) {
      return substituteVariables(previewCmd.content, previewNode);
    }
    return '';
  }, [previewCmd, previewNode]);

  const handleEnvChange = (envId: string) => {
    setPreviewEnvId(envId);
    setPreviewNodeIdx(undefined);
  };

  const handleCopyPreview = () => {
    if (!substitutedText) return;
    navigator.clipboard.writeText(substitutedText).then(() => {
      message.success('已复制替换后的命令');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  const handleOpenModal = (cmd?: CommandTemplate) => {
    if (cmd) {
      setEditingId(cmd.id);
      setFormName(cmd.name);
      setFormContent(cmd.content);
    } else {
      setEditingId(null);
      setFormName('');
      setFormContent('');
    }
    setModalOpen(true);
  };

  const handleSave = () => {
    const name = formName.trim();
    const content = formContent.trim();

    if (!name) {
      message.warning('请输入命令名称');
      return;
    }
    if (!content) {
      message.warning('请输入命令内容');
      return;
    }

    const cmd: CommandTemplate = {
      id: editingId || crypto.randomUUID(),
      name,
      content,
      createdAt: editingId ? commands.find(c => c.id === editingId)?.createdAt || Date.now() : Date.now(),
    };

    saveCommand(cmd);
    loadCommands();
    setModalOpen(false);
    addLog('保存命令', 'success', `命令模板 "${name}" 已保存`);
    message.success('保存成功');
  };

  const handleDelete = (id: string, name: string) => {
    deleteCommand(id);
    loadCommands();
    addLog('删除命令', 'success', `命令模板 "${name}" 已删除`);
    message.success('删除成功');
  };

  const handleCopyVariable = (variable: string) => {
    navigator.clipboard.writeText(variable).then(() => {
      message.success(`已复制: ${variable}`);
    }).catch(() => {
      message.error('复制失败');
    });
  };

  const envSelectOptions = useMemo(() => environments.map(e => ({
    value: e.id,
    label: `${e.name} (${e.nodes.length} 节点)`,
  })), [environments]);

  const nodeSelectOptions = useMemo(() => nodeOptions.map((n, idx) => ({
    value: idx,
    label: `${n.name} (${n.internalIp})`,
  })), [nodeOptions]);

  const cmdSelectOptions = useMemo(() => commands.map(c => ({
    value: c.id,
    label: c.name,
  })), [commands]);

  return (
    <div style={{ padding: '16px' }}>
      <Card
        title="命令模板管理"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
            新增命令
          </Button>
        }
        style={{ marginBottom: '16px' }}
      >
        <Table
          dataSource={commands}
          rowKey="id"
          columns={[
            {
              title: '名称',
              dataIndex: 'name',
              key: 'name',
              width: 200,
            },
            {
              title: '内容预览',
              dataIndex: 'content',
              key: 'content',
              ellipsis: true,
              render: (content: string) => (
                <Tooltip title={content}>
                  <Text ellipsis style={{ maxWidth: 400 }}>
                    {content}
                  </Text>
                </Tooltip>
              ),
            },
            {
              title: '操作',
              key: 'action',
              width: 240,
              render: (_, record) => (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button
                    icon={<SnippetsOutlined />}
                    size="small"
                    onClick={() => {
                      navigator.clipboard.writeText(record.content).then(() => {
                        message.success('已复制命令内容');
                      }).catch(() => {
                        message.error('复制失败');
                      });
                    }}
                  >
                    复制
                  </Button>
                  <Button
                    icon={<EditOutlined />}
                    size="small"
                    onClick={() => handleOpenModal(record)}
                  >
                    编辑
                  </Button>
                  <Popconfirm
                    title="确认删除"
                    description="确定要删除这个命令模板吗？"
                    onConfirm={() => handleDelete(record.id, record.name)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button danger icon={<DeleteOutlined />} size="small">
                      删除
                    </Button>
                  </Popconfirm>
                </div>
              ),
            },
          ]}
          locale={{ emptyText: '暂无命令模板' }}
        />
      </Card>

      <Card
        title="命令预览"
        style={{ marginBottom: '16px' }}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="选择环境和节点后，可以预览命令模板中变量替换后的实际内容，也可在环境详情的节点列表中点击每行的「快捷命令」按钮。"
        />
        <Row gutter={16} style={{ marginBottom: 12 }}>
          <Col span={8}>
            <div style={{ marginBottom: 4, color: '#8c8c8c', fontSize: 12 }}>环境</div>
            <Select
              placeholder="选择环境"
              value={previewEnvId}
              onChange={handleEnvChange}
              options={envSelectOptions}
              style={{ width: '100%' }}
              allowClear
              notFoundContent="暂无环境"
            />
          </Col>
          <Col span={8}>
            <div style={{ marginBottom: 4, color: '#8c8c8c', fontSize: 12 }}>节点</div>
            <Select
              placeholder={selectedEnv ? '选择节点' : '请先选择环境'}
              value={previewNodeIdx}
              onChange={(v) => setPreviewNodeIdx(v)}
              options={nodeSelectOptions}
              style={{ width: '100%' }}
              allowClear
              disabled={!selectedEnv}
              notFoundContent={selectedEnv ? '该环境暂无节点' : '请先选择环境'}
            />
          </Col>
          <Col span={8}>
            <div style={{ marginBottom: 4, color: '#8c8c8c', fontSize: 12 }}>命令模板</div>
            <Select
              placeholder="选择命令模板"
              value={previewCmdId}
              onChange={(v) => setPreviewCmdId(v)}
              options={cmdSelectOptions}
              style={{ width: '100%' }}
              allowClear
              notFoundContent="暂无命令模板"
            />
          </Col>
        </Row>
        {substitutedText ? (
          <div>
            <TextArea
              value={substitutedText}
              readOnly
              autoSize={{ minRows: 2, maxRows: 6 }}
              style={{ fontFamily: 'monospace', marginBottom: 8 }}
            />
            <Button type="primary" icon={<CopyOutlined />} onClick={handleCopyPreview}>
              复制到剪贴板
            </Button>
          </div>
        ) : (
          <div style={{ color: '#8c8c8c', textAlign: 'center', padding: 16 }}>
            请选择环境、节点和命令模板以预览替换结果
          </div>
        )}
      </Card>

      <Card title="变量参考">
        <Table
          dataSource={variableReferences}
          rowKey="key"
          pagination={false}
          size="small"
          columns={[
            {
              title: '变量',
              dataIndex: 'variable',
              key: 'variable',
              width: 180,
              render: (variable: string) => (
                <Text code copyable={{ text: variable }}>
                  {variable}
                </Text>
              ),
            },
            {
              title: '说明',
              dataIndex: 'description',
              key: 'description',
            },
            {
              title: '操作',
              key: 'action',
              width: 80,
              render: (_, record) => (
                <Button
                  icon={<CopyOutlined />}
                  size="small"
                  onClick={() => handleCopyVariable(record.variable)}
                >
                  复制
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={editingId ? '编辑命令模板' : '新增命令模板'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        cancelText="取消"
        width={600}
      >
        <div style={{ marginBottom: '16px' }}>
          <Text type="secondary">
            可用变量: {'{internalIp}'} {'{externalIp}'} {'{credentials}'} {'{nodeName}'}
          </Text>
        </div>
        <Input
          placeholder="命令名称"
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          style={{ marginBottom: '12px' }}
        />
        <TextArea
          placeholder="命令内容，可使用变量如 {internalIp}, {externalIp} 等"
          value={formContent}
          onChange={(e) => setFormContent(e.target.value)}
          rows={6}
        />
      </Modal>
    </div>
  );
}
