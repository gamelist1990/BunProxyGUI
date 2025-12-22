export const en_US = {
  // Header
  appTitle: 'BunProxy GUI',
  connected: '● Connected',
  disconnected: '○ Disconnected',
  checkUpdates: 'Check Updates',
  latest: 'Latest',

  // Sidebar
  instances: 'Instances',
  createNewInstance: 'Create New Instance',
  instanceName: 'Instance name',
  platform: 'Platform',
  version: 'Version',
  createInstance: 'Create Instance',
  creating: 'Creating...',

  // Platform options
  platformLinux: 'Linux',
  platformMacOS: 'macOS (ARM64)',
  platformWindows: 'Windows',

  // Instance status
  running: '🟢 Running',
  stopped: '⚫ Stopped',

  // Instance actions
  start: 'Start',
  stop: 'Stop',
  restart: 'Restart',
  delete: 'Delete',

  // Content
  noSelection: 'Select an instance from the sidebar or create a new one',
  consoleLogs: 'Console Logs',
  configuration: 'Configuration',
  saveConfig: 'Save Config',

  // Log types
  logStdout: 'stdout',
  logStderr: 'stderr',
  logSystem: 'system',

  // Messages
  confirmDelete: 'Are you sure you want to delete this instance?',
  configSaved: 'Config saved successfully!',
  allUpToDate: 'All instances are up to date!',
  updatesAvailable: 'Updates available! Latest version:',

  // Errors
  errorCreateInstance: 'Failed to create instance:',
  errorDeleteInstance: 'Failed to delete instance:',
  errorStartInstance: 'Failed to start instance:',
  errorStopInstance: 'Failed to stop instance:',
  errorRestartInstance: 'Failed to restart instance:',
  errorSaveConfig: 'Failed to save config:',
  errorCheckUpdates: 'Failed to check updates:',
  errorLoadInstances: 'Failed to load instances:',
  errorLoadRelease: 'Failed to load latest release:',
  errorLoadLogs: 'Failed to load logs:',
  errorLoadConfig: 'Failed to load config:',

  // Placeholders
  placeholderInstanceName: 'Instance name',
  placeholderVersion: 'Version (e.g., 0.0.5)',

  // Auth
  login: 'Login',
  logout: 'Logout',
  username: 'Username',
  password: 'Password',
  loginTitle: 'Login to BunProxy GUI',
  loginButton: 'Login',
  setupTitle: 'Setup Authentication',
  setupDescription: 'Create an account to secure your BunProxy GUI',
  setupButton: 'Setup',
  confirmPassword: 'Confirm Password',
  changePassword: 'Change Password',
  currentPassword: 'Current Password',
  newPassword: 'New Password',
  passwordMismatch: 'Passwords do not match',
  passwordTooShort: 'Password must be at least 8 characters',
  loginFailed: 'Login failed. Please check your credentials.',
  setupSuccess: 'Authentication setup successfully!',
  passwordChanged: 'Password changed successfully!',
  securitySetup: 'Security Setup',
  noAuthConfigured: 'No authentication configured',
  setupAuthPrompt: 'Please set up a username and password to prevent unauthorized access.',
};

export type Translation = typeof en_US;
