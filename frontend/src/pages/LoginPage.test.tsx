import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

vi.mock('../stores/authStore', () => ({
  useAuthStore: vi.fn(),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      error: null,
      login: vi.fn(),
      clearError: vi.fn(),
    });
  });

  it('renders login page with email and password fields', async () => {
    const LoginPage = (await import('../pages/LoginPage')).default;
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );
    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
    expect(screen.getByText('Forgot password?')).toBeInTheDocument();
  });
});
