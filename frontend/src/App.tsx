import { useState, useEffect } from 'react';
import './App.css';
import { useWebSocket } from './useWebSocket';
import type { BunProxyInstance, LogEntry, BunProxyConfig, AuthStatus } from './api';
import {
  fetchInstances,
  createInstance,
  deleteInstance,
  startInstance,
  stopInstance,
  restartInstance,
  fetchLogs,
  fetchConfig,
  updateConfig,
  checkUpdates,
  fetchLatestRelease,
  checkAuthStatus,
  login,
  logout,
  setupAuth,
} from './api';
import { t, setLanguage, getLanguage, type Language } from './lang';
import { Login } from './components/Login';
import { ConfigEditor } from './components/ConfigEditor';
import { formatLogMessage } from './utils/ansi';

function App() {
  const [instances, setInstances] = useState<BunProxyInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [config, setConfig] = useState<BunProxyConfig | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string>('');
  const [language, setLang] = useState<Language>(getLanguage());
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  
  const [newInstanceForm, setNewInstanceForm] = useState({
    name: '',
    platform: 'linux' as 'linux' | 'darwin-arm64' | 'windows',
    version: '0.0.5',
  });

  const { isConnected, on } = useWebSocket('ws://localhost:3000');

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    setLang(lang);
  };

  // Check auth status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const status = await checkAuthStatus();
      setAuthStatus(status);
      setAuthChecked(true);
      
      if (status.isAuthenticated) {
        loadInstances();
        loadLatestRelease();
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setAuthChecked(true);
    }
  }

  async function handleLogin(username: string, password: string) {
    if (!authStatus) return;

    if (authStatus.hasAuth) {
      await login(username, password);
    } else {
      await setupAuth(username, password);
    }
    
    await checkAuth();
  }

  async function handleLogout() {
    await logout();
    setAuthStatus({ hasAuth: true, isAuthenticated: false, requireAuth: true });
    setInstances([]);
    setSelectedInstance(null);
  }

  // Load instances on mount
  useEffect(() => {
    if (authStatus?.isAuthenticated) {
      loadInstances();
      loadLatestRelease();
    }
  }, [authStatus]);

  // WebSocket listeners
  useEffect(() => {
    const unsubscribes = [
      on('instances', (data: any) => setInstances(data.data)),
      on('instanceAdded', () => loadInstances()),
      on('instanceRemoved', () => loadInstances()),
      on('instanceStarted', () => loadInstances()),
      on('instanceStopped', () => loadInstances()),
      on('instanceRestarted', () => loadInstances()),
      on('log', (data: any) => {
        if (data.instanceId === selectedInstance) {
          setLogs((prev) => [
            ...prev,
            { timestamp: data.timestamp, type: data.logType, message: data.message },
          ]);
        }
      }),
      on('configUpdated', (data: any) => {
        if (data.instanceId === selectedInstance) {
          setConfig(data.config);
        }
      }),
    ];

    return () => unsubscribes.forEach((unsub) => unsub());
  }, [on, selectedInstance]);

  // Load selected instance logs and config
  useEffect(() => {
    if (selectedInstance) {
      loadLogs(selectedInstance);
      loadConfig(selectedInstance);
    }
  }, [selectedInstance]);

  async function loadInstances() {
    try {
      const data = await fetchInstances();
      setInstances(data);
    } catch (error) {
      console.error(t('errorLoadInstances'), error);
    }
  }

  async function loadLatestRelease() {
    try {
      const release = await fetchLatestRelease();
      setLatestVersion(release.version);
    } catch (error) {
      console.error(t('errorLoadRelease'), error);
    }
  }

  async function loadLogs(instanceId: string) {
    try {
      const data = await fetchLogs(instanceId, 100);
      setLogs(data);
    } catch (error) {
      console.error(t('errorLoadLogs'), error);
    }
  }

  async function loadConfig(instanceId: string) {
    try {
      const data = await fetchConfig(instanceId);
      setConfig(data);
    } catch (error) {
      console.error(t('errorLoadConfig'), error);
    }
  }

  async function handleCreateInstance() {
    try {
      setIsCreating(true);
      await createInstance(newInstanceForm);
      setNewInstanceForm({ name: '', platform: 'linux', version: '0.0.5' });
      await loadInstances();
    } catch (error: any) {
      alert(`${t('errorCreateInstance')} ${error.message}`);
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDeleteInstance(id: string) {
    if (!confirm(t('confirmDelete'))) return;
    
    try {
      await deleteInstance(id);
      if (selectedInstance === id) {
        setSelectedInstance(null);
      }
    } catch (error: any) {
      alert(`${t('errorDeleteInstance')} ${error.message}`);
    }
  }

  async function handleStartInstance(id: string) {
    try {
      await startInstance(id);
    } catch (error: any) {
      alert(`${t('errorStartInstance')} ${error.message}`);
    }
  }

  async function handleStopInstance(id: string) {
    try {
      await stopInstance(id);
    } catch (error: any) {
      alert(`${t('errorStopInstance')} ${error.message}`);
    }
  }

  async function handleRestartInstance(id: string) {
    try {
      await restartInstance(id);
    } catch (error: any) {
      alert(`${t('errorRestartInstance')} ${error.message}`);
    }
  }

  async function handleSaveConfig() {
    if (!selectedInstance || !config) return;

    try {
      await updateConfig(selectedInstance, config);
      alert(t('configSaved'));
    } catch (error: any) {
      alert(`${t('errorSaveConfig')} ${error.message}`);
    }
  }

  async function handleCheckUpdates() {
    try {
      const data = await checkUpdates();
      const hasUpdates = data.updates.some((u: any) => u.hasUpdate);
      if (hasUpdates) {
        alert(`${t('updatesAvailable')} ${data.latestRelease.version}`);
      } else {
        alert(t('allUpToDate'));
      }
    } catch (error: any) {
      alert(`${t('errorCheckUpdates')} ${error.message}`);
    }
  }

  const selectedInstanceData = instances.find((i) => i.id === selectedInstance);

  // Show loading while checking auth
  if (!authChecked) {
    return (
      <div className="app loading">
        <p>Loading...</p>
      </div>
    );
  }

  // Show login if auth is required
  if (authStatus?.requireAuth || (authStatus?.hasAuth && !authStatus?.isAuthenticated)) {
    return <Login onLogin={handleLogin} isSetup={!authStatus?.hasAuth} />;
  }

  // Show setup prompt if no auth configured
  if (!authStatus?.hasAuth && authStatus?.isAuthenticated) {
    return (
      <div className="app setup-prompt">
        <div className="setup-card">
          <h2>🔒 {t('securitySetup')}</h2>
          <p>{t('noAuthConfigured')}</p>
          <p>{t('setupAuthPrompt')}</p>
          <Login onLogin={handleLogin} isSetup={true} />
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <h1>{t('appTitle')}</h1>
        <div className="connection-status">
          <span className={isConnected ? 'connected' : 'disconnected'}>
            {isConnected ? t('connected') : t('disconnected')}
          </span>
          <select value={language} onChange={(e) => handleLanguageChange(e.target.value as Language)}>
            <option value="ja_JP">日本語</option>
            <option value="en_US">English</option>
          </select>
          <button onClick={handleCheckUpdates}>{t('checkUpdates')}</button>
          {latestVersion && <span>{t('latest')}: v{latestVersion}</span>}
          {authStatus?.hasAuth && (
            <button onClick={handleLogout} className="logout-btn">{t('logout')}</button>
          )}
        </div>
      </header>

      <div className="main-container">
        <aside className="sidebar">
          <h2>{t('instances')}</h2>
          <div className="instance-list">
            {instances.map((instance) => (
              <div
                key={instance.id}
                className={`instance-item ${selectedInstance === instance.id ? 'selected' : ''}`}
                onClick={() => setSelectedInstance(instance.id)}
              >
                <div className="instance-info">
                  <strong>{instance.name}</strong>
                  <span className="instance-status">
                    {instance.pid ? t('running') : t('stopped')}
                  </span>
                  <small>{instance.platform} v{instance.version}</small>
                </div>
              </div>
            ))}
          </div>

          <div className="create-instance">
            <h3>{t('createNewInstance')}</h3>
            <input
              type="text"
              placeholder={t('placeholderInstanceName')}
              value={newInstanceForm.name}
              onChange={(e) => setNewInstanceForm({ ...newInstanceForm, name: e.target.value })}
            />
            <select
              value={newInstanceForm.platform}
              onChange={(e) => setNewInstanceForm({ ...newInstanceForm, platform: e.target.value as any })}
            >
              <option value="linux">{t('platformLinux')}</option>
              <option value="darwin-arm64">{t('platformMacOS')}</option>
              <option value="windows">{t('platformWindows')}</option>
            </select>
            <input
              type="text"
              placeholder={t('placeholderVersion')}
              value={newInstanceForm.version}
              onChange={(e) => setNewInstanceForm({ ...newInstanceForm, version: e.target.value })}
            />
            <button onClick={handleCreateInstance} disabled={isCreating || !newInstanceForm.name}>
              {isCreating ? t('creating') : t('createInstance')}
            </button>
          </div>
        </aside>

        <main className="content">
          {selectedInstanceData ? (
            <>
              <div className="instance-header">
                <h2>{selectedInstanceData.name}</h2>
                <div className="instance-actions">
                  {selectedInstanceData.pid ? (
                    <>
                      <button onClick={() => handleStopInstance(selectedInstanceData.id)}>{t('stop')}</button>
                      <button onClick={() => handleRestartInstance(selectedInstanceData.id)}>{t('restart')}</button>
                    </>
                  ) : (
                    <button onClick={() => handleStartInstance(selectedInstanceData.id)}>{t('start')}</button>
                  )}
                  <button onClick={() => handleDeleteInstance(selectedInstanceData.id)} className="danger">
                    {t('delete')}
                  </button>
                </div>
              </div>

              <div className="tabs">
                <div className="tab-content">
                  <section className="console">
                    <h3>{t('consoleLogs')}</h3>
                    <div className="log-container">
                      {logs.map((log, i) => (
                        <div key={i} className={`log-entry log-${log.type}`}>
                          <span className="log-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                          <span className="log-type">[{log.type === 'stdout' ? t('logStdout') : log.type === 'stderr' ? t('logStderr') : t('logSystem')}]</span>
                          <span 
                            className="log-message"
                            dangerouslySetInnerHTML={{ __html: formatLogMessage(log.message) }}
                          />
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="config">
                    <h3>{t('configuration')}</h3>
                    {config && (
                      <ConfigEditor 
                        config={config}
                        onChange={setConfig}
                        onSave={handleSaveConfig}
                      />
                    )}
                  </section>
                </div>
              </div>
            </>
          ) : (
            <div className="no-selection">
              <p>{t('noSelection')}</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
