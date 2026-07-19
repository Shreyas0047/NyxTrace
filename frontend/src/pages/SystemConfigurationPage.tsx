import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Server, Database, Link, Bell, Shield, Activity, Save,
  RefreshCw, CheckCircle, Loader2, AlertCircle,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../layouts/PageContainer';
import { cn } from '../design-system';
import api from '../services/api';

interface ConfigSection {
  id: string;
  label: string;
  icon: typeof Server;
  description: string;
}

interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'toggle' | 'select';
  value: string | boolean;
  options?: { label: string; value: string }[];
}

const sections: ConfigSection[] = [
  { id: 'blockchain', label: 'Blockchain', icon: Link, description: 'Smart contract and network configuration' },
  { id: 'database', label: 'Database', icon: Database, description: 'MongoDB connection and storage settings' },
  { id: 'aiService', label: 'AI Service', icon: Activity, description: 'LLM and analysis engine configuration' },
  { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Email and alert channel settings' },
  { id: 'sandbox', label: 'Sandbox', icon: Server, description: 'VirtualBox and sandbox runtime settings' },
  { id: 'security', label: 'Security', icon: Shield, description: 'Authentication, JWT, and session settings' },
];

function buildConfigFields(data: Record<string, any>): ConfigField[] {
  if (!data) return [];
  return Object.entries(data).map(([key, value]) => {
    const isBool = typeof value === 'boolean';
    const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
    if (isBool) {
      return { key, label, type: 'toggle', value };
    }
    const isPassword = key.toLowerCase().includes('pass') || key.toLowerCase().includes('uri') || key.toLowerCase().includes('secret');
    const selectKeys = ['llmProvider', 'confirmations'];
    if (selectKeys.includes(key)) {
      const options = key === 'llmProvider'
        ? [{ label: 'Ollama', value: 'ollama' }, { label: 'OpenAI', value: 'openai' }, { label: 'Disabled', value: 'none' }]
        : [{ label: '1', value: '1' }, { label: '3', value: '3' }, { label: '6', value: '6' }];
      return { key, label, type: 'select', value: String(value), options };
    }
    return { key, label, type: isPassword ? 'password' : 'text', value: String(value) };
  });
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };

export function SystemConfigurationPage() {
  const [activeSection, setActiveSection] = useState('blockchain');
  const [configData, setConfigData] = useState<Record<string, ConfigField[]>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getSystemConfig();
      if (res.success && res.data) {
        const fields: Record<string, ConfigField[]> = {};
        for (const section of sections) {
          const sectionData = (res.data as any)[section.id];
          if (sectionData) {
            fields[section.id] = buildConfigFields(sectionData);
          }
          if (section.id === 'sandbox') {
            try {
              const settingsRes = await api.getSettings();
              if (settingsRes.success && settingsRes.data) {
                const s = settingsRes.data as any;
                const sandboxData = {
                  vmName: s.vm?.vmName || '',
                  snapshotName: s.vm?.snapshotName || '',
                  headlessMode: s.vm?.headlessMode ?? false,
                  startupTimeout: String(s.vm?.startupTimeout || ''),
                  shutdownTimeout: String(s.vm?.shutdownTimeout || ''),
                  ...sectionData,
                };
                fields['sandbox'] = buildConfigFields(sandboxData);
              }
            } catch {
              // sandbox settings unavailable, use config-only
            }
          }
        }
        setConfigData(fields);
      }
    } catch {
      setError('Failed to load system configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const sectionKey = activeSection;
      const sectionFields = configData[sectionKey];
      if (!sectionFields) return;

      const values: Record<string, any> = {};
      for (const field of sectionFields) {
        values[field.key] = field.value;
      }

      const res = await api.updateSystemConfig(sectionKey, values);
      if (res.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      setError('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const toggleField = (section: string, fieldIndex: number) => {
    setConfigData(prev => {
      const newData = { ...prev };
      const fields = [...(newData[section] || [])];
      const field = { ...fields[fieldIndex] };
      field.value = !field.value;
      fields[fieldIndex] = field;
      newData[section] = fields;
      return newData;
    });
  };

  const updateField = (section: string, fieldIndex: number, value: string) => {
    setConfigData(prev => {
      const newData = { ...prev };
      const fields = [...(newData[section] || [])];
      const field = { ...fields[fieldIndex] };
      field.value = value;
      fields[fieldIndex] = field;
      newData[section] = fields;
      return newData;
    });
  };

  if (loading) {
    return (
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        <PageHeader title="System Configuration" subtitle="Manage platform settings and integrations" />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
      </motion.div>
    );
  }

  if (error && Object.keys(configData).length === 0) {
    return (
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        <PageHeader title="System Configuration" subtitle="Manage platform settings and integrations" />
        <Card>
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <AlertCircle className="w-12 h-12 mb-3 text-rose-400" />
            <p className="text-lg font-medium text-slate-300">Failed to load configuration</p>
            <p className="text-sm mt-1">{error}</p>
            <button onClick={loadConfig} className="mt-4 px-4 py-2 text-sm bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors">Retry</button>
          </div>
        </Card>
      </motion.div>
    );
  }

  const currentFields = configData[activeSection] || [];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <PageHeader
        title="System Configuration"
        subtitle="Manage platform settings and integrations"
        actions={
          <div className="flex items-center gap-2">
            {saved && (
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <CheckCircle className="w-3.5 h-3.5" />
                Saved
              </span>
            )}
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-2">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  'w-full text-left p-3 rounded-lg transition-all duration-150',
                  activeSection === section.id
                    ? 'bg-amber-500/10 ring-1 ring-amber-500/30'
                    : 'hover:bg-slate-800/50'
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className={cn('w-4 h-4', activeSection === section.id ? 'text-amber-400' : 'text-slate-500')} />
                  <span className={cn('text-sm font-medium', activeSection === section.id ? 'text-slate-100' : 'text-slate-400')}>
                    {section.label}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 ml-6">{section.description}</p>
              </button>
            );
          })}
        </div>

        <div className="lg:col-span-3">
          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold text-slate-100 mb-1">
                {sections.find(s => s.id === activeSection)?.label}
              </h2>
              <p className="text-xs text-slate-400 mb-6">
                {sections.find(s => s.id === activeSection)?.description}
              </p>
              <div className="space-y-5">
                {currentFields.length === 0 ? (
                  <p className="text-sm text-slate-500">No configuration options available for this section.</p>
                ) : currentFields.map((field, idx) => (
                  <motion.div key={field.key} variants={fadeUp} className="flex items-center justify-between gap-4">
                    <label className="text-sm text-slate-300 min-w-[180px]">{field.label}</label>
                    {field.type === 'toggle' ? (
                      <div
                        className={cn(
                          'relative w-10 h-5 rounded-full transition-colors cursor-pointer',
                          field.value ? 'bg-amber-500' : 'bg-slate-700'
                        )}
                        onClick={() => toggleField(activeSection, idx)}
                      >
                        <div className={cn(
                          'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                          field.value ? 'translate-x-[22px]' : 'translate-x-0.5'
                        )} />
                      </div>
                    ) : field.type === 'select' ? (
                      <select
                        value={field.value as string}
                        onChange={(e) => updateField(activeSection, idx, e.target.value)}
                        className="flex-1 max-w-xs px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                      >
                        {field.options?.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        type={field.type}
                        value={field.value as string}
                        onChange={(e) => updateField(activeSection, idx, e.target.value)}
                        className="flex-1 max-w-xs"
                      />
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}

export default SystemConfigurationPage;
