import { useState, useRef, useCallback, useEffect } from 'react';
import type { S3Client } from '@aws-sdk/client-s3';
import { ListObjectsV2Command, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Button, Table, Breadcrumb, Popconfirm, Progress, InputNumber, Switch, message, Spin } from 'antd';
import { ArrowLeftOutlined, UploadOutlined, DownloadOutlined, DeleteOutlined, FolderOutlined, FileOutlined } from '@ant-design/icons';
import { useLogStore } from '../store/logStore';
import dayjs from 'dayjs';

interface ObjectManagerProps {
  client: S3Client;
  bucketName: string;
  onBack: () => void;
}

interface ObjectInfo {
  key: string;
  name: string;
  size?: number;
  lastModified?: Date;
  isFolder: boolean;
}

type UploadMode = 'normal' | 'multipart';

function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null) return '-';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export default function ObjectManager({ client, bucketName, onBack }: ObjectManagerProps) {
  const { addLog } = useLogStore();
  const [prefix, setPrefix] = useState('');
  const [objects, setObjects] = useState<ObjectInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState<UploadMode>('normal');
  const [partSize, setPartSize] = useState(5);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const listObjects = useCallback(async (currentPrefix: string) => {
    setLoading(true);
    try {
      const command = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: currentPrefix,
        Delimiter: '/',
      });
      const response = await client.send(command);

      const folders: ObjectInfo[] = (response.CommonPrefixes || []).map(p => ({
        key: p.Prefix || '',
        name: (p.Prefix || '').replace(currentPrefix, '').replace(/\/$/, ''),
        isFolder: true,
      }));

      const files: ObjectInfo[] = (response.Contents || [])
        .filter(obj => obj.Key !== currentPrefix)
        .map(obj => ({
          key: obj.Key || '',
          name: (obj.Key || '').replace(currentPrefix, ''),
          size: obj.Size,
          lastModified: obj.LastModified,
          isFolder: false,
        }));

      setObjects([...folders, ...files]);
      addLog('列出对象', 'success', `桶 ${bucketName} 路径 ${currentPrefix || '/'} 获取 ${folders.length + files.length} 个对象`);
    } catch (err) {
      const error = err as Error;
      addLog('列出对象', 'error', `失败: ${error.message}`);
      message.error(`列出对象失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [client, bucketName, addLog]);

  useEffect(() => {
    listObjects(prefix);
  }, [prefix, listObjects]);

  const handleUpload = async (file: File) => {
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);

    const key = prefix + file.name;

    try {
      if (uploadMode === 'multipart') {
        const arrayBuffer = await file.arrayBuffer();
        const upload = new Upload({
          client,
          params: {
            Bucket: bucketName,
            Key: key,
            Body: new Uint8Array(arrayBuffer),
            ContentLength: arrayBuffer.byteLength,
          },
          partSize: partSize * 1024 * 1024,
        });

        upload.on('httpUploadProgress', (progress) => {
          if (progress.total && progress.loaded !== undefined) {
            const percent = Math.round((progress.loaded / progress.total) * 100);
            setUploadProgress(percent);
          }
        });

        await upload.done();
      } else {
        const { PutObjectCommand } = await import('@aws-sdk/client-s3');
        // Read file as ArrayBuffer to avoid SDK's aws-chunked encoding stream
        // which calls readableStream.getReader() — incompatible with browser's ReadableStream
        const arrayBuffer = await file.arrayBuffer();
        await client.send(new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: new Uint8Array(arrayBuffer),
          ContentLength: arrayBuffer.byteLength,
        }));
        setUploadProgress(100);
      }

      addLog('上传对象', 'success', `成功上传: ${key} (${uploadMode === 'multipart' ? '多段上传' : '普通上传'})`);
      message.success('上传成功');
      await listObjects(prefix);
    } catch (err) {
      const error = err as Error;
      addLog('上传对象', 'error', `失败: ${error.message}`);
      message.error(`上传失败: ${error.message}`);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDownload = async (obj: ObjectInfo) => {
    if (obj.isFolder) return;

    setLoading(true);
    try {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: obj.key,
      });
      const response = await client.send(command);
      const body = await response.Body?.transformToByteArray();

      if (!body) {
        throw new Error('无法获取文件内容');
      }

      const blob = new Blob([body]);

      // Try File System Access API
      const showSaveFilePicker = (window as unknown as Record<string, unknown>)['showSaveFilePicker'];
      if (typeof showSaveFilePicker === 'function') {
        try {
          const handle = await (showSaveFilePicker as (opts: unknown) => Promise<unknown>)({
            suggestedName: obj.name,
          });
          const writable = await (handle as { createWritable: () => Promise<FileSystemWritableFileStream> }).createWritable();
          await writable.write(blob);
          await writable.close();
          addLog('下载对象', 'success', `成功下载: ${obj.key}`);
          message.success('下载成功');
        } catch {
          // User cancelled or not supported, fallback to blob URL
          downloadWithBlob(blob, obj.name);
          addLog('下载对象', 'success', `成功下载: ${obj.key}`);
        }
      } else {
        downloadWithBlob(blob, obj.name);
        addLog('下载对象', 'success', `成功下载: ${obj.key}`);
      }
    } catch (err) {
      const error = err as Error;
      addLog('下载对象', 'error', `失败: ${error.message}`);
      message.error(`下载失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadWithBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (obj: ObjectInfo) => {
    if (obj.isFolder) return;
    setLoading(true);
    try {
      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: obj.key,
      });
      await client.send(command);
      addLog('删除对象', 'success', `成功删除: ${obj.key}`);
      message.success('删除成功');
      await listObjects(prefix);
    } catch (err) {
      const error = err as Error;
      addLog('删除对象', 'error', `失败: ${error.message}`);
      message.error(`删除失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const navigateToFolder = (folderPrefix: string) => {
    setPrefix(folderPrefix);
  };

  const handleBack = () => {
    if (prefix) {
      const parts = prefix.split('/').filter(Boolean);
      parts.pop();
      setPrefix(parts.length > 0 ? parts.join('/') + '/' : '');
    } else {
      onBack();
    }
  };

  const getBreadcrumbItems = () => {
    const items = [{ title: <a onClick={() => setPrefix('')}>{bucketName}</a> }];
    if (prefix) {
      const parts = prefix.split('/').filter(Boolean);
      let current = '';
      parts.forEach((part) => {
        current += part + '/';
        const path = current;
        items.push({
          title: <a onClick={() => setPrefix(path)}>{part}</a>,
        });
      });
    }
    return items;
  };

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
          返回
        </Button>
        <Breadcrumb items={getBreadcrumbItems()} />
      </div>

      <div style={{ marginBottom: '16px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleUpload(file);
              e.target.value = '';
            }
          }}
        />
        <Button
          type="primary"
          icon={<UploadOutlined />}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          上传对象
        </Button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>普通上传</span>
          <Switch
            checked={uploadMode === 'multipart'}
            onChange={(checked) => setUploadMode(checked ? 'multipart' : 'normal')}
          />
          <span>多段上传</span>
        </div>
        {uploadMode === 'multipart' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>分段大小:</span>
              <InputNumber
                min={5}
                max={100}
                value={partSize}
                onChange={(v) => setPartSize(v || 5)}
              addonAfter="MB"
            />
          </div>
        )}
      </div>

      {uploading && (
        <div style={{ marginBottom: '16px' }}>
          <Progress percent={uploadProgress} status="active" />
        </div>
      )}

      <Spin spinning={loading}>
        <Table
          dataSource={objects}
          rowKey="key"
          columns={[
            {
              title: '名称',
              dataIndex: 'name',
              key: 'name',
              render: (name: string, record) => (
                <span style={{ cursor: record.isFolder ? 'pointer' : 'default' }}>
                  {record.isFolder ? <FolderOutlined style={{ color: '#faad14', marginRight: '8px' }} /> : <FileOutlined style={{ marginRight: '8px' }} />}
                  {name}
                </span>
              ),
            },
            {
              title: '大小',
              dataIndex: 'size',
              key: 'size',
              render: (size: number | undefined, record: ObjectInfo) => record.isFolder ? '-' : formatBytes(size),
            },
            {
              title: '修改时间',
              dataIndex: 'lastModified',
              key: 'lastModified',
              render: (date: Date | undefined, record: ObjectInfo) => record.isFolder ? '-' : date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-',
            },
            {
              title: '操作',
              key: 'action',
              render: (_, record) => (
                !record.isFolder && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button
                      icon={<DownloadOutlined />}
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(record);
                      }}
                    >
                      下载
                    </Button>
                    <Popconfirm
                      title="确认删除"
                      description="确定要删除这个对象吗？"
                      onConfirm={(e) => {
                        e?.stopPropagation();
                        handleDelete(record);
                      }}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button
                        danger
                        icon={<DeleteOutlined />}
                        size="small"
                        onClick={(e) => e.stopPropagation()}
                      >
                        删除
                      </Button>
                    </Popconfirm>
                  </div>
                )
              ),
            },
          ]}
          onRow={(record) => ({
            onClick: () => {
              if (record.isFolder) {
                navigateToFolder(record.key);
              }
            },
            style: { cursor: record.isFolder ? 'pointer' : 'default' },
          })}
        />
      </Spin>
    </div>
  );
}