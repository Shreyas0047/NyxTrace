import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Search, User, LogOut, Settings,
  ChevronDown, ChevronRight,
  AlertTriangle, CheckCircle, Info, X,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { cn } from '../../design-system';
import ConnectionStatus from './ConnectionStatus';

interface BreadcrumbItem {
  label: string;
  path?: string;
  icon?: React.ElementType;
}

interface HeaderProps {
  breadcrumbs?: BreadcrumbItem[];
  currentPage?: string;
}

export function Header({ breadcrumbs = [], currentPage = '' }: HeaderProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const notifications = [
    { id: 1, type: 'critical', message: 'Critical severity alert detected', time: '2 min ago' },
    { id: 2, type: 'success', message: 'Analysis completed for INV-2024-5A3B', time: '15 min ago' },
    { id: 3, type: 'info', message: 'New evidence uploaded to INV-2024-5A2C', time: '1 hour ago' },
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
      if (e.key === 'Escape') setShowSearch(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'success': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <>
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh]"
            onClick={() => setShowSearch(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden bg-black/90 backdrop-blur-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 px-4 py-4 border-b border-white/5">
                <Search className="w-5 h-5 text-slate-500" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search investigations, evidence, alerts, reports..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 outline-none"
                />
                <button onClick={() => setShowSearch(false)} className="p-1 rounded-lg hover:bg-white/5">
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>
              <div className="p-2 bg-white/[0.02]">
                <div className="flex items-center gap-2 px-2 py-1">
                  <span className="text-xs text-slate-600">Quick actions</span>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {[
                  { title: 'New Investigation', description: 'Create a new case', action: () => { setShowSearch(false); navigate('/investigations?new=true'); }},
                  { title: 'Upload Evidence', description: 'Add files to repository', action: () => { setShowSearch(false); navigate('/evidence?upload=true'); }},
                  { title: 'View Alerts', description: 'Check active alerts', action: () => { setShowSearch(false); navigate('/alerts'); }},
                ].map((item, index) => (
                  <button
                    key={index}
                    onClick={item.action}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="p-2 rounded-lg bg-white/5">
                      <Search className="w-4 h-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">{item.title}</p>
                      <p className="text-xs text-slate-500">{item.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <header
        className="h-14 flex items-center justify-between px-5 sticky top-0 z-40 border-b"
        style={{
          background: 'var(--surface-overlay)',
          borderColor: 'var(--border-subtle)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="flex items-center gap-2">
          <nav className="flex items-center gap-1.5 text-sm">
            {breadcrumbs.slice(1).map((item, index) => (
              <div key={index} className="flex items-center gap-1.5">
                {index > 0 && <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />}
                {item.path ? (
                  <Link
                    to={item.path}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-sm font-medium transition-colors"
                    style={{ color: 'var(--text-tertiary)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}
                  >
                    {item.icon && <item.icon className="w-3.5 h-3.5" />}
                    {item.label}
                  </Link>
                ) : (
                  <span className="flex items-center gap-1.5 px-2 py-1" style={{ color: 'var(--text-primary)' }}>
                    {item.icon && <item.icon className="w-3.5 h-3.5" />}
                    {item.label}
                  </span>
                )}
              </div>
            ))}
            {currentPage && (
              <span style={{ color: 'var(--text-tertiary)' }} className="mx-1">/</span>
            )}
            {currentPage && (
              <span className="font-display text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {currentPage}
              </span>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {/* Search — icon only */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowSearch(true)}
            className="flex items-center justify-center w-9 h-9 rounded-xl transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
          >
            <Search className="w-4 h-4" />
          </motion.button>

          <ConnectionStatus />

          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative flex items-center justify-center w-9 h-9 rounded-xl transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full" />
            </motion.button>

            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-80 rounded-2xl border shadow-xl overflow-hidden"
                  style={{ background: 'var(--surface-overlay)', borderColor: 'var(--border-default)', backdropFilter: 'blur(20px)' }}
                >
                  <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                    <h3 style={{ color: 'var(--text-primary)' }} className="font-semibold text-sm">Notifications</h3>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className="px-4 py-3 cursor-pointer border-b transition-colors"
                        style={{ borderColor: 'var(--border-subtle)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">{getNotificationIcon(notification.type)}</div>
                          <div className="flex-1">
                            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{notification.message}</p>
                            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{notification.time}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-3 border-t" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'var(--border-subtle)' }}>
                    <button className="text-sm font-medium" style={{ color: 'var(--accent-cobalt)' }}>
                      View all notifications
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-2 py-1 rounded-xl transition-colors"
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #b45309)' }}
              >
                <User className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="text-left hidden md:block">
                <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                  {user?.name || 'User'}
                </p>
              </div>
              <ChevronDown
                className="w-3 h-3 transition-transform"
                style={{ color: 'var(--text-tertiary)' }}
              />
            </motion.button>

            <AnimatePresence>
              {showUserMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-48 rounded-xl border shadow-xl overflow-hidden"
                  style={{ background: 'var(--surface-overlay)', borderColor: 'var(--border-default)', backdropFilter: 'blur(20px)' }}
                >
                  <div className="py-1">
                    <button
                      onClick={() => { setShowUserMenu(false); navigate('/profile'); }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors"
                      style={{ color: 'var(--text-primary)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <User className="w-4 h-4" />
                      Profile
                    </button>
                    <button
                      onClick={() => { setShowUserMenu(false); navigate('/settings'); }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors"
                      style={{ color: 'var(--text-primary)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </button>
                    <div style={{ borderColor: 'var(--border-subtle)' }} className="my-1 border-t" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors"
                      style={{ color: 'var(--accent-rose)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(251, 113, 133, 0.08)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>
    </>
  );
}

export default Header;
