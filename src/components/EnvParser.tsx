import { useState } from 'react';
import { Modal, Input, Button, Descriptions, message, Space } from 'antd';
import type { Environment } from '../types';
import { parseEnvironment } from '../utils/parser';
import { saveEnvironment } from '../utils/storage';

interface EnvParserProps {
  open: boolean;
  onClose: () => void;
  onSaved: (env: Environment) => void;
}

export default function EnvParser({ open, onClose, onSaved }: EnvParserProps) {
  const [text, setText] = useState('');
  const [parsedEnv, setParsedEnv] = useState<Environment | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleParse = () => {
    if (!text.trim()) {
      message.warning('请输入环境信息');
      return;
    }

    setParsing(true);
    try {
      const result = parseEnvironment(text);
      if (!result) {
        message.error('解析失败，请检查输入格式');
        setParsedEnv(null);
      } else {
        setParsedEnv(result);
        message.success('解析成功');
      }
    } catch {
      message.error('解析失败，请检查输入格式');
      setParsedEnv(null);
    } finally {
      setParsing(false);
    }
  };

  const handleConfirm = () => {
    if (!parsedEnv) {
      message.error('请先解析环境信息');
      return;
    }

    setSaving(true);
    try {
      saveEnvironment(parsedEnv);
      message.success('环境添加成功');
      onSaved(parsedEnv);
      handleClose();
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setText('');
    setParsedEnv(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      title="添加环境"
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
          placeholder="请粘贴环境信息文本..."
          style={{ fontFamily: 'monospace' }}
        />

        <Button type="primary" onClick={handleParse} loading={parsing} block>
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
          <Button type="primary" onClick={handleConfirm} loading={saving} block>
            确认添加
          </Button>
        )}
      </Space>
    </Modal>
  );
}