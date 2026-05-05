import type { Environment, CommandTemplate, GlobalConfig } from '../types';

const ENV_KEY = 's3env_environments';
const CMD_KEY = 's3env_commands';
const CONFIG_KEY = 's3env_global_config';

export function getEnvironments(): Environment[] {
  try {
    const data = localStorage.getItem(ENV_KEY);
    return data ? JSON.parse(data) as Environment[] : [];
  } catch {
    return [];
  }
}

export function saveEnvironment(env: Environment): void {
  const envs = getEnvironments();
  const idx = envs.findIndex(e => e.id === env.id);
  if (idx >= 0) {
    envs[idx] = env;
  } else {
    envs.push(env);
  }
  localStorage.setItem(ENV_KEY, JSON.stringify(envs));
}

export function deleteEnvironment(id: string): void {
  const envs = getEnvironments().filter(e => e.id !== id);
  localStorage.setItem(ENV_KEY, JSON.stringify(envs));
}

export function getCommands(): CommandTemplate[] {
  try {
    const data = localStorage.getItem(CMD_KEY);
    return data ? JSON.parse(data) as CommandTemplate[] : [];
  } catch {
    return [];
  }
}

export function saveCommand(cmd: CommandTemplate): void {
  const cmds = getCommands();
  const idx = cmds.findIndex(c => c.id === cmd.id);
  if (idx >= 0) {
    cmds[idx] = cmd;
  } else {
    cmds.push(cmd);
  }
  localStorage.setItem(CMD_KEY, JSON.stringify(cmds));
}

export function deleteCommand(id: string): void {
  const cmds = getCommands().filter(c => c.id !== id);
  localStorage.setItem(CMD_KEY, JSON.stringify(cmds));
}

export function getGlobalConfig(): GlobalConfig {
  try {
    const data = localStorage.getItem(CONFIG_KEY);
    if (data) return JSON.parse(data) as GlobalConfig;
  } catch {
    // fallback to default
  }
  return {
    defaultPathConfig: { uploadPath: '', downloadPath: '' },
    bucketPathConfigs: {},
  };
}

export function saveGlobalConfig(config: GlobalConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}
