import fs from 'fs/promises';
import { watch, FSWatcher } from 'fs';
import YAML from 'yaml';
import { EventEmitter } from 'events';
import chalk from 'chalk';

export interface BunProxyConfig {
  endpoint?: number;
  useRestApi?: boolean;
  savePlayerIP?: boolean;
  listeners?: Array<{
    bind?: string;
    tcp?: number;
    udp?: number;
    haproxy?: boolean;
    webhook?: string;
    target?: {
      host?: string;
      tcp?: number;
      udp?: number;
    };
  }>;
}

export class ConfigManager extends EventEmitter {
  private watchers: Map<string, FSWatcher> = new Map();

  constructor() {
    super();
  }

  async read(configPath: string): Promise<BunProxyConfig> {
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      return YAML.parse(content);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.log(chalk.yellow(`Config file not found: ${configPath}`));
        return {};
      }
      throw error;
    }
  }

  async write(configPath: string, config: BunProxyConfig): Promise<void> {
    const content = YAML.stringify(config);
    await fs.writeFile(configPath, content, 'utf-8');
    console.log(chalk.green(`✓ Config saved: ${configPath}`));
  }

  async validate(config: BunProxyConfig): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (config.endpoint !== undefined) {
      if (typeof config.endpoint !== 'number' || config.endpoint < 1 || config.endpoint > 65535) {
        errors.push('endpoint must be a valid port number (1-65535)');
      }
    }

    if (config.listeners) {
      if (!Array.isArray(config.listeners)) {
        errors.push('listeners must be an array');
      } else {
        config.listeners.forEach((listener, index) => {
          if (listener.tcp !== undefined) {
            if (typeof listener.tcp !== 'number' || listener.tcp < 1 || listener.tcp > 65535) {
              errors.push(`listeners[${index}].tcp must be a valid port number`);
            }
          }
          if (listener.udp !== undefined) {
            if (typeof listener.udp !== 'number' || listener.udp < 1 || listener.udp > 65535) {
              errors.push(`listeners[${index}].udp must be a valid port number`);
            }
          }
          if (listener.target) {
            if (listener.target.tcp !== undefined) {
              if (typeof listener.target.tcp !== 'number' || listener.target.tcp < 1 || listener.target.tcp > 65535) {
                errors.push(`listeners[${index}].target.tcp must be a valid port number`);
              }
            }
            if (listener.target.udp !== undefined) {
              if (typeof listener.target.udp !== 'number' || listener.target.udp < 1 || listener.target.udp > 65535) {
                errors.push(`listeners[${index}].target.udp must be a valid port number`);
              }
            }
          }
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  watch(instanceId: string, configPath: string): void {
    if (this.watchers.has(instanceId)) {
      console.log(chalk.yellow(`Already watching config for ${instanceId}`));
      return;
    }

    console.log(chalk.blue(`Watching config: ${configPath}`));

    const watcher = watch(configPath, async (eventType) => {
      if (eventType === 'change') {
        try {
          const config = await this.read(configPath);
          this.emit('change', instanceId, config);
        } catch (error: any) {
          console.error(chalk.red(`Error reading config: ${error.message}`));
          this.emit('error', instanceId, error);
        }
      }
    });

    this.watchers.set(instanceId, watcher);
  }

  unwatch(instanceId: string): void {
    const watcher = this.watchers.get(instanceId);
    if (watcher) {
      watcher.close();
      this.watchers.delete(instanceId);
      console.log(chalk.blue(`Stopped watching config for ${instanceId}`));
    }
  }

  unwatchAll(): void {
    for (const [instanceId] of this.watchers) {
      this.unwatch(instanceId);
    }
  }
}
