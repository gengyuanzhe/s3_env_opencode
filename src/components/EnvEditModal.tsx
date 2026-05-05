import { useState, useEffect } from 'react';
import { Modal, Input, Button, Descriptions, message, Space } from 'antd';
import type { Environment } from '../types';
import { parseEnvironment, serializeEnvironment } from '../utils/parser';

interface EnvEditModalProps {
  open: boolean;
  env: Environment;
  onSave: (env: Environment) => void;
  onCancel: () => void;
}

export default function EnvEditModal({ open, env, onSave, onCancel }: EnvEditModalProps) {
  const [text, setText] = useState('');
  const [parsedEnv, setParsedEnv] = useState<Environment | null>(null);

  useEffect(() => {
    if (open) {
      setText(serializeEnvironment(env));
      setParsedEnv(null);
    }
  }, [open, env]);

  const handleParse = () => {
    if (!text.trim()) {
      message.warning('请输入环境信息');
      return;
    }
    const result = parseEnvironment(text);
    if (!result) {
      message.error('解析失败，请检查输入格式');
      setParsedEnv(null);
    } else {
      setParsedEnv(result);
      message.success('解析成功');
    }
  };

  const handleConfirm = () => {
    if (!parsedEnv) {
      message.error('请先解析环境信息');
      return;
    }
    const updatedEnv: Environment = {
      ...env,
      name: parsedEnv.name,
      model: parsedEnv.model,
      cpuArch: parsedEnv.cpuArch,
      diskInfo: parsedEnv.diskInfo,
      managementUrl: parsedEnv.managementUrl,
      managementAccount: parsedEnv.managementAccount,
      managementPassword: parsedEnv.managementPassword,
      nodes: parsedEnv.nodes,
      s3Config: parsedEnv.s3Config,
    };
    onSave(updatedEnv);
  };

  return (
    <Modal
      title="编辑环境信息"
      open={open}
      onCancel={onCancel}
      width={700}
      footer={null}
      destroyOnClose
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Input.TextArea
          rows={15}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setParsedEnv(null);
          }}
          style={{ fontFamily: 'monospace' }}
        />

        <Button type="primary" onClick={handleParse} block>
          解析
        </Button>

        {parsedEnv && (
          <Descriptions
            title="解析结果预览"
            bordered
            column={2}
            size="small"
          >
            <Descriptions.Item label="环境名称">{parsedEnv.name}</Descriptions.Item>
            <Descriptions.Item label="型号">{parsedEnv.model || '-'}</Descriptions.Item>
            <Descriptions.Item label="CPU架构">{parsedEnv.cpuArch || '-'}</Descriptions.Item>
            <Descriptions.Item label="盘信息">{parsedEnv.diskInfo || '-'}</Descriptions.Item>
            <Descriptions.Item label="管理界面" span={2}>
              {parsedEnv.managementUrl || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="账号">{parsedEnv.managementAccount || '-'}</Descriptions.Item>
            <Descriptions.Item label="密码">{parsedEnv.managementPassword ? '******' : '-'}</Descriptions.Item>
            <Descriptions.Item label="节点数量">{parsedEnv.nodes.length}</Descriptions.Item>
            <Descriptions.Item label="S3 Endpoint">{parsedEnv.s3Config.endpoint || '-'}</Descriptions.Item>
            <Descriptions.Item label="S3 AK">{parsedEnv.s3Config.ak ? '******' : '-'}</Descriptions.Item>
            <Descriptions.Item label="S3 SK">{parsedEnv.s3Config.sk ? '******' : '-'}</Descriptions.Item>
          </Descriptions>
        )}

        {parsedEnv && (
          <Button type="primary" onClick={handleConfirm} block>
            确认保存
          </Button>
        )}
      </Space>
    </Modal>
  );
}
