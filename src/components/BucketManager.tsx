import { useState, useEffect } from 'react';
import type { S3Client } from '@aws-sdk/client-s3';
import { ListBucketsCommand, CreateBucketCommand, DeleteBucketCommand } from '@aws-sdk/client-s3';
import { Button, Table, Modal, Input, Popconfirm, message, Spin, Typography } from 'antd';
import { PlusOutlined, ReloadOutlined, DeleteOutlined } from '@ant-design/icons';
import { useLogStore } from '../store/logStore';
import dayjs from 'dayjs';

interface BucketManagerProps {
  client: S3Client;
  onBucketSelect: (name: string) => void;
}

interface BucketInfo {
  name: string;
  creationDate?: Date;
}

export default function BucketManager({ client, onBucketSelect }: BucketManagerProps) {
  const { addLog } = useLogStore();
  const [buckets, setBuckets] = useState<BucketInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newBucketName, setNewBucketName] = useState('');

  const listBuckets = async () => {
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
    if (!newBucketName.trim()) {
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

  useEffect(() => {
    listBuckets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
        <Typography.Text strong style={{ fontSize: 15 }}>
          S3 桶列表
        </Typography.Text>
        <div style={{ flex: 1 }} />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateModalOpen(true)}
          size="small"
        >
          创建桶
        </Button>
        <Button
          icon={<ReloadOutlined />}
          onClick={listBuckets}
          loading={loading}
          size="small"
        >
          刷新
        </Button>
      </div>

      <Spin spinning={loading}>
        <Table
          dataSource={buckets}
          rowKey="name"
          size="small"
          pagination={false}
          columns={[
            {
              title: '桶名称',
              dataIndex: 'name',
              key: 'name',
              render: (name: string) => (
                <Typography.Link>{name}</Typography.Link>
              ),
            },
            {
              title: '创建时间',
              dataIndex: 'creationDate',
              key: 'creationDate',
              width: 180,
              render: (date?: Date) => date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-',
            },
            {
              title: '操作',
              key: 'action',
              width: 80,
              render: (_, record) => (
                <Popconfirm
                  title="确认删除"
                  description="确定要删除这个桶吗？"
                  onConfirm={(e) => { e?.stopPropagation(); deleteBucket(record.name); }}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button danger icon={<DeleteOutlined />} size="small" onClick={(e) => e.stopPropagation()}>
                    删除
                  </Button>
                </Popconfirm>
              ),
            },
          ]}
          onRow={(record) => ({
            onClick: () => onBucketSelect(record.name),
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
