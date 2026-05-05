import { useState, useCallback } from 'react';
import { S3Client, ListBucketsCommand, CreateBucketCommand, DeleteBucketCommand } from '@aws-sdk/client-s3';
import { Select, Button, Table, Modal, Input, Popconfirm, message, Spin } from 'antd';
import { PlusOutlined, ReloadOutlined, DeleteOutlined } from '@ant-design/icons';
import type { Environment } from '../types';
import { useLogStore } from '../store/logStore';
import dayjs from 'dayjs';
import ObjectManager from './ObjectManager';

interface BucketManagerProps {
  environments: Environment[];
}

interface BucketInfo {
  name: string;
  creationDate?: Date;
}

export default function BucketManager({ environments }: BucketManagerProps) {
  const { addLog } = useLogStore();
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(null);
  const [client, setClient] = useState<S3Client | null>(null);
  const [buckets, setBuckets] = useState<BucketInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newBucketName, setNewBucketName] = useState('');
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);

  const createClient = useCallback((env: Environment): S3Client => {
    return new S3Client({
      region: 'us-east-1',
      endpoint: env.s3Config.endpoint,
      credentials: {
        accessKeyId: env.s3Config.ak,
        secretAccessKey: env.s3Config.sk,
      },
      forcePathStyle: true,
    });
  }, []);

  const handleEnvChange = (envId: string) => {
    const env = environments.find(e => e.id === envId);
    if (env) {
      const s3Client = createClient(env);
      setClient(s3Client);
      setSelectedEnvId(envId);
      setBuckets([]);
    }
  };

  const listBuckets = async () => {
    if (!client) return;
    setLoading(true);
    try {
      const command = new ListBucketsCommand({});
      const response = await client.send(command);
      const bucketList: BucketInfo[] = (response.Buckets || []).map(b => ({
        name: b.Name || '',
        creationDate: b.CreationDate,
      }));
      setBuckets(bucketList);
      addLog('列出桶', 'success', `成功获取 ${bucketList.length} 个桶`);
    } catch (err) {
      const error = err as Error;
      addLog('列出桶', 'error', `失败: ${error.message}`);
      message.error(`列出桶失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const createBucket = async () => {
    if (!client || !newBucketName.trim()) {
      message.warning('请输入桶名称');
      return;
    }
    setLoading(true);
    try {
      const command = new CreateBucketCommand({ Bucket: newBucketName.trim() });
      await client.send(command);
      addLog('创建桶', 'success', `成功创建桶: ${newBucketName}`);
      message.success('桶创建成功');
      setCreateModalOpen(false);
      setNewBucketName('');
      await listBuckets();
    } catch (err) {
      const error = err as Error;
      addLog('创建桶', 'error', `失败: ${error.message}`);
      message.error(`创建桶失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteBucket = async (bucketName: string) => {
    if (!client) return;
    setLoading(true);
    try {
      const command = new DeleteBucketCommand({ Bucket: bucketName });
      await client.send(command);
      addLog('删除桶', 'success', `成功删除桶: ${bucketName}`);
      message.success('桶删除成功');
      await listBuckets();
    } catch (err) {
      const error = err as Error;
      addLog('删除桶', 'error', `失败: ${error.message}`);
      message.error(`删除桶失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (selectedBucket && client) {
    return (
      <ObjectManager
        client={client}
        bucketName={selectedBucket}
        onBack={() => setSelectedBucket(null)}
      />
    );
  }

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <Select
          placeholder="选择环境"
          style={{ width: 200 }}
          value={selectedEnvId}
          onChange={handleEnvChange}
          options={environments.map(env => ({ label: env.name, value: env.id }))}
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateModalOpen(true)}
          disabled={!client}
        >
          创建桶
        </Button>
        <Button
          icon={<ReloadOutlined />}
          onClick={listBuckets}
          disabled={!client}
          loading={loading}
        >
          刷新
        </Button>
      </div>

      <Spin spinning={loading}>
        <Table
          dataSource={buckets}
          rowKey="name"
          columns={[
            {
              title: '桶名称',
              dataIndex: 'name',
              key: 'name',
            },
            {
              title: '创建时间',
              dataIndex: 'creationDate',
              key: 'creationDate',
              render: (date?: Date) => date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-',
            },
            {
              title: '操作',
              key: 'action',
              render: (_, record) => (
                <Popconfirm
                  title="确认删除"
                  description="确定要删除这个桶吗？"
                  onConfirm={() => deleteBucket(record.name)}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button danger icon={<DeleteOutlined />} size="small">
                    删除
                  </Button>
                </Popconfirm>
              ),
            },
          ]}
          onRow={(record) => ({
            onClick: () => setSelectedBucket(record.name),
            style: { cursor: 'pointer' },
          })}
        />
      </Spin>

      <Modal
        title="创建桶"
        open={createModalOpen}
        onOk={createBucket}
        onCancel={() => {
          setCreateModalOpen(false);
          setNewBucketName('');
        }}
        okText="创建"
        cancelText="取消"
      >
        <Input
          placeholder="请输入桶名称"
          value={newBucketName}
          onChange={(e) => setNewBucketName(e.target.value)}
          onPressEnter={createBucket}
        />
      </Modal>
    </div>
  );
}