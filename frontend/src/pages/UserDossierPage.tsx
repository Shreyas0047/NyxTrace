import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Shield, Calendar, Activity, FileText,
  MapPin, Clock, CheckCircle, XCircle, Loader2, AlertCircle
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../layouts/PageContainer';
import { cn } from '../design-system';
import api from '../services/api';
import type { User } from '../types';

interface CaseRecord {
  id: string;
  title: string;
  status: string;
  priority: string;
  date: string;
}

interface ActivityEvent {
  id: string;
  type: string;
  description: string;
  timestamp: string;
}

const tabs = ['Overview', 'Cases', 'Activity', 'Permissions'] as const;

const activityIcons: Record<string, typeof Activity> = {
  login: Activity,
  case_create: FileText,
  evidence_verify: CheckCircle,
  report_generate: FileText,
  settings_change: Activity,
};

const activityColors: Record<string, string> = {
  login: 'bg-amber-500/15 text-amber-400',
  case_create: 'bg-blue-500/15 text-blue-400',
  evidence_verify: 'bg-emerald-500/15 text-emerald-400',
  report_generate: 'bg-violet-500/15 text-violet-400',
  settings_change: 'bg-slate-500/15 text-slate-400',
};

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  resolved: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  closed: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

const priorityColors: Record<string, string> = {
  critical: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  high: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  medium: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  low: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
};

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };

const mockCases: CaseRecord[] = [
  { id: 'INV-2025-0042', title: 'Ransomware Campaign Analysis', status: 'active', priority: 'critical', date: '2025-07-18' },
  { id: 'INV-2025-0039', title: 'Phishing Infrastructure Takedown', status: 'active', priority: 'high', date: '2025-07-15' },
  { id: 'INV-2025-0031', title: 'Data Exfiltration Investigation', status: 'resolved', priority: 'medium', date: '2025-07-10' },
  { id: 'INV-2025-0028', title: 'Malware Sample Analysis', status: 'resolved', priority: 'high', date: '2025-07-05' },
  { id: 'INV-2025-0020', title: 'Network Intrusion Post-Mortem', status: 'closed', priority: 'critical', date: '2025-06-28' },
];


export function UserDossierPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>('Overview');
  const [user, setUser] = useState<User | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    loadUserData();
  }, [id]);

  const loadUserData = async () => {
    setLoading(true);
    setError('');
    try {
      const [userRes, activityRes] = await Promise.allSettled([
        api.getUser(id!),
        api.getUserActivity(id!),
      ]);

      if (userRes.status === 'fulfilled' && userRes.value.success && userRes.value.data) {
        const d = userRes.value.data as any;
        setUser(d.user || null);
      }

      if (activityRes.status === 'fulfilled' && activityRes.value.success && activityRes.value.data) {
        const d = activityRes.value.data as any;
        const activities = Array.isArray(d.activities) ? d.activities : [];
        setActivity(activities.map((a: any, i: number) => ({
          id: a.id || String(i),
          type: a.action || 'login',
          description: a.details || '',
          timestamp: a.timestamp ? new Date(a.timestamp).toLocaleDateString() : '',
        })));
      }

      if (!user && (!userRes || (userRes.status === 'rejected'))) {
        setError('Failed to load user data');
      }
    } catch {
      setError('Failed to load user dossier');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        <PageHeader title="User Dossier" subtitle="Detailed operator profile and activity record" />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
      </motion.div>
    );
  }

  if (error && !user) {
    return (
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        <PageHeader title="User Dossier" subtitle="Detailed operator profile and activity record" />
        <Card>
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <AlertCircle className="w-12 h-12 mb-3 text-rose-400" />
            <p className="text-lg font-medium text-slate-300">Failed to load user data</p>
            <p className="text-sm mt-1">{error}</p>
            <button onClick={loadUserData} className="mt-4 px-4 py-2 text-sm bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors">Retry</button>
          </div>
        </Card>
      </motion.div>
    );
  }

  const name = user?.name || 'Unknown User';
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const email = user?.email || '';
  const role = user?.role || 'unknown';
  const department = user?.department || 'Not assigned';
  const lastActive = user?.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Unknown';
  const joined = user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : 'Unknown';

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <PageHeader
        title="User Dossier"
        subtitle="Detailed operator profile and activity record"
      />

      <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <div className="p-5 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-500 to-violet-500 flex items-center justify-center">
                <span className="text-xl font-bold text-black">{initials}</span>
              </div>
              <h2 className="text-lg font-semibold text-slate-100">{name}</h2>
              <p className="text-xs text-slate-400 mt-1">{email}</p>
              <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                active
              </div>
              <div className="mt-5 space-y-2 text-left">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Shield className="w-3.5 h-3.5 text-amber-400" />
                  <span className="capitalize">{role.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  <span>{department}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  <span>Joined {joined}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Last active {lastActive}</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Cases Assigned', value: mockCases.length, color: 'text-amber-400' },
              { label: 'Activities', value: activity.length, color: 'text-emerald-400' },
              { label: 'Role Level', value: role.split('_')[0], color: 'text-violet-400' },
              { label: 'Status', value: 'Active', color: 'text-blue-400' },
            ].map((stat) => (
              <Card key={stat.label}>
                <div className="p-4 text-center">
                  <p className={cn('text-2xl font-bold tabular-nums capitalize', stat.color)}>{typeof stat.value === 'number' ? stat.value : stat.value}</p>
                  <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">{stat.label}</p>
                </div>
              </Card>
            ))}
          </div>

          <div className="flex items-center gap-1 border-b border-slate-700">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-4 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-[1px]',
                  activeTab === tab
                    ? 'border-amber-500 text-amber-400'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === 'Overview' && (
            <div className="space-y-4">
              {mockCases.slice(0, 3).map((c) => (
                <motion.div key={c.id} variants={fadeUp}>
                  <Card hover className="cursor-pointer" onClick={() => navigate(`/investigations/${c.id}`)}>
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-slate-500" />
                        <div>
                          <p className="text-sm font-medium text-slate-100">{c.title}</p>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">{c.id}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn('px-2 py-0.5 rounded text-[10px] font-mono border', priorityColors[c.priority])}>{c.priority}</span>
                        <span className={cn('px-2 py-0.5 rounded text-[10px] font-mono border', statusColors[c.status])}>{c.status}</span>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}

          {activeTab === 'Cases' && (
            <div className="space-y-3">
              {mockCases.map((c) => (
                <motion.div key={c.id} variants={fadeUp}>
                  <Card hover className="cursor-pointer" onClick={() => navigate(`/investigations/${c.id}`)}>
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-slate-500" />
                        <div>
                          <p className="text-sm font-medium text-slate-100">{c.title}</p>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">{c.id} · {c.date}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn('px-2 py-0.5 rounded text-[10px] font-mono border', priorityColors[c.priority])}>{c.priority}</span>
                        <span className={cn('px-2 py-0.5 rounded text-[10px] font-mono border', statusColors[c.status])}>{c.status}</span>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}

          {activeTab === 'Activity' && (
            <div className="relative">
              <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-700" />
              <div className="space-y-0">
                {activity.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-sm">No activity recorded</div>
                ) : activity.map((event) => {
                  const Icon = activityIcons[event.type] || Activity;
                  return (
                    <motion.div key={event.id} variants={fadeUp} className="relative flex items-start gap-4 pb-6">
                      <div className={cn('relative z-10 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', activityColors[event.type] || 'bg-slate-500/15 text-slate-400')}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0 pt-1.5">
                        <p className="text-sm text-slate-100">{event.description}</p>
                        <p className="text-[10px] text-slate-500 mt-1">{event.timestamp}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'Permissions' && (
            <Card>
              <div className="p-5 space-y-4">
                <h3 className="text-sm font-semibold text-slate-100 capitalize">Role: {role.replace(/_/g, ' ')}</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Create Investigations', granted: ['super_admin', 'admin', 'forensic_analyst'].includes(role) },
                    { label: 'Manage Evidence', granted: ['super_admin', 'admin', 'forensic_analyst'].includes(role) },
                    { label: 'Run Sandbox Sessions', granted: ['super_admin', 'admin', 'sandbox_operator'].includes(role) },
                    { label: 'Generate Reports', granted: ['super_admin', 'admin', 'forensic_analyst'].includes(role) },
                    { label: 'View Threat Intel', granted: true },
                    { label: 'Blockchain Verification', granted: ['super_admin', 'admin', 'forensic_analyst'].includes(role) },
                    { label: 'User Management', granted: ['super_admin', 'admin'].includes(role) },
                    { label: 'System Configuration', granted: ['super_admin', 'admin'].includes(role) },
                    { label: 'Role Administration', granted: role === 'super_admin' },
                    { label: 'Audit Log Access', granted: ['super_admin', 'admin', 'auditor'].includes(role) },
                  ].map((perm) => (
                    <div key={perm.label} className="flex items-center gap-2">
                      {perm.granted ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-600 flex-shrink-0" />
                      )}
                      <span className={cn('text-xs', perm.granted ? 'text-slate-200' : 'text-slate-500')}>{perm.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default UserDossierPage;
