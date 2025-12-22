import React from 'react';
import { ListenerItem } from './ListenerItem';
import { Button } from '../ui/Button';
import type { ListenerConfig } from '../../api';
import { t } from '../../lang';

interface ListenerListProps {
  listeners: ListenerConfig[];
  onChange: (listeners: ListenerConfig[]) => void;
}

export const ListenerList: React.FC<ListenerListProps> = ({ listeners, onChange }) => {
  const handleListenerChange = (index: number, field: string, value: any) => {
    const newListeners = [...listeners];
    newListeners[index] = { ...newListeners[index], [field]: value };
    onChange(newListeners);
  };

  const handleTargetChange = (index: number, field: string, value: any) => {
    const newListeners = [...listeners];
    newListeners[index] = {
      ...newListeners[index],
      target: { ...newListeners[index].target, [field]: value },
    };
    onChange(newListeners);
  };

  const addListener = () => {
    const newListeners = [...listeners];
    newListeners.push({
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
    onChange(newListeners);
  };

  const removeListener = (index: number) => {
    const newListeners = [...listeners];
    newListeners.splice(index, 1);
    onChange(newListeners);
  };

  return (
    <div className="listener-list">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-lg font-bold text-primary">{t('listeners') || 'Listeners'}</h4>
        {listeners.length === 0 && (
          <span className="text-sm text-secondary">{t('singleListenerOnly') || 'Single listener only'}</span>
        )}
      </div>

      {listeners.length === 0 ? (
        <div className="text-center py-8 text-secondary">
          <p>{t('noListenersConfigured') || 'No listeners configured'}</p>
          <Button variant="primary" onClick={addListener} className="mt-4">
            + {t('addListener') || 'Add Listener'}
          </Button>
        </div>
      ) : (
        listeners.map((listener, index) => (
          <ListenerItem
            key={index}
            index={index}
            listener={listener}
            onChange={(field, value) => handleListenerChange(index, field, value)}
            onTargetChange={(field, value) => handleTargetChange(index, field, value)}
            onRemove={listeners.length > 1 ? () => removeListener(index) : undefined}
          />
        ))
      )}
    </div>
  );
};
