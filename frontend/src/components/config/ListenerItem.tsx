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
  onTargetsChange: (targets: NonNullable<ListenerConfig['targets']>) => void;
  onRemove?: () => void;
}

const createEmptyTarget = () => ({
  host: '',
  tcp: undefined,
  udp: undefined,
});

const parseOptionalPort = (value: string): number | undefined => {
  if (value.trim() === '') {
    return undefined;
  }
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

export const ListenerItem: React.FC<ListenerItemProps> = ({
  index,
  listener,
  onChange,
  onTargetsChange,
  onRemove,
}) => {
  const targets = listener.targets && listener.targets.length > 0
    ? listener.targets
    : listener.target
      ? [listener.target]
      : [createEmptyTarget()];

  const handleTargetChange = (targetIndex: number, field: 'host' | 'tcp' | 'udp', value: string | number | undefined) => {
    const nextTargets = targets.map((target, index) => (
      index === targetIndex ? { ...target, [field]: value } : target
    ));
    onTargetsChange(nextTargets);
  };

  const addTarget = () => {
    onTargetsChange([...targets, createEmptyTarget()]);
  };

  const removeTarget = (targetIndex: number) => {
    const nextTargets = targets.filter((_, index) => index !== targetIndex);
    onTargetsChange(nextTargets.length > 0 ? nextTargets : [createEmptyTarget()]);
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
          onChange={(e) => onChange('tcp', parseOptionalPort(e.target.value))}
        />
        <Input
          label="UDP Port"
          type="number"
          value={listener.udp || ''}
          onChange={(e) => onChange('udp', parseOptionalPort(e.target.value))}
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
        <span className="ui-divider-label">{t('targetServers') || 'Target Servers'}</span>
      </div>

      <p className="text-sm text-secondary mb-4">
        {t('fallbackOrder') || 'Targets are tried in order. If the first target fails, the next target is used.'}
      </p>

      {targets.map((target, targetIndex) => (
        <div key={targetIndex} className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <strong className="text-primary">
              {(t('targetServer') || 'Target Server')} #{targetIndex + 1}
            </strong>
            {targets.length > 1 && (
              <Button
                variant="danger"
                onClick={() => removeTarget(targetIndex)}
                style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem' }}
              >
                {t('removeTargetServer') || 'Remove Target'}
              </Button>
            )}
          </div>
          <div className="ui-grid">
            <Input
              label={t('targetHost') || 'Target Host'}
              value={target.host || ''}
              onChange={(e) => handleTargetChange(targetIndex, 'host', e.target.value)}
              placeholder="localhost"
            />
            <Input
              label="Target TCP Port"
              type="number"
              value={target.tcp || ''}
              onChange={(e) => handleTargetChange(targetIndex, 'tcp', parseOptionalPort(e.target.value))}
            />
            <Input
              label="Target UDP Port"
              type="number"
              value={target.udp || ''}
              onChange={(e) => handleTargetChange(targetIndex, 'udp', parseOptionalPort(e.target.value))}
            />
          </div>
        </div>
      ))}

      <Button variant="ghost" onClick={addTarget}>
        + {t('addTargetServer') || 'Add Target Server'}
      </Button>
    </Card>
  );
};
