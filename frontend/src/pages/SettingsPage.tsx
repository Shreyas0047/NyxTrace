import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings as SettingsIcon,
  Server,
  Eye,
  Play,
  FileText,
  Bell,
  Save,
  RotateCcw,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { PageHeader } from '../layouts/PageContainer';
import { useSettingsStore } from '../stores/settingsStore';
import type { AppSettings } from '../types/reports';

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };

type SettingsTab = 'vm' | 'monitoring' | 'execution' | 'logging' | 'notifications';

const tabs: { id: SettingsTab; label: string; icon: typeof SettingsIcon }[] = [
  { id: 'vm', label: 'VM Configuration', icon: Server },
  { id: 'monitoring', label: 'Monitoring', icon: Eye },
  { id: 'execution', label: 'Execution', icon: Play },
  { id: 'logging', label: 'Logging', icon: FileText },
  { id: 'notifications', label: 'Notifications', icon: Bell },
];

const logLevelOptions = [
  { value: 'debug', label: 'Debug' },
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'error', label: 'Error' },
  { value: 'critical', label: 'Critical' },
];

const maxFileSizeOptions = [
  { value: '1m', label: '1 MB' },
  { value: '5m', label: '5 MB' },
  { value: '10m', label: '10 MB' },
  { value: '50m', label: '50 MB' },
  { value: '100m', label: '100 MB' },
];

export function SettingsPage() {
  const {
    settings, isLoading, isSaving, error, success, validationErrors,
    fetchSettings, updateSettings, resetSettings, clearMessages,
  } = useSettingsStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>('vm');
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    setLocalSettings(settings);
    setHasChanges(false);
  }, [settings]);

  const handleChange = <K extends keyof AppSettings>(
    section: K,
    field: keyof AppSettings[K],
    value: unknown
  ) => {
    setLocalSettings((prev) => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }));
    setHasChanges(true);
    clearMessages();
  };

  const handleSave = async () => {
    const result = await updateSettings(localSettings);
    if (result) setHasChanges(false);
  };

  const handleReset = async () => {
    await resetSettings();
    setHasChanges(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Configure forensic platform settings"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RotateCcw className="w-4 h-4" />}
              onClick={handleReset}
              disabled={isSaving}
            >
              Reset to Defaults
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={isSaving ? undefined : <Save className="w-4 h-4" />}
              onClick={handleSave}
              loading={isSaving}
              disabled={!hasChanges}
            >
              Save Changes
            </Button>
          </div>
        }
      />

      {(error || success) && (
        <Card className={error ? 'border-red-200 dark:border-red-800' : 'border-emerald-200 dark:border-emerald-800'}>
          <div className="p-4 flex items-center gap-3">
            {error ? <XCircle className="w-5 h-5 text-red-500" /> : <CheckCircle className="w-5 h-5 text-emerald-500" />}
            <div>
              <p className={error ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}>
                {error || success}
              </p>
              {validationErrors.length > 0 && (
                <ul className="mt-1 text-sm text-red-500 list-disc list-inside">
                  {validationErrors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1">
          <div className="p-2">
            <p className="px-3 py-2 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase">Configuration</p>
            <div className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left
                      ${activeTab === tab.id
                        ? 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <div className="p-6">
            {activeTab === 'vm' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Server className="w-5 h-5 text-cyan-500" />
                  Virtual Machine Configuration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">VM Name</label>
                    <Input
                      value={localSettings.vm.vmName}
                      onChange={(e) => handleChange('vm', 'vmName', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Snapshot Name</label>
                    <Input
                      value={localSettings.vm.snapshotName}
                      onChange={(e) => handleChange('vm', 'snapshotName', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Startup Timeout (seconds)</label>
                    <Input
                      type="number"
                      value={localSettings.vm.startupTimeout}
                      onChange={(e) => handleChange('vm', 'startupTimeout', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Shutdown Timeout (seconds)</label>
                    <Input
                      type="number"
                      value={localSettings.vm.shutdownTimeout}
                      onChange={(e) => handleChange('vm', 'shutdownTimeout', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="headlessMode"
                      checked={localSettings.vm.headlessMode}
                      onChange={(e) => handleChange('vm', 'headlessMode', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-600"
                    />
                    <label htmlFor="headlessMode" className="text-sm font-medium text-slate-700 dark:text-slate-300">Headless Mode</label>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'monitoring' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Eye className="w-5 h-5 text-cyan-500" />
                  Monitoring Configuration
                </h3>
                <div className="flex items-center gap-3 mb-4">
                  <input
                    type="checkbox"
                    id="monitoringEnabled"
                    checked={localSettings.monitoring.enabled}
                    onChange={(e) => handleChange('monitoring', 'enabled', e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600"
                  />
                  <label htmlFor="monitoringEnabled" className="text-sm font-medium text-slate-700 dark:text-slate-300">Enable Monitoring</label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Polling Interval (ms)</label>
                    <Input
                      type="number"
                      value={localSettings.monitoring.pollingInterval}
                      onChange={(e) => handleChange('monitoring', 'pollingInterval', parseInt(e.target.value) || 0)}
                      disabled={!localSettings.monitoring.enabled}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Log Retention (days)</label>
                    <Input
                      type="number"
                      value={localSettings.monitoring.logRetentionDays}
                      onChange={(e) => handleChange('monitoring', 'logRetentionDays', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Monitoring Targets</p>
                    {[
                      { key: 'processEnabled', label: 'Process Activity' },
                      { key: 'fileEnabled', label: 'File Activity' },
                      { key: 'registryEnabled', label: 'Registry Activity' },
                      { key: 'networkEnabled', label: 'Network Activity' },
                      { key: 'behaviorEnabled', label: 'Behavior Analysis' },
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id={key}
                          checked={localSettings.monitoring[key as keyof typeof localSettings.monitoring] as boolean}
                          onChange={(e) => handleChange('monitoring', key as keyof typeof localSettings.monitoring, e.target.checked)}
                          disabled={!localSettings.monitoring.enabled}
                          className="w-4 h-4 rounded border-slate-300 dark:border-slate-600"
                        />
                        <label htmlFor={key} className="text-sm text-slate-600 dark:text-slate-400">{label}</label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'execution' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Play className="w-5 h-5 text-cyan-500" />
                  Execution Configuration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Timeout (seconds)</label>
                    <Input
                      type="number"
                      value={localSettings.execution.timeout}
                      onChange={(e) => handleChange('execution', 'timeout', parseInt(e.target.value) || 0)}
                    />
                    <p className="text-xs text-slate-400 mt-1">Maximum execution time before auto-rollback (max 300s)</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Max Concurrent Sessions</label>
                    <Input
                      type="number"
                      value={localSettings.execution.maxConcurrentSessions}
                      onChange={(e) => handleChange('execution', 'maxConcurrentSessions', parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Telemetry Limit</label>
                    <Input
                      type="number"
                      value={localSettings.execution.telemetryLimit}
                      onChange={(e) => handleChange('execution', 'telemetryLimit', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="autoRollback"
                      checked={localSettings.execution.autoRollback}
                      onChange={(e) => handleChange('execution', 'autoRollback', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-600"
                    />
                    <label htmlFor="autoRollback" className="text-sm font-medium text-slate-700 dark:text-slate-300">Auto Rollback on Failure</label>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'logging' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-cyan-500" />
                  Logging Configuration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Log Level</label>
                    <Select
                      value={localSettings.logging.level}
                      onChange={(val) => handleChange('logging', 'level', val)}
                      options={logLevelOptions}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Max File Size</label>
                    <Select
                      value={localSettings.logging.maxFileSize}
                      onChange={(val) => handleChange('logging', 'maxFileSize', val)}
                      options={maxFileSizeOptions}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Max Files</label>
                    <Input
                      type="number"
                      value={localSettings.logging.maxFiles}
                      onChange={(e) => handleChange('logging', 'maxFiles', parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Bell className="w-5 h-5 text-cyan-500" />
                  Notification Configuration
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="alertsEnabled"
                      checked={localSettings.notifications.alertsEnabled}
                      onChange={(e) => handleChange('notifications', 'alertsEnabled', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-600"
                    />
                    <label htmlFor="alertsEnabled" className="text-sm font-medium text-slate-700 dark:text-slate-300">Enable Alerts</label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="alertOnCompletion"
                      checked={localSettings.notifications.alertOnCompletion}
                      onChange={(e) => handleChange('notifications', 'alertOnCompletion', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-600"
                    />
                    <label htmlFor="alertOnCompletion" className="text-sm text-slate-600 dark:text-slate-400">Alert on simulation completion</label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="alertOnError"
                      checked={localSettings.notifications.alertOnError}
                      onChange={(e) => handleChange('notifications', 'alertOnError', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-600"
                    />
                    <label htmlFor="alertOnError" className="text-sm text-slate-600 dark:text-slate-400">Alert on error</label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Webhook URL (optional)</label>
                    <Input
                      type="url"
                      value={localSettings.notifications.webhookUrl || ''}
                      onChange={(e) => handleChange('notifications', 'webhookUrl', e.target.value)}
                      placeholder="https://example.com/webhook"
                    />
                    <p className="text-xs text-slate-400 mt-1">Receive notifications via webhook</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </motion.div>
  );
}

export default SettingsPage;