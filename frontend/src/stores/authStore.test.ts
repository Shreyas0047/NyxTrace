import { useAuthStore } from './authStore';
import type { User } from '../types';

const mockUser: User = {
  id: '1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'admin',
  createdAt: new Date().toISOString(),
};

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    login: vi.fn(),
    logout: vi.fn(),
    getCurrentUser: vi.fn(),
  },
}));

vi.mock('../services/api', () => ({
  default: mockApi,
}));

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      permissions: [],
    });
  });

  it('starts unauthenticated', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
  });

  it('handles successful login', async () => {
    mockApi.login.mockResolvedValueOnce({
      success: true,
      data: {
        user: mockUser,
        tokens: { accessToken: 'test-token', refreshToken: 'test-refresh' },
      },
    });

    const result = await useAuthStore.getState().login({ email: 'test@example.com', password: 'pass' });

    expect(result).toEqual({ user: mockUser });
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(mockUser);
    expect(state.token).toBe('test-token');
    expect(localStorage.getItem('accessToken')).toBe('test-token');
  });

  it('handles login failure', async () => {
    mockApi.login.mockResolvedValueOnce({
      success: false,
      message: 'Invalid email or password',
    });

    const result = await useAuthStore.getState().login({ email: 'bad@example.com', password: 'wrong' });

    expect(result).toBeNull();
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.error).toBe('Invalid email or password');
  });

  it('handles logout', async () => {
    useAuthStore.setState({
      user: mockUser,
      token: 'test-token',
      isAuthenticated: true,
    });
    localStorage.setItem('accessToken', 'test-token');

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(localStorage.getItem('accessToken')).toBeNull();
  });

  it('hasPermission returns true for admin regardless', () => {
    useAuthStore.setState({ user: { ...mockUser, role: 'admin' } });
    expect(useAuthStore.getState().hasPermission('anything')).toBe(true);
  });

  it('hasPermission returns false for non-admin without permission', () => {
    useAuthStore.setState({ user: { ...mockUser, role: 'forensic_analyst' }, permissions: ['view_investigations'] });
    expect(useAuthStore.getState().hasPermission('delete_evidence')).toBe(false);
  });

  it('hasRole checks single role', () => {
    useAuthStore.setState({ user: { ...mockUser, role: 'forensic_analyst' } });
    expect(useAuthStore.getState().hasRole('forensic_analyst')).toBe(true);
    expect(useAuthStore.getState().hasRole('admin')).toBe(false);
  });

  it('hasRole checks multiple roles', () => {
    useAuthStore.setState({ user: { ...mockUser, role: 'forensic_analyst' } });
    expect(useAuthStore.getState().hasRole(['admin', 'forensic_analyst'])).toBe(true);
    expect(useAuthStore.getState().hasRole(['admin', 'super_admin'])).toBe(false);
  });

  it('isAdmin returns true for admin and super_admin', () => {
    useAuthStore.setState({ user: { ...mockUser, role: 'admin' } });
    expect(useAuthStore.getState().isAdmin()).toBe(true);
    useAuthStore.setState({ user: { ...mockUser, role: 'super_admin' } });
    expect(useAuthStore.getState().isAdmin()).toBe(true);
  });

  it('isAdmin returns false for non-admin roles', () => {
    useAuthStore.setState({ user: { ...mockUser, role: 'auditor' } });
    expect(useAuthStore.getState().isAdmin()).toBe(false);
  });

  it('checkAuth restores session from existing token', async () => {
    useAuthStore.setState({ token: 'existing-token' });
    mockApi.getCurrentUser.mockResolvedValueOnce({
      success: true,
      data: { user: mockUser },
    });

    await useAuthStore.getState().checkAuth();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(mockUser);
  });

  it('checkAuth clears session on invalid token', async () => {
    useAuthStore.setState({ token: 'invalid-token', user: mockUser, isAuthenticated: true });
    mockApi.getCurrentUser.mockRejectedValueOnce(new Error('Unauthorized'));

    await useAuthStore.getState().checkAuth();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
  });
});
