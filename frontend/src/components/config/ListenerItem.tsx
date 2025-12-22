import React from 'react';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Switch } from '../ui/Switch';
import { Button } from '../ui/Button';
import type { ListenerConfig } from '../../api';
import { t } from '../../lang';

interface ListenerItemProps {
  index: number;
  listener: ListenerConfig;
  onChange: (field: string, value: any) => void;
  onTargetChange: (field: string, value: any) => void;
  onRemove?: () => void;
}

export const ListenerItem: React.FC<ListenerItemProps> = ({
  index,
  listener,
  onChange,
  onTargetChange,
  onRemove,
}) => {
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
          onChange={(e) => onChange('tcp', parseInt(e.target.value))}
        />
        <Input
          label="UDP Port"
          type="number"
          value={listener.udp || ''}
          onChange={(e) => onChange('udp', parseInt(e.target.value))}
        />
      </div>

      <div className="mt-4 mb-4">
        <Switch
          label="HAProxy Protocol"
          checked={listener.haproxy || false}
          onChange={(checked) => onChange('haproxy', checked)}
        />
      </div>

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
          onChange={(e) => onTargetChange('tcp', parseInt(e.target.value))}
        />
        <Input
          label="Target UDP Port"
          type="number"
          value={listener.target?.udp || ''}
          onChange={(e) => onTargetChange('udp', parseInt(e.target.value))}
        />
      </div>
    </Card>
  );
};
