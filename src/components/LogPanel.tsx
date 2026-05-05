import { useState, useEffect, useRef, useMemo } from 'react';
import { Card, Tag, Button, Empty } from 'antd';
import { ClearOutlined, DownOutlined, UpOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { LogEntry, LogStatus } from '../types';
import { useLogStore } from '../store/logStore';

const statusColors: Record<LogStatus, string> = {
  success: 'success',
  error: 'error',
  info: 'processing',
  warning: 'warning',
};

const statusLabels: Record<LogStatus, string> = {
  success: '成功',
  error: '错误',
  info: '信息',
  warning: '警告',
};

interface LogItemProps {
  entry: LogEntry;
}

function LogItem({ entry }: LogItemProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
      <span style={{ color: '#8c8c8c', fontSize: 12, minWidth: 140, flexShrink: 0 }}>
        {dayjs(entry.timestamp).format('YYYY-MM-DD HH:mm:ss')}
      </span>
      <span style={{ fontWeight: 500, minWidth: 100, flexShrink: 0 }}>{entry.action}</span>
      <Tag color={statusColors[entry.status]}>{statusLabels[entry.status]}</Tag>
      <span style={{ color: '#595959', flex: 1 }}>{entry.detail}</span>
    </div>
  );
}

export default function LogPanel() {
  const { logs, clearLogs } = useLogStore();
  const [collapsed, setCollapsed] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLogsLengthRef = useRef(logs.length);

  const sortedLogs = useMemo(() => [...logs].sort((a, b) => b.timestamp - a.timestamp), [logs]);

  useEffect(() => {
    if (logs.length > prevLogsLengthRef.current && collapsed) {
      setCollapsed(false);
    }
    prevLogsLengthRef.current = logs.length;
  }, [logs.length, collapsed]);

  useEffect(() => {
    if (!collapsed && scrollRef.current && sortedLogs.length > 0) {
      scrollRef.current.scrollTop = 0;
    }
  }, [sortedLogs, collapsed]);

  if (collapsed) {
    return (
      <div
        style={{
          background: '#fff',
          borderTop: '1px solid #d9d9d9',
          padding: '8px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <span style={{ color: '#8c8c8c' }}>
          日志记录 ({logs.length})
        </span>
        <Button
          type="text"
          icon={<UpOutlined />}
          onClick={() => setCollapsed(false)}
          disabled={logs.length === 0}
        >
          展开日志
        </Button>
      </div>
    );
  }

  return (
    <div
      style={{
        background: '#fff',
        borderTop: '2px solid #1890ff',
        maxHeight: '30vh',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      <Card
        size="small"
        title={
          <span style={{ fontSize: 14 }}>
            日志记录 ({logs.length})
          </span>
        }
        extra={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              size="small"
              icon={<ClearOutlined />}
              onClick={clearLogs}
              disabled={logs.length === 0}
            >
              清除日志
            </Button>
            <Button
              size="small"
              icon={<DownOutlined />}
              onClick={() => setCollapsed(true)}
            >
              收起
            </Button>
          </div>
        }
        styles={{ body: { padding: 0, overflow: 'hidden' } }}
      >
        {sortedLogs.length === 0 ? (
          <Empty
            description="暂无日志"
            style={{ padding: 24 }}
          />
        ) : (
          <div
            ref={scrollRef}
            style={{ maxHeight: 'calc(30vh - 57px)', overflow: 'auto', padding: '0 16px' }}
          >
            {sortedLogs.map((entry) => (
              <LogItem key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
