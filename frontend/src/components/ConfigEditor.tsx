import { useState, useEffect } from 'react';
import type { BunProxyConfig } from '../api';
import { t } from '../lang';
import { GeneralSettings } from './config/GeneralSettings';
import { ListenerList } from './config/ListenerList';
import { Button } from './ui/Button';
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

  const handleChange = <K extends keyof BunProxyConfig>(field: K, value: BunProxyConfig[K]) => {
    const updated = { ...localConfig, [field]: value };
    setLocalConfig(updated);
    onChange(updated);
  };

  return (
    <div className="config-editor">
      {!showAdvanced ? (
        <>
          <GeneralSettings config={localConfig} onChange={handleChange} />
          <ListenerList
            listeners={localConfig.listeners || []}
            onChange={(listeners) => handleChange('listeners', listeners)}
          />
        </>
      ) : (
        <div className="json-editor">
          <textarea
            value={JSON.stringify(localConfig, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                setLocalConfig(parsed);
                onChange(parsed);
              } catch {
                //JSon parse error
              }
            }}
            rows={20}
            className="w-full p-4 bg-tertiary text-primary font-mono text-sm border border-border rounded-md focus:outline-none focus:border-primary"
          />
        </div>
      )}

      <div className="config-actions flex gap-4 mt-6">
        <Button
          variant="ghost"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? (t('showForm') || 'Show Form') : (t('showJson') || 'Show JSON')}
        </Button>
        <Button variant="primary" onClick={onSave} className="flex-1">
          {t('saveConfig')}
        </Button>
      </div>
    </div>
  );
}
