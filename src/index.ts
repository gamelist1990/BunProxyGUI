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
  verifySha256,
  setExecutablePermissions,
  getPlatformAssetName,
  getKnownSha256,
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
app.use(express.static('public'));

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

    // Verify SHA256
    const expectedSha256 = getKnownSha256(assetName);
    if (expectedSha256) {
      const isValid = await verifySha256(binaryPath, expectedSha256);
      if (!isValid) {
        return res.status(500).json({ error: 'SHA256 verification failed' });
      }
    }

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
        url: asset.downloadUrl,
        sha256: expectedSha256 || '',
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

    // Unwatch config
    configManager.unwatch(instanceId);

    broadcast({
      type: 'instanceStopped',
      instanceId,
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

// Initialize
async function init() {
  try {
    console.log(chalk.blue('Initializing BunProxy GUI...'));

    // Load services
    await serviceManager.load();
    console.log(chalk.green(`✓ Loaded ${serviceManager.getAll().length} instances`));

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
