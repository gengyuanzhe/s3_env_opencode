import type { Environment, NodeInfo, S3Config } from '../types';

function extractField(text: string, pattern: RegExp): string {
  const match = text.match(pattern);
  return match ? match[1].trim() : '';
}

function parseNodes(text: string): NodeInfo[] {
  const nodes: NodeInfo[] = [];
  const lines = text.split(/\r?\n/);
  const ipPattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
  const credPattern = /\S+\/\S+/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const parts = trimmed.split(/\s+/);
    if (parts.length >= 4) {
      const name = parts[0];
      const internalIp = parts[1];
      const externalIp = parts[2];
      const credentials = parts.slice(3).join(' ');

      const ipLike = (s: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(s);

      if (ipLike(internalIp) && (ipLike(externalIp) || ipPattern.test(externalIp)) && credPattern.test(credentials)) {
        nodes.push({ name, internalIp, externalIp, credentials });
      }
    }
  }

  return nodes;
}

function parseS3Config(text: string): S3Config {
  const endpoint = extractField(text, /Endpoint\s*[:：]\s*(.+)/);
  const ak = extractField(text, /\bAK\s*[:：]\s*(.+)/);
  const sk = extractField(text, /\bSK\s*[:：]\s*(.+)/);
  return { endpoint, ak, sk };
}

export function serializeEnvironment(env: Environment): string {
  const lines: string[] = [
    `环境名称：${env.name}`,
    `型号：${env.model}`,
    `CPU架构：${env.cpuArch}`,
    `盘：${env.diskInfo}`,
    `管理界面：${env.managementUrl}`,
    `账号：${env.managementAccount}`,
    `密码：${env.managementPassword}`,
    `节点：`,
  ];
  for (const node of env.nodes) {
    lines.push(`${node.name} ${node.internalIp} ${node.externalIp} ${node.credentials}`);
  }
  lines.push(`S3配置：`);
  lines.push(`Endpoint：${env.s3Config.endpoint}`);
  lines.push(`AK：${env.s3Config.ak}`);
  lines.push(`SK：${env.s3Config.sk}`);
  return lines.join('\n');
}

export function parseEnvironment(text: string): Environment | null {
  if (!text || !text.trim()) return null;

  const name = extractField(text, /环境名称\s*[:：]\s*(.+)/);
  const model = extractField(text, /型号\s*[:：]\s*(.+)/);
  const cpuArch = extractField(text, /CPU架构\s*[:：]\s*(.+)/);
  const diskInfo = extractField(text, /盘\s*[:：]\s*(.+)/);
  const managementUrl = extractField(text, /管理界面\s*[:：]\s*(.+)/);
  const managementAccount = extractField(text, /账号\s*[:：]\s*(.+)/);
  const managementPassword = extractField(text, /密码\s*[:：]\s*(.+)/);

  const nodeSectionMatch = text.match(/节点\s*[:：]([\s\S]*?)(?=S3配置|$)/i);
  const nodeSection = nodeSectionMatch ? nodeSectionMatch[1] : '';
  const nodes = parseNodes(nodeSection);

  const s3SectionMatch = text.match(/S3配置\s*[:：]([\s\S]*?)$/i);
  const s3Section = s3SectionMatch ? s3SectionMatch[1] : '';
  const s3Config = parseS3Config(s3Section);

  if (!name && nodes.length === 0 && !s3Config.endpoint) {
    return null;
  }

  return {
    id: crypto.randomUUID(),
    name: name || '未命名环境',
    model,
    cpuArch,
    diskInfo,
    managementUrl,
    managementAccount,
    managementPassword,
    nodes,
    s3Config,
    createdAt: Date.now(),
  };
}
