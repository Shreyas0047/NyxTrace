import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, LoginCredentials, UserRole } from '../types';
import { RolePermissions as BackendRolePermissions } from '../types';
import api from '../services/api';

// Permission type
type Permission = string;

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  permissions: Permission[];
  login: (credentials: LoginCredentials) => Promise<{ user: User } | null>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: UserRole | UserRole[]) => boolean;
  isAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      permissions: [],

      login: async (credentials: LoginCredentials): Promise<{ user: User } | null> => {
        set({ isLoading: true, error: null });

        try {
          const response = await api.login(credentials);
          if (response.success && response.data) {
            const user = response.data.user;
            const permissions = BackendRolePermissions[user.role as UserRole] || [];
            const accessToken = response.data.tokens.accessToken;
            const refreshToken = response.data.tokens.refreshToken;
            localStorage.setItem('accessToken', accessToken);
            if (refreshToken) {
              localStorage.setItem('refreshToken', refreshToken);
            }
            set({
              user: user,
              token: accessToken,
              isAuthenticated: true,
              isLoading: false,
              permissions: permissions,
            });
            return { user: user };
          }
          set({ isLoading: false, error: response.message || 'Invalid email or password' });
          return null;
        } catch (error: unknown) {
          let errorMessage = 'Login failed. Please check your credentials.';
          if (error && typeof error === 'object' && 'response' in error) {
            const axiosError = error as { response?: { status?: number; data?: { message?: string } } };
            if (axiosError.response?.data?.message) {
              errorMessage = axiosError.response.data.message;
            } else if (axiosError.response?.status === 429) {
              errorMessage = 'Too many login attempts. Please wait before trying again.';
            } else if (axiosError.response?.status === 401) {
              errorMessage = 'Invalid email or password.';
            }
          }
          set({ isLoading: false, error: errorMessage });
          throw error;
        }
      },

      logout: async () => {
        try {
          await api.logout();
        } catch {
          // Ignore logout errors
        }
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      },

      checkAuth: async () => {
        let lsToken: string | null = null;
        try { lsToken = localStorage.getItem('accessToken'); } catch { /* storage unavailable */ }
        const token = get().token || lsToken;

        if (!token) {
          set({ isAuthenticated: false, permissions: [] });
          return;
        }

        if (!get().token && token) {
          set({ token });
        }

        set({ isLoading: true });
        try {
          const response = await api.getCurrentUser();
          if (response.success && response.data) {
            const user = response.data.user;
            const permissions = BackendRolePermissions[user.role as UserRole] || [];
            set({
              user: user,
              isAuthenticated: true,
              isLoading: false,
              permissions: permissions,
            });
          } else {
            set({
              user: null,
              token: null,
              isAuthenticated: false,
              isLoading: false,
              permissions: [],
            });
          }
        } catch {
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            permissions: [],
          });
        }
      },

      clearError: () => set({ error: null }),

      hasPermission: (permission: string): boolean => {
        const { user, permissions } = get();
        // Admin has all permissions
        if (user?.role === 'admin' || user?.role === 'super_admin') {
          return true;
        }
        return permissions.includes(permission);
      },

      hasRole: (role: UserRole | UserRole[]): boolean => {
        const { user } = get();
        if (!user) return false;
        if (Array.isArray(role)) {
          return role.includes(user.role as UserRole);
        }
        return user.role === role;
      },

      isAdmin: (): boolean => {
        const { user } = get();
        return user?.role === 'admin' || user?.role === 'super_admin';
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token, user: state.user, permissions: state.permissions }),
    }
  )
);
