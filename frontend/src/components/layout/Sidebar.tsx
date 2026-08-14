import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Folder, Activity, Brain,
  Settings, Users, Fingerprint, History, Layers, Terminal,
  Heart, Link2, AlertTriangle, BarChart3, Home,
  ChevronLeft, ChevronRight, Circle, Database,
} from 'lucide-react';
import { useState, memo } from 'react';
import { cn } from '../../design-system';
import { useAuthStore } from '../../stores/authStore';

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: (collapsed: boolean) => void;
}

interface NavItem {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  path: string;
  roles: string[];
  badge?: string | number;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const allRoles = ['admin', 'super_admin', 'forensic_analyst'];
const adminRoles = ['admin', 'super_admin'];

const navSections: NavSection[] = [
  {
    label: 'Home',
    items: [
      { icon: Home, label: 'Home', path: '/home', roles: allRoles },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', roles: allRoles },
      { icon: Folder, label: 'Evidence', path: '/evidence', roles: allRoles },
    ],
  },
  {
    label: 'Operations',
    items: [
      { icon: Terminal, label: 'Sandbox', path: '/sandbox', roles: allRoles },
      { icon: Activity, label: 'Telemetry', path: '/telemetry', roles: allRoles },
      { icon: Brain, label: 'AI Analysis', path: '/ai-analysis', roles: allRoles },
      { icon: Layers, label: 'Reports', path: '/reports', roles: allRoles },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { icon: AlertTriangle, label: 'Threat Intel', path: '/threat-intelligence', roles: allRoles },
      { icon: BarChart3, label: 'Forensic Analytics', path: '/forensic-analytics', roles: adminRoles },
      
      { icon: Link2, label: 'Blockchain Ops', path: '/blockchain-operations', roles: adminRoles },
    ],
  },
{
      label: 'Administration',
      items: [
        { icon: Heart, label: 'System Health', path: '/health', roles: adminRoles },
        { icon: Users, label: 'Users', path: '/users', roles: adminRoles },
        { icon: Settings, label: 'Settings', path: '/settings', roles: adminRoles },
        { icon: History, label: 'Audit Log', path: '/audit', roles: adminRoles },
        { icon: Database, label: 'Storage', path: '/storage', roles: adminRoles },
      ],
    },
];

const NavItemRow = memo(({ item, isCollapsed }: { item: NavItem; isCollapsed: boolean }) => (
  <NavLink
    to={item.path}
    className={({ isActive }) => cn(
      'group relative flex items-center gap-3 h-9 px-2.5 rounded-[10px]',
      'transition-all duration-200',
      isActive
        ? 'text-[var(--text-primary)] bg-amber-500/8'
        : 'text-[var(--text-tertiary)] hover:bg-[var(--surface-container)] hover:text-[var(--text-primary)]'
    )}
    style={({ isActive }: any) => isActive ? { background: 'rgba(245, 158, 11, 0.08)' } : {}}
  >
    {({ isActive }) => (
      <>
        {isActive && (
          <motion.div
            layoutId="sidebar-active-rail"
            className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r"
            style={{ background: '#f59e0b', boxShadow: '0 0 8px rgba(245, 158, 11, 0.4)' }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          />
        )}
        <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
          <item.icon
            strokeWidth={1.5}
            className={cn(
              'w-[18px] h-[18px] transition-colors',
              isActive ? 'text-amber-600 ' : 'text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]'
            )}
          />
        </div>

        <AnimatePresence initial={false}>
          {!isCollapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="flex-1 text-[13px] font-medium font-body tracking-[-0.01em] truncate"
            >
              {item.label}
            </motion.span>
          )}
        </AnimatePresence>

        {item.badge && !isCollapsed && (
          <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-rose-500/15 text-rose-300 border border-rose-500/20">
            {item.badge}
          </span>
        )}
      </>
    )}
  </NavLink>
));
NavItemRow.displayName = 'NavItemRow';

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const { user } = useAuthStore();
  const userRole = user?.role || 'auditor';
  const [isCollapsed, setIsCollapsed] = useState(collapsed);

  const handleToggle = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    onToggle?.(next);
  };

  const visibleSections = navSections
    .map(s => ({ ...s, items: s.items.filter(i => i.roles.includes(userRole)) }))
    .filter(s => s.items.length > 0);

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 72 : 244 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className="fixed left-0 top-0 h-screen z-50 flex flex-col"
      style={{
        background: 'var(--surface-sunken)',
        borderRight: '1px solid var(--border-subtle)',
      }}
    >
      {/* Brand */}
      <div
        className={cn(
          'h-16 flex items-center flex-shrink-0',
          isCollapsed ? 'justify-center' : 'px-5 gap-3'
        )}
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div
          className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #f59e0b, #b45309)',
            boxShadow: '0 1px 3px rgba(245, 158, 11, 0.25)',
          }}
        >
          <Fingerprint strokeWidth={1.75} className="w-4 h-4 text-white" />
        </div>
        <AnimatePresence initial={false}>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              <h1 className="font-display font-semibold text-[15px] text-[var(--text-primary)] tracking-tight leading-tight">
                NyxTrace
              </h1>
              <p className="text-[10px] font-mono text-[var(--text-tertiary)] mt-0.5 tracking-[0.12em] uppercase">
                Cyber Intelligence
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2.5">
        {visibleSections.map((section, idx) => (
          <div key={section.label} className={cn(idx > 0 && 'mt-5')}>
            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-2.5 mb-1.5 text-[10px] font-mono text-[var(--text-tertiary)] tracking-[0.14em] uppercase"
                >
                  {section.label}
                </motion.div>
              )}
            </AnimatePresence>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavItemRow key={item.path} item={item} isCollapsed={isCollapsed} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        {isCollapsed ? (
          <button
            onClick={handleToggle}
            className="w-full h-9 flex items-center justify-center rounded-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-container)] transition-all"
            aria-label="Expand sidebar"
          >
            <ChevronRight strokeWidth={1.5} className="w-4 h-4" />
          </button>
        ) : (
          <div className="space-y-2">
            <div className="px-2.5 py-2 rounded-[10px] bg-[var(--surface-container)] border border-[var(--border-subtle)]">
              <div className="flex items-center gap-2 mb-0.5">
                <Circle className="w-1.5 h-1.5 fill-emerald-400 text-emerald-600 " />
                <span className="text-[10px] font-mono text-[var(--text-tertiary)] tracking-[0.14em] uppercase">Operational</span>
              </div>
              <p className="font-mono text-[10px] text-[var(--text-tertiary)] tracking-tight">v2.0 · Enterprise</p>
            </div>
            <button
              onClick={handleToggle}
              className="w-full h-8 flex items-center justify-center gap-1.5 rounded-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-tertiary)] hover:bg-[var(--surface-container)] transition-all"
            >
              <ChevronLeft strokeWidth={1.5} className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium font-body">Collapse</span>
            </button>
          </div>
        )}
      </div>
    </motion.aside>
  );
}

export default Sidebar;
