import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface BunProxyInstance {
  id: string;
  name: string;
  version: string;
  platform: 'linux' | 'darwin-arm64' | 'windows';
  binaryPath: string;
  dataDir: string;
  configPath: string;
  pid?: number;
  lastStarted?: string;
  autoRestart: boolean;
  downloadSource: {
    url: string;
    sha256: string;
  };
}

export interface ServicesData {
  instances: BunProxyInstance[];
  lastUpdated: string;
  auth?: {
    username: string;
    password: string;
  };
}

export class ServiceManager {
  private servicesPath: string;
  private data: ServicesData;

  constructor(servicesPath?: string) {
    this.servicesPath = servicesPath || path.join(process.cwd(), 'services.json');
    this.data = { instances: [], lastUpdated: new Date().toISOString() };
  }

  async load(): Promise<void> {
    try {
      const content = await fs.readFile(this.servicesPath, 'utf-8');
      this.data = JSON.parse(content);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, create with defaults
        await this.save();
      } else {
        throw error;
      }
    }
  }

  async save(): Promise<void> {
    this.data.lastUpdated = new Date().toISOString();
    await fs.writeFile(this.servicesPath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  getAll(): BunProxyInstance[] {
    return this.data.instances;
  }

  getById(id: string): BunProxyInstance | undefined {
    return this.data.instances.find(instance => instance.id === id);
  }

  async add(instance: BunProxyInstance): Promise<void> {
    // Check if ID already exists
    if (this.getById(instance.id)) {
      throw new Error(`Instance with ID ${instance.id} already exists`);
    }
    this.data.instances.push(instance);
    await this.save();
  }

  async update(id: string, updates: Partial<BunProxyInstance>): Promise<void> {
    const index = this.data.instances.findIndex(instance => instance.id === id);
    if (index === -1) {
      throw new Error(`Instance with ID ${id} not found`);
    }
    this.data.instances[index] = { ...this.data.instances[index], ...updates };
    await this.save();
  }

  async remove(id: string): Promise<void> {
    const index = this.data.instances.findIndex(instance => instance.id === id);
    if (index === -1) {
      throw new Error(`Instance with ID ${id} not found`);
    }
    this.data.instances.splice(index, 1);
    await this.save();
  }

  async setPid(id: string, pid: number | undefined): Promise<void> {
    await this.update(id, { pid, lastStarted: pid ? new Date().toISOString() : undefined });
  }

  getAuth(): { username: string; password: string } | undefined {
    return this.data.auth;
  }

  async setAuth(username: string, password: string): Promise<void> {
    this.data.auth = { username, password };
    await this.save();
  }

  async verifyAuth(username: string, password: string): Promise<boolean> {
    if (!this.data.auth) {
      return true; // No auth configured, allow access
    }
    return this.data.auth.username === username && this.data.auth.password === password;
  }

  hasAuth(): boolean {
    return !!this.data.auth;
  }
}
