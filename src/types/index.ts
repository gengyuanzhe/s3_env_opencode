export interface NodeInfo {
  name: string;
  internalIp: string;
  externalIp: string;
  credentials: string;
}

export interface S3Config {
  endpoint: string;
  ak: string;
  sk: string;
}

export interface Environment {
  id: string;
  name: string;
  model: string;
  cpuArch: string;
  diskInfo: string;
  managementUrl: string;
  managementAccount: string;
  managementPassword: string;
  nodes: NodeInfo[];
  s3Config: S3Config;
  createdAt: number;
}

export interface CommandTemplate {
  id: string;
  name: string;
  content: string;
  createdAt: number;
}

export type LogStatus = 'success' | 'error' | 'info' | 'warning';

export interface LogEntry {
  id: string;
  timestamp: number;
  action: string;
  status: LogStatus;
  detail: string;
}

export interface PathConfig {
  uploadPath: string;
  downloadPath: string;
}

export interface BucketPathConfig {
  [bucketName: string]: PathConfig;
}

export interface GlobalConfig {
  defaultPathConfig: PathConfig;
  bucketPathConfigs: BucketPathConfig;
}
