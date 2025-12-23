import express from 'express';
import cookieParser from 'cookie-parser';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import chalk from 'chalk';
import { ServiceManager, BunProxyInstance } from './services.js';
import { ProcessManager } from './processManager.js';
import { ConfigManager } from './configManager.js';
import { AuthManager } from './authManager.js';
import {
  getLatestRelease,
  getReleaseByVersion,
  getAllReleases,
  isGitHubRateLimited,
  downloadBinary,
  setExecutablePermissions,
  getPlatformAssetName,
} from './downloader.js';



const PORT = process.env.PORT || 3000;
const WS_PORT = process.env.WS_PORT || 3001;

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const serviceManager = new ServiceManager();
const processManager = new ProcessManager();
const configManager = new ConfigManager();
const authManager = new AuthManager(serviceManager);

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(authManager.authMiddleware());

const isCompiled = Bun.main.endsWith('.exe') || (!Bun.main.includes('/src/') && !Bun.main.includes('\\src\\'));

//Bun compiledの場合
if (isCompiled) {

  await import('./embed-files.js');
  console.log(chalk.blue('Using embedded static files'));

  const staticRoutes: Record<string, Blob> = {};
  for (const blob of Bun.embeddedFiles) {
    // @ts-ignore - Bun.embeddedFiles contains Blobs with name property
    let name = blob.name as string;

    if (name.startsWith('public/')) {
      name = name.substring(7);
    }

    staticRoutes[`/${name}`] = blob;

    // Ensure common favicon paths are available for browsers that request .ico
    if (name === 'favicon.svg') {
      staticRoutes['/favicon.ico'] = blob;
      staticRoutes['/favicon.png'] = blob;
    }

    if (name.startsWith('index-')) {
      staticRoutes[`/assets/${name}`] = blob;
    }

    console.log(chalk.gray(`Embedded: /${name} (${blob.size} bytes)`));
  }

  app.use(async (req, res, next) => {
    let requestPath = req.path;

    // Redirect root to index.html
    if (requestPath === '/') {
      requestPath = '/index.html';
    }

    const blob = staticRoutes[requestPath];

    if (blob) {
      const content = await blob.arrayBuffer();
      const buffer = Buffer.from(content);

      // Set appropriate content type
      let contentType = 'application/octet-stream';
      if (requestPath.endsWith('.html')) contentType = 'text/html';
      else if (requestPath.endsWith('.js')) contentType = 'application/javascript';
      else if (requestPath.endsWith('.css')) contentType = 'text/css';
      else if (requestPath.endsWith('.json')) contentType = 'application/json';
      else if (requestPath.endsWith('.svg')) contentType = 'image/svg+xml';
      else if (requestPath.endsWith('.ico')) contentType = 'image/x-icon';
      else if (requestPath.endsWith('.png')) contentType = 'image/png';
      else if (requestPath.endsWith('.jpg') || requestPath.endsWith('.jpeg')) contentType = 'image/jpeg';

      res.setHeader('Content-Type', contentType);
      res.send(buffer);
    } else {
      next();
    }
  });
} else {
  // In development, serve from regular public directory
  console.log(chalk.blue('Using regular public directory'));
  app.use(express.static('public'));
}

// WebSocket connection handling
const clients: Set<WebSocket> = new Set();

wss.on('connection', (ws) => {
  console.log(chalk.green('WebSocket client connected'));
  clients.add(ws);

  ws.on('close', () => {
    console.log(chalk.yellow('WebSocket client disconnected'));
    clients.delete(ws);
  });

  // Send initial data
  ws.send(JSON.stringify({
    type: 'instances',
    data: serviceManager.getAll(),
  }));
});

// Broadcast to all connected clients
function broadcast(message: any) {
  const data = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// Process Manager event handlers
processManager.on('log', (instanceId: string, type: string, message: string) => {
  broadcast({
    type: 'log',
    instanceId,
    logType: type,
    message,
    timestamp: new Date().toISOString(),
  });
});

// Track restart attempts to avoid tight crash loops
const restartAttempts: Map<string, { count: number; firstAttemptAt: number }> = new Map();

processManager.on('exit', async (instanceId: string, code: number, signal: string) => {
  // Check if instance still exists before updating
  const instance = serviceManager.getById(instanceId);
  if (instance) {
    await serviceManager.setPid(instanceId, undefined);
  }

  broadcast({
    type: 'processExit',
    instanceId,
    code,
    signal,
  });

  // Broadcast updated instances list
  broadcast({
    type: 'instances',
    data: serviceManager.getAll(),
  });

  // Auto-restart logic
  try {
    if (instance && instance.autoRestart) {
      const now = Date.now();
      const info = restartAttempts.get(instanceId) || { count: 0, firstAttemptAt: now };

      // Reset counter if first attempt was long ago
      if (now - info.firstAttemptAt > 60_000) {
        info.count = 0;
        info.firstAttemptAt = now;
      }

      if (info.count >= 5) {
        // Too many attempts in a short time, give up and notify
        console.warn(`Auto-restart: giving up restarting ${instanceId} after ${info.count} attempts`);
        broadcast({ type: 'autoRestartFailed', instanceId, attempts: info.count });
        return;
      }

      info.count += 1;
      restartAttempts.set(instanceId, info);

      const backoffMs = 1000 * info.count; // 1s, 2s, 3s ...
      console.log(`Auto-restart: will attempt to restart ${instanceId} in ${backoffMs}ms (attempt ${info.count})`);
      setTimeout(async () => {
        try {
          // Re-read instance (it may have been deleted)
          const fresh = serviceManager.getById(instanceId);
          if (!fresh) return;

          // Don't restart if user stopped it manually (PID present or running)
          if (processManager.isRunning(instanceId)) {
            restartAttempts.delete(instanceId);
            return;
          }

          const pid = processManager.start(instanceId, {
            binaryPath: fresh.binaryPath,
            workingDirectory: fresh.dataDir,
          });

          await serviceManager.setPid(instanceId, pid);
          configManager.watch(instanceId, fresh.configPath);

          // Reset attempts on success
          restartAttempts.delete(instanceId);

          broadcast({ type: 'instanceStarted', instanceId, pid });
          broadcast({ type: 'instances', data: serviceManager.getAll() });
          console.log(`Auto-restart: restarted ${instanceId} (PID ${pid})`);
        } catch (err: any) {
          console.error(`Auto-restart: failed to restart ${instanceId}: ${err.message}`);
          // emit a system log entry via processManager 'log' event
          broadcast({ type: 'autoRestartError', instanceId, message: err.message });
        }
      }, backoffMs);
    }
  } catch (err: any) {
    console.error('Auto-restart: unexpected error', err.message);
  }
});

processManager.on('error', (instanceId: string, error: Error) => {
  broadcast({
    type: 'processError',
    instanceId,
    error: error.message,
  });
});

// Config Manager event handlers
configManager.on('change', (instanceId: string, config: any) => {
  broadcast({
    type: 'configChange',
    instanceId,
    config,
  });
});

// REST API Endpoints

// Auth endpoints
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const isValid = await serviceManager.verifyAuth(username, password);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = authManager.createSession(username);
    res.cookie('session', token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'strict',
    });

    res.json({ success: true, token });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies?.session || req.headers['x-session-token'];
  if (token) {
    authManager.deleteSession(token as string);
  }
  res.clearCookie('session');
  res.json({ success: true });
});

app.get('/api/auth/status', async (req, res) => {
  try {
    const hasAuth = serviceManager.hasAuth();
    const token = req.cookies?.session || req.headers['x-session-token'];
    const isAuthenticated = token ? authManager.validateSession(token as string) : false;

    res.json({
      hasAuth,
      isAuthenticated: !hasAuth || isAuthenticated,
      requireAuth: hasAuth && !isAuthenticated,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/setup', async (req, res) => {
  try {
    // Only allow setup if no auth is configured
    if (serviceManager.hasAuth()) {
      return res.status(403).json({ error: 'Auth already configured' });
    }

    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    await serviceManager.setAuth(username, password);

    const token = authManager.createSession(username);
    res.cookie('session', token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'strict',
    });

    res.json({ success: true, token });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/auth/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const auth = serviceManager.getAuth();
    if (!auth || auth.password !== currentPassword) {
      return res.status(401).json({ error: 'Invalid current password' });
    }

    await serviceManager.setAuth(auth.username, newPassword);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Expose system info (platform) to frontend so UI can default to the host OS
app.get('/api/system', async (req, res) => {
  try {
    // Map Node's process.platform and arch to the platform identifiers used by BunProxy releases
    let platform: 'linux' | 'darwin-arm64' | 'windows' = 'linux';

    if (process.platform === 'win32') {
      platform = 'windows';
    } else if (process.platform === 'darwin') {
      // Prefer darwin-arm64 when running on Apple Silicon
      platform = process.arch === 'arm64' ? 'darwin-arm64' : 'darwin-arm64';
    } else {
      platform = 'linux';
    }

    res.json({ platform, nodePlatform: process.platform, arch: process.arch });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all instances
app.get('/api/instances', async (req, res) => {
  try {
    const instances = serviceManager.getAll();
    res.json(instances);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single instance
app.get('/api/instances/:id', async (req, res) => {
  try {
    const instance = serviceManager.getById(req.params.id);
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    res.json(instance);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create new instance (download and setup)
app.post('/api/instances', async (req, res) => {
  try {
    let { name, platform, version } = req.body;

    if (!name || !platform || !version) {
      return res.status(400).json({ error: 'Missing required fields: name, platform, version' });
    }

    // Convert "latest" to actual version
    if (version === 'latest') {
      const latestRelease = await getLatestRelease();
      version = latestRelease.version;
    }

    const instanceId = randomUUID();
    const instanceDir = path.join(process.cwd(), 'instances', instanceId);
    const dataDir = path.join(instanceDir, 'data');
    const assetName = getPlatformAssetName(platform, version);
    const binaryPath = path.join(dataDir, assetName);
    const configPath = path.join(instanceDir, 'config.yml');

    // Get release info
    const release = await getReleaseByVersion(version);
    const asset = release.assets.find((a) => a.name === assetName);

    if (!asset) {
      return res.status(404).json({ error: `Asset ${assetName} not found in release ${version}` });
    }

    // Download binary
    await downloadBinary(asset.downloadUrl, binaryPath, (downloaded, total) => {
      broadcast({
        type: 'downloadProgress',
        instanceId,
        downloaded,
        total,
        percentage: Math.round((downloaded / total) * 100),
      });
    });

    // Set executable permissions
    await setExecutablePermissions(binaryPath);

    // Create instance metadata
    const instance: BunProxyInstance = {
      id: instanceId,
      name,
      version,
      platform,
      binaryPath,
      dataDir: instanceDir, // Working directory - config.ymlがここにある
      configPath,
      autoRestart: false,
      downloadSource: {
        url: asset.downloadUrl
      },
    };

    await serviceManager.add(instance);

    broadcast({
      type: 'instanceAdded',
      instance,
    });

    // 初回起動してBunProxyにconfig.ymlを生成させる
    console.log(chalk.blue(`Initializing instance ${instanceId}...`));
    broadcast({
      type: 'instanceInitializing',
      instanceId,
    });

    try {
      const pid = processManager.start(instanceId, {
        binaryPath: instance.binaryPath,
        workingDirectory: instance.dataDir,
      });

      // config.ymlが生成されるまで少し待つ
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 初期化完了後、停止
      if (processManager.isRunning(instanceId)) {
        processManager.stop(instanceId);
        console.log(chalk.green(`✓ Instance initialized and stopped`));
      }
    } catch (error: any) {
      console.warn(chalk.yellow(`Warning: Could not initialize instance: ${error.message}`));
    }

    broadcast({
      type: 'instanceInitialized',
      instanceId,
    });

    res.json(instance);
  } catch (error: any) {
    console.error(chalk.red(`Error creating instance: ${error.message}`));

    if (error.message && error.message.includes('rate limit')) {
      broadcast({
        type: 'rateLimitError',
        message: 'GitHub APIのレート制限に達しました。新規インスタンスの作成と更新確認ができません。しばらく待ってから再度試してください。',
      });
      return res.status(429).json({
        error: 'GitHub APIレート制限に達しました。新規インスタンスの作成ができません。',
        rateLimited: true,
      });
    }

    res.status(500).json({ error: error.message });
  }
});

// Delete instance
app.delete('/api/instances/:id', async (req, res) => {
  try {
    const instanceId = req.params.id;
    const instance = serviceManager.getById(instanceId);

    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    // Stop process if running
    if (processManager.isRunning(instanceId)) {
      processManager.stop(instanceId, true);
    }

    // Unwatch config
    configManager.unwatch(instanceId);

    // Remove from services
    await serviceManager.remove(instanceId);

    // Delete instance directory
    try {
      await fs.rm(instance.dataDir, { recursive: true, force: true });
      console.log(chalk.green(`✓ Deleted instance directory: ${instance.dataDir}`));
    } catch (error: any) {
      console.warn(chalk.yellow(`Warning: Could not delete instance directory: ${error.message}`));
    }

    broadcast({
      type: 'instanceRemoved',
      instanceId,
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Start instance
app.post('/api/instances/:id/start', async (req, res) => {
  try {
    const instanceId = req.params.id;
    const instance = serviceManager.getById(instanceId);

    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    if (processManager.isRunning(instanceId)) {
      return res.status(400).json({ error: 'Instance is already running' });
    }

    const pid = processManager.start(instanceId, {
      binaryPath: instance.binaryPath,
      workingDirectory: instance.dataDir,
    });

    await serviceManager.setPid(instanceId, pid);

    // Watch config file
    configManager.watch(instanceId, instance.configPath);

    broadcast({
      type: 'instanceStarted',
      instanceId,
      pid,
    });

    // Broadcast updated instances list
    broadcast({
      type: 'instances',
      data: serviceManager.getAll(),
    });

    res.json({ success: true, pid });
  } catch (error: any) {
    console.error('Start instance error:', error);
    res.status(500).json({ error: error.message, details: error.stack });
  }
});

// Stop instance
app.post('/api/instances/:id/stop', async (req, res) => {
  try {
    const instanceId = req.params.id;

    if (!processManager.isRunning(instanceId)) {
      return res.status(400).json({ error: 'Instance is not running' });
    }

    processManager.stop(instanceId);

    // Clear PID immediately
    await serviceManager.setPid(instanceId, undefined);

    // Unwatch config
    configManager.unwatch(instanceId);

    broadcast({
      type: 'instanceStopped',
      instanceId,
    });

    // Broadcast updated instances list
    broadcast({
      type: 'instances',
      data: serviceManager.getAll(),
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Restart instance
app.post('/api/instances/:id/restart', async (req, res) => {
  try {
    const instanceId = req.params.id;
    const instance = serviceManager.getById(instanceId);

    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    const pid = await processManager.restart(instanceId, {
      binaryPath: instance.binaryPath,
      workingDirectory: instance.dataDir,
    });

    await serviceManager.setPid(instanceId, pid);

    broadcast({
      type: 'instanceRestarted',
      instanceId,
      pid,
    });

    // Broadcast updated instances list
    broadcast({
      type: 'instances',
      data: serviceManager.getAll(),
    });

    res.json({ success: true, pid });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get instance logs
app.get('/api/instances/:id/logs', async (req, res) => {
  try {
    const instanceId = req.params.id;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const logs = processManager.getLogs(instanceId, limit);
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get instance config
app.get('/api/instances/:id/config', async (req, res) => {
  try {
    const instanceId = req.params.id;
    const instance = serviceManager.getById(instanceId);

    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    const config = await configManager.read(instance.configPath);
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get instance player IPs
app.get('/api/instances/:id/player-ips', async (req, res) => {
  try {
    const instanceId = req.params.id;
    const instance = serviceManager.getById(instanceId);

    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    // playerIP.jsonのパスを取得
    const playerIPPath = path.join(instance.dataDir, 'playerIP.json');

    try {
      // ファイルが存在するかチェック
      await fs.access(playerIPPath);

      // ファイルを読み込む
      const content = await fs.readFile(playerIPPath, 'utf-8');
      const playerIPs = JSON.parse(content);

      res.json(playerIPs);
    } catch (error: any) {
      // ファイルが存在しない、または読み込めない場合は空配列を返す
      if (error.code === 'ENOENT') {
        res.json([]);
      } else {
        throw error;
      }
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update instance metadata (e.g., name, autoRestart)
app.put('/api/instances/:id', async (req, res) => {
  try {
    const instanceId = req.params.id;
    const instance = serviceManager.getById(instanceId);

    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    const { name, autoRestart } = req.body as { name?: string; autoRestart?: boolean };

    const updates: any = {};
    if (typeof name === 'string') updates.name = name.trim();
    if (typeof autoRestart === 'boolean') updates.autoRestart = autoRestart;

    // If nothing to update
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    await serviceManager.update(instanceId, updates);

    broadcast({ type: 'instanceUpdated', instanceId, updates });

    // Broadcast updated instances list
    broadcast({ type: 'instances', data: serviceManager.getAll() });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update instance config
app.put('/api/instances/:id/config', async (req, res) => {
  try {
    const instanceId = req.params.id;
    const instance = serviceManager.getById(instanceId);

    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    const config = req.body;

    // Validate config
    const validation = await configManager.validate(config);
    if (!validation.valid) {
      return res.status(400).json({ errors: validation.errors });
    }

    await configManager.write(instance.configPath, config);

    broadcast({
      type: 'configUpdated',
      instanceId,
      config,
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Check for updates
app.get('/api/updates/check', async (req, res) => {
  try {
    const latestRelease = await getLatestRelease();
    const instances = serviceManager.getAll();

    const updates = instances.map((instance) => ({
      instanceId: instance.id,
      currentVersion: instance.version,
      latestVersion: latestRelease.version,
      hasUpdate: instance.version !== latestRelease.version,
      asset: latestRelease.assets.find((a) => a.name === getPlatformAssetName(instance.platform, latestRelease.version)),
    }));

    res.json({
      latestRelease,
      updates,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get available releases
app.get('/api/releases/latest', async (req, res) => {
  try {
    const release = await getLatestRelease();
    res.json(release);
  } catch (error: any) {
    console.error('Failed to fetch latest release:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/releases', async (req, res) => {
  try {
    const releases = await getAllReleases();
    res.json(releases);
  } catch (error: any) {
    console.error('Failed to fetch releases:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Check rate limit status
app.get('/api/rate-limit-status', async (req, res) => {
  try {
    const isLimited = isGitHubRateLimited();
    res.json({ rateLimited: isLimited });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update instance
app.post('/api/instances/:id/update', async (req, res) => {
  try {
    const instanceId = req.params.id;
    const { version } = req.body;

    const instance = serviceManager.getById(instanceId);
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    // インスタンスが起動中であれば、アップデート前に停止する
    if (processManager.isRunning(instanceId)) {
      console.log(chalk.blue(`Instance ${instanceId} is running — stopping before update...`));
      try {
        // 停止（強制フラグを true にして確実に停止させる）
        processManager.stop(instanceId, true);

        // PID をクリア
        await serviceManager.setPid(instanceId, undefined);

        // 設定ファイルのウォッチを解除
        configManager.unwatch(instanceId);

        // ブロードキャストで停止を通知
        broadcast({ type: 'instanceStopped', instanceId });
        broadcast({ type: 'instances', data: serviceManager.getAll() });

        // 少し待ってプロセスが完全に停止するのを待つ（最大で 2 秒）
        let wait = 0;
        while (processManager.isRunning(instanceId) && wait < 20) {
          // 100ms 毎に確認
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, 100));
          wait++;
        }
      } catch (err: any) {
        console.warn(chalk.yellow(`Warning: Failed to stop instance ${instanceId} before update: ${err?.message || err}`));
        // 停止に失敗した場合は処理を中断
        return res.status(500).json({ error: 'Failed to stop instance before update' });
      }
    }

    // Convert "latest" to actual version
    let targetVersion = version;
    if (version === 'latest') {
      const latestRelease = await getLatestRelease();
      targetVersion = latestRelease.version;
    }

    // すでに同じバージョンの場合はスキップ
    if (instance.version === targetVersion) {
      return res.status(400).json({ error: 'Instance is already on this version' });
    }

    const assetName = getPlatformAssetName(instance.platform, targetVersion);
    const binaryPath = path.join(instance.dataDir, 'data', assetName);

    // Get release info
    const release = await getReleaseByVersion(targetVersion);
    const asset = release.assets.find((a) => a.name === assetName);

    if (!asset) {
      return res.status(404).json({ error: `Asset ${assetName} not found in release ${targetVersion}` });
    }

    // 古いバイナリを削除
    try {
      await fs.rm(instance.binaryPath, { force: true });
      console.log(chalk.green(`✓ Removed old binary: ${instance.binaryPath}`));
    } catch (error: any) {
      console.warn(chalk.yellow(`Warning: Could not remove old binary: ${error.message}`));
    }

    // Download binary
    await downloadBinary(asset.downloadUrl, binaryPath, (downloaded, total) => {
      broadcast({
        type: 'updateProgress',
        instanceId,
        downloaded,
        total,
        percentage: Math.round((downloaded / total) * 100),
      });
    });

    // Set executable permissions
    await setExecutablePermissions(binaryPath);

    // Update instance metadata
    instance.version = targetVersion;
    instance.binaryPath = binaryPath;
    instance.downloadSource = {
      url: asset.downloadUrl
    };

    await serviceManager.update(instanceId, instance);

    broadcast({
      type: 'instanceUpdated',
      instanceId,
      version: targetVersion,
    });

    broadcast({
      type: 'instances',
      data: serviceManager.getAll(),
    });

    res.json({ success: true, version: targetVersion });
  } catch (error: any) {
    console.error(chalk.red(`Error updating instance: ${error.message}`));

    if (error.message && error.message.includes('rate limit')) {
      broadcast({
        type: 'rateLimitError',
        message: 'GitHub APIのレート制限に達しました。アップデートができません。しばらく待ってから再度試してください。',
      });
      return res.status(429).json({
        error: 'GitHub APIレート制限に達しました。アップデートができません。',
        rateLimited: true,
      });
    }

    res.status(500).json({ error: error.message });
  }
});

// Initialize
async function init() {
  try {
    console.log(chalk.blue('Initializing BunProxy GUI...'));

    // Load services
    await serviceManager.load();
    console.log(chalk.green(`✓ Loaded ${serviceManager.getAll().length} instances`));

    // Verify PIDs and clear stale ones
    const instances = serviceManager.getAll();
    for (const instance of instances) {
      if (instance.pid) {
        try {
          // Check if process is still running by sending signal 0 (no-op)
          process.kill(instance.pid, 0);
          console.log(chalk.gray(`  Instance ${instance.name} (PID: ${instance.pid}) is still running`));
        } catch (error) {
          // Process is not running, clear the PID
          console.log(chalk.yellow(`  Clearing stale PID for ${instance.name} (PID: ${instance.pid})`));
          await serviceManager.setPid(instance.id, undefined);
        }
      }
    }

    // Auto-start instances that have autoRestart enabled
    for (const instance of instances) {
      try {
        if (instance.autoRestart && !processManager.isRunning(instance.id)) {
          // Ensure binary exists
          try {
            await fs.access(instance.binaryPath);
          } catch (err) {
            console.log(chalk.yellow(`  Skipping auto-start for ${instance.name}: binary not found at ${instance.binaryPath}`));
            continue;
          }

          console.log(chalk.blue(`Auto-starting instance ${instance.name} (${instance.id})`));
          const pid = processManager.start(instance.id, {
            binaryPath: instance.binaryPath,
            workingDirectory: instance.dataDir,
          });

          await serviceManager.setPid(instance.id, pid);
          configManager.watch(instance.id, instance.configPath);

          broadcast({ type: 'instanceStarted', instanceId: instance.id, pid });
          broadcast({ type: 'instances', data: serviceManager.getAll() });
        }
      } catch (err: any) {
        console.warn(chalk.yellow(`  Failed to auto-start ${instance.name}: ${err?.message || err}`));
      }
    }

    // Start server
    server.listen(PORT, () => {
      console.log(chalk.green(`✓ Server running on port ${PORT}`));
      console.log(chalk.green(`✓ WebSocket server running on port ${PORT}`));
      console.log(chalk.blue(`\n  Local: http://localhost:${PORT}`));
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\nShutting down...'));
      processManager.stopAll();
      configManager.unwatchAll();
      await serviceManager.save();
      process.exit(0);
    });
  } catch (error: any) {
    console.error(chalk.red(`Initialization error: ${error.message}`));
    process.exit(1);
  }
}

init();
