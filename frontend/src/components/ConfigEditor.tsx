import { useState, useEffect } from 'react';
import type { BunProxyConfig } from '../api';
import { t } from '../lang';
import './ConfigEditor.css';

interface ConfigEditorProps {
  config: BunProxyConfig;
  onChange: (config: BunProxyConfig) => void;
  onSave: () => void;
}

export function ConfigEditor({ config, onChange, onSave }: ConfigEditorProps) {
  const [localConfig, setLocalConfig] = useState<BunProxyConfig>(config);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleChange = (field: keyof BunProxyConfig, value: any) => {
    const updated = { ...localConfig, [field]: value };
    setLocalConfig(updated);
    onChange(updated);
  };

  const handleListenerChange = (index: number, field: string, value: any) => {
    const listeners = [...(localConfig.listeners || [])];
    listeners[index] = { ...listeners[index], [field]: value };
    handleChange('listeners', listeners);
  };

  const handleTargetChange = (index: number, field: string, value: any) => {
    const listeners = [...(localConfig.listeners || [])];
    listeners[index] = {
      ...listeners[index],
      target: { ...listeners[index].target, [field]: value }
    };
    handleChange('listeners', listeners);
  };

  const addListener = () => {
    const listeners = [...(localConfig.listeners || [])];
    listeners.push({
      bind: '0.0.0.0',
      tcp: 25565,
      udp: 25565,
      haproxy: false,
      webhook: '',
      target: {
        host: 'localhost',
        tcp: 19132,
        udp: 19132,
      },
    });
    handleChange('listeners', listeners);
  };

  const removeListener = (index: number) => {
    const listeners = [...(localConfig.listeners || [])];
    listeners.splice(index, 1);
    handleChange('listeners', listeners);
  };

  return (
    <div className="config-editor">
      <div className="config-section">
        <h4>基本設定</h4>
        
        <div className="form-row">
          <label>
            <span>REST API</span>
            <input
              type="checkbox"
              checked={localConfig.useRestApi || false}
              onChange={(e) => handleChange('useRestApi', e.target.checked)}
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            <span>エンドポイントポート</span>
            <input
              type="number"
              value={localConfig.endpoint || 6000}
              onChange={(e) => handleChange('endpoint', parseInt(e.target.value))}
              min="1"
              max="65535"
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            <span>プレイヤーIPを保存</span>
            <input
              type="checkbox"
              checked={localConfig.savePlayerIP || false}
              onChange={(e) => handleChange('savePlayerIP', e.target.checked)}
            />
          </label>
        </div>
      </div>

      <div className="config-section">
        <h4>リスナー設定</h4>
        
        {(localConfig.listeners || []).map((listener, index) => (
          <div key={index} className="listener-card">
            <div className="listener-header">
              <h5>リスナー {index + 1}</h5>
              <button
                type="button"
                className="btn-remove"
                onClick={() => removeListener(index)}
              >
                削除
              </button>
            </div>

            <div className="form-grid">
              <div className="form-row">
                <label>
                  <span>バインドアドレス</span>
                  <input
                    type="text"
                    value={listener.bind || ''}
                    onChange={(e) => handleListenerChange(index, 'bind', e.target.value)}
                    placeholder="0.0.0.0"
                  />
                </label>
              </div>

              <div className="form-row">
                <label>
                  <span>TCPポート</span>
                  <input
                    type="number"
                    value={listener.tcp || ''}
                    onChange={(e) => handleListenerChange(index, 'tcp', parseInt(e.target.value))}
                    min="1"
                    max="65535"
                  />
                </label>
              </div>

              <div className="form-row">
                <label>
                  <span>UDPポート</span>
                  <input
                    type="number"
                    value={listener.udp || ''}
                    onChange={(e) => handleListenerChange(index, 'udp', parseInt(e.target.value))}
                    min="1"
                    max="65535"
                  />
                </label>
              </div>

              <div className="form-row">
                <label>
                  <span>HAProxy</span>
                  <input
                    type="checkbox"
                    checked={listener.haproxy || false}
                    onChange={(e) => handleListenerChange(index, 'haproxy', e.target.checked)}
                  />
                </label>
              </div>
            </div>

            <div className="form-row">
              <label>
                <span>Webhook URL</span>
                <input
                  type="text"
                  value={listener.webhook || ''}
                  onChange={(e) => handleListenerChange(index, 'webhook', e.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                />
              </label>
            </div>

            <div className="target-section">
              <h6>ターゲットサーバー</h6>
              <div className="form-grid">
                <div className="form-row">
                  <label>
                    <span>ホスト</span>
                    <input
                      type="text"
                      value={listener.target?.host || ''}
                      onChange={(e) => handleTargetChange(index, 'host', e.target.value)}
                      placeholder="localhost"
                    />
                  </label>
                </div>

                <div className="form-row">
                  <label>
                    <span>TCPポート</span>
                    <input
                      type="number"
                      value={listener.target?.tcp || ''}
                      onChange={(e) => handleTargetChange(index, 'tcp', parseInt(e.target.value))}
                      min="1"
                      max="65535"
                    />
                  </label>
                </div>

                <div className="form-row">
                  <label>
                    <span>UDPポート</span>
                    <input
                      type="number"
                      value={listener.target?.udp || ''}
                      onChange={(e) => handleTargetChange(index, 'udp', parseInt(e.target.value))}
                      min="1"
                      max="65535"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        ))}

        <button type="button" className="btn-add" onClick={addListener}>
          + リスナーを追加
        </button>
      </div>

      <div className="config-actions">
        <button
          type="button"
          className="btn-advanced"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? 'フォーム表示' : 'JSON表示'}
        </button>
        <button type="button" className="btn-save" onClick={onSave}>
          {t('saveConfig')}
        </button>
      </div>

      {showAdvanced && (
        <div className="json-editor">
          <textarea
            value={JSON.stringify(localConfig, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                setLocalConfig(parsed);
                onChange(parsed);
              } catch {}
            }}
            rows={20}
          />
        </div>
      )}
    </div>
  );
}
