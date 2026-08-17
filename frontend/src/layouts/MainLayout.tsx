/**
 * Enterprise Application Shell
 * Professional SOC-style layout with refined navigation and workspace
 */

import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Suspense, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';
import { StatusBanner } from '../components/ui/StatusBanner';
import { useStatusStore } from '../stores/statusStore';
import { cn } from '../design-system';
import type { BreadcrumbItem } from '../components/layout/Header';
import {
  Home,
  LayoutDashboard,
  Folder,
  Activity,
  Brain,
  Terminal,
  Layers,
  Heart,
  Link2,
  AlertTriangle,
  Settings,
  Users,
  History,
} from 'lucide-react';

const routeBreadcrumbs: Record<string, BreadcrumbItem[]> = {
  '/home': [{ label: 'Home', icon: Home }],
  '/dashboard': [{ label: 'Dashboard', icon: LayoutDashboard }],
  '/evidence': [{ label: 'Evidence', icon: Folder }],
  '/sandbox': [{ label: 'Sandbox', icon: Terminal }],
  '/ai-analysis': [{ label: 'AI Analysis', icon: Brain }],
  '/telemetry': [{ label: 'Telemetry', icon: Activity }],
  '/reports': [{ label: 'Reports', icon: Layers }],
  '/health': [{ label: 'System Health', icon: Heart }],
  '/blockchain-operations': [{ label: 'Blockchain Ops', icon: Link2 }],
  '/threat-intelligence': [{ label: 'Threat Intel', icon: AlertTriangle }],
  '/users': [{ label: 'Users', icon: Users }],
  '/settings': [{ label: 'Settings', icon: Settings }],
  '/audit': [{ label: 'Audit Log', icon: History }],
};

const pageNames: Record<string, string> = {
  '/home': 'Home',
  '/dashboard': 'Operations Dashboard',
  '/evidence': 'Evidence Explorer',
  '/sandbox': 'Sandbox Console',
  '/ai-analysis': 'AI Analysis Engine',
  '/telemetry': 'Live Telemetry',
  '/reports': 'Forensic Reports',
  '/health': 'System Health',
  '/blockchain-operations': 'Blockchain Operations',
  '/threat-intelligence': 'Threat Intelligence',
  '/users': 'User Management',
  '/settings': 'Settings',
  '/audit': 'Audit Log',
};

export function MainLayout() {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const getBreadcrumbs = (): BreadcrumbItem[] => {
    const basePath = '/' + location.pathname.split('/')[1];
    if (basePath === '/home') {
      return [{ label: 'Home', icon: Home }];
    }
    if (basePath === '/investigations') {
      return [{ label: 'Home', icon: Home }, { label: 'Case Detail' }];
    }
    const items = routeBreadcrumbs[basePath] || [];
    return [{ label: 'Home', icon: Home }, ...items];
  };

  const breadcrumbs = getBreadcrumbs();
  const currentPage = pageNames[location.pathname] || 'Page';

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: 'var(--surface-base)' }}>
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={setSidebarCollapsed}
      />

      {/* Main Content Area */}
      <div
        className={cn(
          'min-h-screen flex flex-col transition-all duration-300',
          sidebarCollapsed ? 'ml-[72px]' : 'ml-[260px]'
        )}
      >
        {/* Sticky Header */}
        <Header
          breadcrumbs={breadcrumbs}
          currentPage={currentPage}
        />

        {/* Global Status Bar */}
        <div className="px-6 pt-4">
          <StatusBanner
            status={useStatusStore((s) => s.status)}
            onDismiss={useStatusStore((s) => s.dismiss)}
          />
        </div>

        {/* Page Content with Smooth Transitions */}
        <main className="flex-1 p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{
                duration: 0.25,
                ease: [0.4, 0, 0.2, 1]
              }}
              className="h-full"
            >
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-24">
                    <Loader2 className="w-6 h-6 animate-spin text-[var(--text-secondary)] " />
                  </div>
                }
              >
                <Outlet />
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default MainLayout;
