import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Search, User, LogOut, Settings,
  ChevronDown, ChevronRight,
  AlertTriangle, CheckCircle, Info, X,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import ConnectionStatus from './ConnectionStatus';

export interface BreadcrumbItem {
  label: string;
  path?: string;
  icon?: React.ComponentType<{ className?: string }>;
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
      case 'critical': return <AlertTriangle className="w-4 h-4 text-rose-500" />;
      case 'success': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      default: return <Info className="w-4 h-4 text-amber-600 " />;
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
              className="w-full max-w-2xl rounded-[20px] border shadow-2xl overflow-hidden"
              style={{ background: 'var(--surface-overlay)', borderColor: 'var(--border-default)', backdropFilter: 'blur(24px)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 px-4 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <Search className="w-5 h-5 text-[var(--text-tertiary)]" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search cases, evidence, sandbox sessions, reports..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent text-sm font-body text-[var(--text-secondary)] placeholder:text-[var(--text-tertiary)] outline-none"
                />
                <button onClick={() => setShowSearch(false)} className="p-1 rounded-[8px] hover:bg-[var(--surface-container)]">
                  <X className="w-4 h-4 text-[var(--text-tertiary)]" />
                </button>
              </div>
              <div className="p-2 bg-transparent">
                <div className="flex items-center gap-2 px-2 py-1">
                  <span className="text-xs font-mono text-[var(--text-tertiary)] tracking-[0.12em] uppercase">Quick actions</span>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {[
                  { title: 'Upload Evidence', description: 'Add files to repository', action: () => { setShowSearch(false); navigate('/evidence?upload=true'); }},
                ].map((item, index) => (
                  <button
                    key={index}
                    onClick={item.action}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--surface-container)] transition-colors"
                  >
                    <div className="p-2 rounded-[10px] bg-[var(--surface-container)]">
                      <Search className="w-4 h-4 text-[var(--text-tertiary)]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-secondary)] font-body">{item.title}</p>
                      <p className="text-xs text-[var(--text-tertiary)] font-body">{item.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <header
        className="h-14 flex items-center justify-between px-3 md:px-5 sticky top-0 z-40 border-b"
        style={{
          background: 'var(--surface-overlay)',
          borderColor: 'var(--border-subtle)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <nav className="hidden md:flex items-center gap-1.5 text-sm font-body">
            {breadcrumbs.slice(1).map((item, index) => (
              <div key={index} className="flex items-center gap-1.5">
                {index > 0 && <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />}
                {item.path ? (
                  <Link
                    to={item.path}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-[8px] text-sm font-medium transition-colors font-body"
                    style={{ color: 'var(--text-tertiary)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}
                  >
                    {item.icon && <item.icon className="w-3.5 h-3.5" />}
                    {item.label}
                  </Link>
                ) : (
                  <span className="flex items-center gap-1.5 px-2 py-1 font-body" style={{ color: 'var(--text-primary)' }}>
                    {item.icon && <item.icon className="w-3.5 h-3.5" />}
                    {item.label}
                  </span>
                )}
              </div>
            ))}
            {currentPage && (
              <span style={{ color: 'var(--text-tertiary)' }} className="mx-1 text-[var(--text-tertiary)]">/</span>
            )}
            {currentPage && (
              <span className="font-display text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {currentPage}
              </span>
            )}
          </nav>
          {currentPage && (
            <span className="md:hidden text-sm font-display font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
              {currentPage}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowSearch(true)}
            className="hidden sm:flex items-center justify-center w-9 h-9 rounded-[10px] transition-colors text-[var(--text-tertiary)] hover:bg-[var(--surface-container)] hover:text-[var(--text-secondary)]"
          >
            <Search className="w-4 h-4" />
          </motion.button>

          <div className="hidden md:block">
            <ConnectionStatus />
          </div>

          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative flex items-center justify-center w-9 h-9 rounded-[10px] transition-colors text-[var(--text-tertiary)] hover:bg-[var(--surface-container)] hover:text-[var(--text-secondary)]"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-rose-500 rounded-full pulse-ring" />
            </motion.button>

            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-80 rounded-[20px] border shadow-xl overflow-hidden"
                  style={{ background: 'var(--surface-overlay)', borderColor: 'var(--border-default)', backdropFilter: 'blur(24px)' }}
                >
                  <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                    <h3 className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Notifications</h3>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className="px-4 py-3 cursor-pointer border-b transition-colors hover:bg-[var(--surface-container)]"
                        style={{ borderColor: 'var(--border-subtle)' }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">{getNotificationIcon(notification.type)}</div>
                          <div className="flex-1">
                            <p className="text-sm font-body" style={{ color: 'var(--text-primary)' }}>{notification.message}</p>
                            <p className="text-xs font-body mt-1" style={{ color: 'var(--text-tertiary)' }}>{notification.time}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-3 border-t bg-[var(--surface-container)]" style={{ borderColor: 'var(--border-subtle)' }}>
                    <button className="text-sm font-medium font-body text-amber-600  hover:text-amber-300 transition-colors">
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
              className="flex items-center gap-1 px-1 md:px-2 py-1 rounded-[10px] transition-colors hover:bg-[var(--surface-container)]"
            >
              <div
                className="w-7 h-7 rounded-[8px] flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #b45309)' }}
              >
                <User className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="text-left hidden md:block">
                <p className="text-xs font-medium font-body" style={{ color: 'var(--text-primary)' }}>
                  {user?.name || 'User'}
                </p>
              </div>
              <ChevronDown
                className="w-3 h-3 transition-transform hidden md:block"
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
                  className="absolute right-0 mt-2 w-48 rounded-[14px] border shadow-xl overflow-hidden"
                  style={{ background: 'var(--surface-overlay)', borderColor: 'var(--border-default)', backdropFilter: 'blur(24px)' }}
                >
                  <div className="py-1">
                    <button
                      onClick={() => { setShowUserMenu(false); navigate('/profile'); }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm font-body transition-colors"
                      style={{ color: 'var(--text-primary)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <User className="w-4 h-4" />
                      Profile
                    </button>
                    <button
                      onClick={() => { setShowUserMenu(false); navigate('/settings'); }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm font-body transition-colors"
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
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm font-body transition-colors text-rose-600  hover:bg-rose-500/10"
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
