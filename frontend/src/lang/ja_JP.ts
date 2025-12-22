import type { Translation } from './en_US';

export const ja_JP: Translation = {
  // Header
  appTitle: 'BunProxy GUI',
  connected: '● 接続中',
  disconnected: '○ 切断',
  checkUpdates: '更新確認',
  latest: '最新',

  // Sidebar
  instances: 'インスタンス',
  createNewInstance: '新規インスタンス作成',
  instanceName: 'インスタンス名',
  platform: 'プラットフォーム',
  version: 'バージョン',
  createInstance: 'インスタンス作成',
  creating: '作成中...',

  // Platform options
  platformLinux: 'Linux',
  platformMacOS: 'macOS (ARM64)',
  platformWindows: 'Windows',

  // Instance status
  running: '🟢 実行中',
  stopped: '⚫ 停止中',

  // Instance actions
  start: '起動',
  stop: '停止',
  restart: '再起動',
  delete: '削除',

  // Content
  noSelection: 'サイドバーからインスタンスを選択するか、新規作成してください',
  consoleLogs: 'コンソールログ',
  configuration: '設定',
  saveConfig: '設定を保存',

  // Log types
  logStdout: '標準出力',
  logStderr: '標準エラー',
  logSystem: 'システム',

  // Messages
  confirmDelete: 'このインスタンスを削除してもよろしいですか？',
  configSaved: '設定が正常に保存されました！',
  allUpToDate: 'すべてのインスタンスは最新です！',
  updatesAvailable: '更新があります！最新バージョン:',

  // Errors
  errorCreateInstance: 'インスタンスの作成に失敗しました:',
  errorDeleteInstance: 'インスタンスの削除に失敗しました:',
  errorStartInstance: 'インスタンスの起動に失敗しました:',
  errorStopInstance: 'インスタンスの停止に失敗しました:',
  errorRestartInstance: 'インスタンスの再起動に失敗しました:',
  errorSaveConfig: '設定の保存に失敗しました:',
  errorCheckUpdates: '更新確認に失敗しました:',
  errorLoadInstances: 'インスタンスの読み込みに失敗しました:',
  errorLoadRelease: '最新リリースの読み込みに失敗しました:',
  errorLoadLogs: 'ログの読み込みに失敗しました:',
  errorLoadConfig: '設定の読み込みに失敗しました:',

  // Placeholders
  placeholderInstanceName: 'インスタンス名',
  placeholderVersion: 'バージョン (例: 0.0.5)',

  // Auth
  login: 'ログイン',
  logout: 'ログアウト',
  username: 'ユーザー名',
  password: 'パスワード',
  loginTitle: 'BunProxy GUI ログイン',
  loginButton: 'ログイン',
  setupTitle: '認証設定',
  setupDescription: 'BunProxy GUI を保護するためのアカウントを作成してください',
  setupButton: '設定',
  confirmPassword: 'パスワード確認',
  changePassword: 'パスワード変更',
  currentPassword: '現在のパスワード',
  newPassword: '新しいパスワード',
  passwordMismatch: 'パスワードが一致しません',
  passwordTooShort: 'パスワードは8文字以上必要です',
  loginFailed: 'ログインに失敗しました。認証情報を確認してください。',
  setupSuccess: '認証が正常に設定されました！',
  passwordChanged: 'パスワードが正常に変更されました！',
  securitySetup: 'セキュリティ設定',
  noAuthConfigured: '認証が設定されていません',
  setupAuthPrompt: '不正アクセスを防ぐため、ユーザー名とパスワードを設定してください。',
};
