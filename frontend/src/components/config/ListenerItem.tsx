import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Switch } from '../ui/Switch';
import { Button } from '../ui/Button';
import { uploadListenerTlsAssets, type ListenerConfig } from '../../api';
import { t } from '../../lang';

interface ListenerItemProps {
  instanceId: string;
  index: number;
  listener: ListenerConfig;
  onChange: (field: string, value: any) => void;
  onTargetChange: (field: string, value: any) => void;
  onRemove?: () => void;
}

export const ListenerItem: React.FC<ListenerItemProps> = ({
  instanceId,
  index,
  listener,
  onChange,
  onTargetChange,
  onRemove,
}) => {
  const [certFile, setCertFile] = useState<File | null>(null);
  const [keyFile, setKeyFile] = useState<File | null>(null);

  const normalizeNumericValue = (value: string) => {
    if (value.trim() === '') {
      return undefined;
    }
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  };

  const handleTlsBundleUpload = async (certFile: File | null, keyFile: File | null) => {
    if (!certFile || !keyFile) {
      alert(t('selectCertAndKey') || 'Select both certificate and key files.');
      return;
    }

    try {
      const [certPem, keyPem] = await Promise.all([certFile.text(), keyFile.text()]);
      const uploaded = await uploadListenerTlsAssets(instanceId, index, { certPem, keyPem });
      onChange('https', {
        ...listener.https,
        enabled: true,
        certPath: uploaded.certPath,
        keyPath: uploaded.keyPath,
      });
      setCertFile(null);
      setKeyFile(null);
      alert(t('tlsUploadSuccess') || 'TLS files uploaded successfully.');
    } catch (error: any) {
      alert(`${t('tlsUploadFailed') || 'Failed to upload TLS files:'} ${error.message}`);
    }
  };

  return (
    <Card
      title={`Listener #${index + 1}`}
      actions={
        onRemove ? (
          <Button variant="danger" onClick={onRemove} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
            {t('delete') || 'Delete'}
          </Button>
        ) : undefined
      }
    >
      <div className="ui-grid">
        <Input
          label={t('bindAddress') || 'Bind Address'}
          value={listener.bind || ''}
          onChange={(e) => onChange('bind', e.target.value)}
          placeholder="0.0.0.0"
        />
        <Input
          label="TCP Port"
          type="number"
          value={listener.tcp || ''}
          onChange={(e) => onChange('tcp', normalizeNumericValue(e.target.value))}
        />
        <Input
          label="UDP Port"
          type="number"
          value={listener.udp || ''}
          onChange={(e) => onChange('udp', normalizeNumericValue(e.target.value))}
        />
      </div>

      <div className="mt-4 mb-4">
        <Switch
          label="HAProxy Protocol"
          checked={listener.haproxy || false}
          onChange={(checked) => onChange('haproxy', checked)}
        />
      </div>

      <div className="mt-4 mb-4">
        <Switch
          label={t('enableHttpsListener') || 'Enable HTTPS Listener'}
          checked={listener.https?.enabled || false}
          onChange={(checked) => onChange('https', {
            enabled: checked,
            autoDetect: listener.https?.autoDetect ?? true,
            letsEncryptDomain: listener.https?.letsEncryptDomain || 'pexserver.mooo.com',
            certPath: listener.https?.certPath || '',
            keyPath: listener.https?.keyPath || '',
          })}
        />
      </div>

      {listener.https?.enabled && (
        <>
          <div className="ui-grid">
            <Switch
              label={t('autoDetectLetsEncrypt') || 'Auto-detect Let\'s Encrypt'}
              checked={listener.https?.autoDetect ?? true}
              onChange={(checked) => onChange('https', {
                ...listener.https,
                enabled: true,
                autoDetect: checked,
              })}
            />
            <Input
              label={t('letsEncryptDomain') || 'Let\'s Encrypt Domain'}
              value={listener.https?.letsEncryptDomain || ''}
              onChange={(e) => onChange('https', {
                ...listener.https,
                enabled: true,
                letsEncryptDomain: e.target.value,
              })}
              placeholder="pexserver.mooo.com"
            />
          </div>

          <div className="ui-grid">
            <Input
              label={t('tlsCertPath') || 'TLS Certificate Path'}
              value={listener.https?.certPath || ''}
              onChange={(e) => onChange('https', {
                ...listener.https,
                enabled: true,
                certPath: e.target.value,
              })}
              placeholder="/etc/letsencrypt/live/pexserver.mooo.com/fullchain.pem"
            />
            <Input
              label={t('tlsKeyPath') || 'TLS Private Key Path'}
              value={listener.https?.keyPath || ''}
              onChange={(e) => onChange('https', {
                ...listener.https,
                enabled: true,
                keyPath: e.target.value,
              })}
              placeholder="/etc/letsencrypt/live/pexserver.mooo.com/privkey.pem"
            />
          </div>

          <div className="ui-divider">
            <span className="ui-divider-label">{t('tlsUploadSection') || 'TLS Upload'}</span>
          </div>

          <div className="ui-grid">
            <Input
              label={t('tlsCertFile') || 'Certificate PEM'}
              type="file"
              accept=".pem,.crt,.cer"
              onChange={(e) => {
                setCertFile(e.target.files?.[0] ?? null);
              }}
            />
            <Input
              label={t('tlsKeyFile') || 'Private Key PEM'}
              type="file"
              accept=".pem,.key"
              onChange={(e) => {
                setKeyFile(e.target.files?.[0] ?? null);
              }}
            />
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              void handleTlsBundleUpload(certFile, keyFile);
            }}
          >
            {t('uploadTlsFiles') || 'Upload TLS Files'}
          </Button>
          <p className="ui-help-text">
            {t('tlsUploadHint') || 'Uploading PEM files stores them inside this instance and fills the cert/key paths automatically.'}
          </p>
        </>
      )}

      <Input
        label="Webhook URL"
        value={listener.webhook || ''}
        onChange={(e) => onChange('webhook', e.target.value)}
        placeholder="https://discord.com/api/webhooks/..."
        fullWidth
      />

      <div className="ui-divider">
        <span className="ui-divider-label">{t('targetServer') || 'Target Server'}</span>
      </div>

      <div className="ui-grid">
        <Input
          label={t('targetHost') || 'Target Host'}
          value={listener.target?.host || ''}
          onChange={(e) => onTargetChange('host', e.target.value)}
          placeholder="localhost"
        />
        <Input
          label="Target TCP Port"
          type="number"
          value={listener.target?.tcp || ''}
          onChange={(e) => onTargetChange('tcp', normalizeNumericValue(e.target.value))}
        />
        <Input
          label="Target UDP Port"
          type="number"
          value={listener.target?.udp || ''}
          onChange={(e) => onTargetChange('udp', normalizeNumericValue(e.target.value))}
        />
      </div>
    </Card>
  );
};
