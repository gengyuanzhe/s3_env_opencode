import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { LogEntry, LogStatus } from '../types';

interface LogContextType {
  logs: LogEntry[];
  addLog: (action: string, status: LogStatus, detail: string) => void;
  clearLogs: () => void;
}

const LogContext = createContext<LogContextType | null>(null);

export function LogProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback((action: string, status: LogStatus, detail: string) => {
    const entry: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      action,
      status,
      detail,
    };
    setLogs(prev => [entry, ...prev].slice(0, 200));
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  return (
    <LogContext.Provider value={{ logs, addLog, clearLogs }}>
      {children}
    </LogContext.Provider>
  );
}

export function useLogStore(): LogContextType {
  const ctx = useContext(LogContext);
  if (!ctx) throw new Error('useLogStore must be used within LogProvider');
  return ctx;
}
