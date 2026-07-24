import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import type { User } from '../types';

const mockUser: User = {
  id: '1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'forensic_analyst',
  createdAt: new Date().toISOString(),
};

function RoleRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) {
    return <div data-testid="redirect-login">Redirect to Login</div>;
  }
  if (!user || !allowedRoles.includes(user.role)) {
    return <div data-testid="redirect-dashboard">Redirect to Dashboard</div>;
  }
  return <div data-testid="content">{children}</div>;
}

describe('RoleRoute', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  });

  it('redirects to login when not authenticated', () => {
    render(
      <MemoryRouter>
        <RoleRoute allowedRoles={['admin']}>
          <span>Protected</span>
        </RoleRoute>
      </MemoryRouter>
    );
    expect(screen.getByTestId('redirect-login')).toBeInTheDocument();
  });

  it('redirects to dashboard when role is not allowed', () => {
    useAuthStore.setState({ user: { ...mockUser, role: 'auditor' }, isAuthenticated: true });
    render(
      <MemoryRouter>
        <RoleRoute allowedRoles={['admin', 'super_admin']}>
          <span>Protected</span>
        </RoleRoute>
      </MemoryRouter>
    );
    expect(screen.getByTestId('redirect-dashboard')).toBeInTheDocument();
  });

  it('renders children when role is allowed', () => {
    useAuthStore.setState({ user: { ...mockUser, role: 'admin' }, isAuthenticated: true });
    render(
      <MemoryRouter>
        <RoleRoute allowedRoles={['admin', 'super_admin']}>
          <span data-testid="protected-content">Protected</span>
        </RoleRoute>
      </MemoryRouter>
    );
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });
});
