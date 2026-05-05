import { useState, useEffect } from 'react';
import { Form, Input, Button, Table, Modal, Card, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { GlobalConfig, BucketPathConfig } from '../types';
import { getGlobalConfig, saveGlobalConfig } from '../utils/storage';
import { useLogStore } from '../store/logStore';

interface BucketPathEntry {
  bucketName: string;
  uploadPath: string;
  downloadPath: string;
}

export default function UploadConfig() {
  const { addLog } = useLogStore();
  const [form] = Form.useForm();
  const [bucketForm] = Form.useForm();
  const [config, setConfig] = useState<GlobalConfig>({
    defaultPathConfig: { uploadPath: '', downloadPath: '' },
    bucketPathConfigs: {},
  });
  const [bucketModalOpen, setBucketModalOpen] = useState(false);
  const [editingBucket, setEditingBucket] = useState<string | null>(null);
  const [bucketList, setBucketList] = useState<BucketPathEntry[]>([]);

  useEffect(() => {
    const savedConfig = getGlobalConfig();
    setConfig(savedConfig);
    form.setFieldsValue({
      uploadPath: savedConfig.defaultPathConfig.uploadPath,
      downloadPath: savedConfig.defaultPathConfig.downloadPath,
    });
    updateBucketList(savedConfig.bucketPathConfigs);
  }, [form]);

  const updateBucketList = (bucketConfigs: BucketPathConfig) => {
    const list: BucketPathEntry[] = Object.entries(bucketConfigs).map(([bucketName, pathConfig]) => ({
      bucketName,
      uploadPath: pathConfig.uploadPath,
      downloadPath: pathConfig.downloadPath,
    }));
    setBucketList(list);
  };

  const handleDefaultPathSave = async () => {
    try {
      const values = await form.validateFields();
      const newConfig: GlobalConfig = {
        ...config,
        defaultPathConfig: {
          uploadPath: values.uploadPath || '',
          downloadPath: values.downloadPath || '',
        },
      };
      saveGlobalConfig(newConfig);
      setConfig(newConfig);
      addLog('保存配置', 'success', '默认路径配置已保存');
      message.success('保存成功');
    } catch (err) {
      const error = err as Error;
      addLog('保存配置', 'error', `失败: ${error.message}`);
    }
  };

  const handleOpenBucketModal = (bucket?: BucketPathEntry) => {
    if (bucket) {
      setEditingBucket(bucket.bucketName);
      bucketForm.setFieldsValue({
        bucketName: bucket.bucketName,
        uploadPath: bucket.uploadPath,
        downloadPath: bucket.downloadPath,
      });
    } else {
      setEditingBucket(null);
      bucketForm.resetFields();
    }
    setBucketModalOpen(true);
  };

  const handleSaveBucketConfig = async () => {
    try {
      const values = await bucketForm.validateFields();
      const bucketName = values.bucketName?.trim();
      if (!bucketName) {
        message.warning('请输入桶名称');
        return;
      }

      const newBucketConfigs: BucketPathConfig = { ...config.bucketPathConfigs };
      
      // If editing, remove old key if name changed
      if (editingBucket && editingBucket !== bucketName) {
        delete newBucketConfigs[editingBucket];
      }

      newBucketConfigs[bucketName] = {
        uploadPath: values.uploadPath || '',
        downloadPath: values.downloadPath || '',
      };

      const newConfig: GlobalConfig = {
        ...config,
        bucketPathConfigs: newBucketConfigs,
      };

      saveGlobalConfig(newConfig);
      setConfig(newConfig);
      updateBucketList(newBucketConfigs);
      setBucketModalOpen(false);
      addLog('保存配置', 'success', `桶 ${bucketName} 路径配置已保存`);
      message.success('保存成功');
    } catch (err) {
      const error = err as Error;
      addLog('保存配置', 'error', `失败: ${error.message}`);
    }
  };

  const handleDeleteBucketConfig = (bucketName: string) => {
    const newBucketConfigs: BucketPathConfig = { ...config.bucketPathConfigs };
    delete newBucketConfigs[bucketName];

    const newConfig: GlobalConfig = {
      ...config,
      bucketPathConfigs: newBucketConfigs,
    };

    saveGlobalConfig(newConfig);
    setConfig(newConfig);
    updateBucketList(newBucketConfigs);
    addLog('删除配置', 'success', `桶 ${bucketName} 路径配置已删除`);
    message.success('删除成功');
  };

  return (
    <div style={{ padding: '16px' }}>
      <Card title="默认路径配置" style={{ marginBottom: '16px' }}>
        <Form form={form} layout="inline">
          <Form.Item name="uploadPath" label="上传路径">
            <Input placeholder="默认上传路径" style={{ width: 300 }} />
          </Form.Item>
          <Form.Item name="downloadPath" label="下载路径">
            <Input placeholder="默认下载路径" style={{ width: 300 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" onClick={handleDefaultPathSave}>
              保存
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card
        title="桶路径覆盖配置"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenBucketModal()}>
            新增配置
          </Button>
        }
      >
        <Table
          dataSource={bucketList}
          rowKey="bucketName"
          columns={[
            {
              title: '桶名称',
              dataIndex: 'bucketName',
              key: 'bucketName',
            },
            {
              title: '上传路径',
              dataIndex: 'uploadPath',
              key: 'uploadPath',
            },
            {
              title: '下载路径',
              dataIndex: 'downloadPath',
              key: 'downloadPath',
            },
            {
              title: '操作',
              key: 'action',
              render: (_, record) => (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button
                    icon={<EditOutlined />}
                    size="small"
                    onClick={() => handleOpenBucketModal(record)}
                  >
                    编辑
                  </Button>
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    size="small"
                    onClick={() => handleDeleteBucketConfig(record.bucketName)}
                  >
                    删除
                  </Button>
                </div>
              ),
            },
          ]}
          locale={{ emptyText: '暂无桶路径配置' }}
        />
      </Card>

      <Modal
        title={editingBucket ? '编辑桶路径配置' : '新增桶路径配置'}
        open={bucketModalOpen}
        onOk={handleSaveBucketConfig}
        onCancel={() => setBucketModalOpen(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form form={bucketForm} layout="vertical">
          <Form.Item
            name="bucketName"
            label="桶名称"
            rules={[{ required: true, message: '请输入桶名称' }]}
          >
            <Input placeholder="请输入桶名称" disabled={!!editingBucket} />
          </Form.Item>
          <Form.Item name="uploadPath" label="上传路径">
            <Input placeholder="上传路径（可选）" />
          </Form.Item>
          <Form.Item name="downloadPath" label="下载路径">
            <Input placeholder="下载路径（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}