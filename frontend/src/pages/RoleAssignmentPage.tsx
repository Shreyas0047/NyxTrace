import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Shield, Plus, CheckCircle, XCircle, Users,
  Edit3, Trash2, Loader2, AlertCircle,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../layouts/PageContainer';
import { cn } from '../design-system';
import api from '../services/api';

interface Role {
  id: string;
  name: string;
  description: string;
  userCount: number;
  permissions: Record<string, boolean>;
}

const allPermissions = [
  'investigations:create', 'investigations:read', 'investigations:update', 'investigations:delete',
  'evidence:create', 'evidence:read', 'evidence:verify', 'evidence:delete',
  'sandbox:run', 'sandbox:view', 'sandbox:stop',
  'reports:generate', 'reports:export',
  'threat-intel:read', 'threat-intel:analyze',
  'users:read', 'users:create', 'users:update', 'users:delete',
  'roles:manage',
  'system:configure',
  'audit:view',
];

const permissionGroups = [
  { label: 'Investigations', prefix: 'investigations', color: 'text-amber-400' },
  { label: 'Evidence', prefix: 'evidence', color: 'text-emerald-400' },
  { label: 'Sandbox', prefix: 'sandbox', color: 'text-violet-400' },
  { label: 'Reports', prefix: 'reports', color: 'text-blue-400' },
  { label: 'Threat Intel', prefix: 'threat-intel', color: 'text-rose-400' },
  { label: 'Users', prefix: 'users', color: 'text-cyan-400' },
  { label: 'System', prefix: 'system', color: 'text-orange-400' },
];

const roleUserCounts: Record<string, number> = {
  super_admin: 2,
  admin: 5,
  forensic_analyst: 12,
  investigator: 8,
  viewer: 15,
  auditor: 3,
};

const roleDescriptions: Record<string, string> = {
  super_admin: 'Full system access with all permissions',
  admin: 'System administration and user management',
  forensic_analyst: 'Investigation and evidence analysis',
  investigator: 'Case management and evidence review',
  viewer: 'Read-only access to investigations and reports',
  auditor: 'Audit log and compliance review access',
};

const backendToLocalPerm: Record<string, string> = {
  'investigation:create': 'investigations:create',
  'investigation:read': 'investigations:read',
  'investigation:update': 'investigations:update',
  'investigation:delete': 'investigations:delete',
  'evidence:upload': 'evidence:create',
  'evidence:read': 'evidence:read',
  'evidence:verify': 'evidence:verify',
  'evidence:delete': 'evidence:delete',
  'evidence:download': 'evidence:read',
  'sandbox:execute': 'sandbox:run',
  'sandbox:view': 'sandbox:view',
  'sandbox:telemetry': 'sandbox:view',
  'report:create': 'reports:generate',
  'report:read': 'reports:view',
  'report:export': 'reports:export',
  'user:create': 'users:create',
  'user:read': 'users:read',
  'user:update': 'users:update',
  'user:delete': 'users:delete',
  'system:settings': 'system:configure',
  'audit:view': 'audit:view',
};

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };

export function RoleAssignmentPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('');

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getRoles();
      if (res.success && Array.isArray(res.data)) {
        const mapped: Role[] = res.data.map((r: any) => {
          const roleId = r.id;
          const perms = Array.isArray(r.permissions) ? r.permissions : [];
          const permMap: Record<string, boolean> = {};
          for (const p of perms) {
            const localKey = backendToLocalPerm[p] || p;
            permMap[localKey] = true;
          }
          return {
            id: roleId,
            name: r.name || roleId,
            description: roleDescriptions[roleId] || '',
            userCount: roleUserCounts[roleId] || 0,
            permissions: permMap,
          };
        });
        setRoles(mapped);
        if (mapped.length > 0) setSelectedRole(mapped[0].id);
      }
    } catch {
      setError('Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  const selected = roles.find(r => r.id === selectedRole);

  if (loading) {
    return (
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        <PageHeader title="Role Assignment" subtitle="Manage roles, permissions, and access control" />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        <PageHeader title="Role Assignment" subtitle="Manage roles, permissions, and access control" />
        <Card>
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <AlertCircle className="w-12 h-12 mb-3 text-rose-400" />
            <p className="text-lg font-medium text-slate-300">Failed to load roles</p>
            <p className="text-sm mt-1">{error}</p>
            <button onClick={loadRoles} className="mt-4 px-4 py-2 text-sm bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors">Retry</button>
          </div>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <PageHeader
        title="Role Assignment"
        subtitle="Manage roles, permissions, and access control"
        actions={
          <Button size="sm">
            <Plus className="w-4 h-4" />
            New Role
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-3">
          {roles.map((role) => (
            <motion.div key={role.id} variants={fadeUp}>
              <Card
                hover
                className={cn('cursor-pointer', selectedRole === role.id && 'ring-1 ring-amber-500/40')}
                onClick={() => setSelectedRole(role.id)}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Shield className={cn('w-4 h-4', selectedRole === role.id ? 'text-amber-400' : 'text-slate-500')} />
                      <h3 className="text-sm font-semibold text-slate-100">{role.name}</h3>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-500">
                      <Users className="w-3 h-3" />
                      {role.userCount}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2">{role.description}</p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="lg:col-span-2">
          {selected ? (
            <Card>
              <div className="p-5">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-100">{selected.name}</h2>
                    <p className="text-xs text-slate-400 mt-1">{selected.description} · {selected.userCount} users</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-6">
                  {permissionGroups.map((group) => {
                    const groupPerms = allPermissions.filter(p => p.startsWith(group.prefix));
                    return (
                      <div key={group.prefix}>
                        <h3 className={cn('text-[11px] font-semibold uppercase tracking-wider mb-3', group.color)}>
                          {group.label}
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {groupPerms.map((perm) => {
                            const granted = selected.permissions[perm] || false;
                            return (
                              <div
                                key={perm}
                                className={cn(
                                  'flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] transition-colors',
                                  granted
                                    ? 'bg-emerald-500/10 text-emerald-300'
                                    : 'bg-slate-800/50 text-slate-600'
                                )}
                              >
                                {granted ? (
                                  <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                                ) : (
                                  <XCircle className="w-3 h-3 text-slate-600 flex-shrink-0" />
                                )}
                                <span className="truncate">{perm.split(':')[1]}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="flex items-center justify-center py-16 text-slate-500">
                <p className="text-sm">Select a role to view permissions</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default RoleAssignmentPage;
