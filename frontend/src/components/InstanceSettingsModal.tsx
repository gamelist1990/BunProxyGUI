import { useState, useEffect } from 'react';
import { t } from '../lang';
import './InstanceSettingsModal.css';

interface InstanceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  instanceName: string;
  instanceVersion: string;
  autoRestart: boolean;
  onUpdateName: (name: string) => Promise<void>;
  onToggleAutoRestart: (enabled: boolean) => Promise<void>;
  onUpdateInstance: (version: string) => Promise<void>;
  availableVersions: string[];
  latestVersion: string;
  isUpdating?: boolean;
}

export function InstanceSettingsModal({
  isOpen,
  onClose,
  instanceName,
  instanceVersion,
  autoRestart,
  onUpdateName,
  onToggleAutoRestart,
  onUpdateInstance,
  availableVersions,
  latestVersion,
  isUpdating = false,
}: InstanceSettingsModalProps) {
  const [nameInput, setNameInput] = useState(instanceName);
  const [autoRestartChecked, setAutoRestartChecked] = useState(autoRestart);
  const [selectedVersion, setSelectedVersion] = useState('latest');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setNameInput(instanceName);
    setAutoRestartChecked(autoRestart);
  }, [instanceName, autoRestart, isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Update name if changed
      if (nameInput !== instanceName && nameInput.trim()) {
        await onUpdateName(nameInput.trim());
      }

      // Update auto-restart if changed
      if (autoRestartChecked !== autoRestart) {
        await onToggleAutoRestart(autoRestartChecked);
      }

      onClose();
    } catch (error) {
      const err = error as Error;
      alert(`${t('errorSaveConfig')}: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (confirm(`インスタンスをバージョン ${selectedVersion} にアップデートしますか？`)) {
      await onUpdateInstance(selectedVersion);
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content instance-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('instanceSettings') || 'インスタンス設定'}</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="setting-section">
            <label htmlFor="instance-name">
              {t('instanceName') || 'インスタンス名'}
            </label>
            <input
              id="instance-name"
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder={t('placeholderInstanceName') || 'インスタンス名を入力'}
            />
          </div>

          <div className="setting-section">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={autoRestartChecked}
                onChange={(e) => setAutoRestartChecked(e.target.checked)}
              />
              <span>{t('autoRestart') || '自動再起動'}</span>
            </label>
            <small className="setting-description">
              {t('autoRestartDescription') || 'プロセスが停止した場合、自動的に再起動します'}
            </small>
          </div>

          <div className="setting-section">
            <label htmlFor="version-select">
              {t('updateVersion') || 'アップデート'}
            </label>
            <div className="version-info">
              <span className="current-version">
                {t('currentVersion') || '現在のバージョン'}: v{instanceVersion}
              </span>
            </div>
            <select
              id="version-select"
              value={selectedVersion}
              onChange={(e) => setSelectedVersion(e.target.value)}
              disabled={isUpdating}
            >
              <option value="latest">
                {t('latestVersion') || '最新版'} (v{latestVersion})
              </option>
              {availableVersions.map((version) => (
                <option key={version} value={version}>
                  v{version}
                </option>
              ))}
            </select>
            <button
              className="update-button"
              onClick={handleUpdate}
              disabled={isUpdating}
            >
              {isUpdating ? t('updating') || '更新中...' : t('updateNow') || '今すぐアップデート'}
            </button>
          </div>
        </div>

        <div className="modal-footer">
          <button className="cancel-button" onClick={onClose} disabled={isSaving}>
            {t('cancel') || 'キャンセル'}
          </button>
          <button className="save-button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? t('saving') || '保存中...' : t('save') || '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
