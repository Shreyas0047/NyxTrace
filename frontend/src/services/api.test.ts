const mockClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  interceptors: {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  },
};

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => mockClient),
  },
}));

vi.mock('../config', () => ({
  config: {
    env: { apiUrl: 'http://localhost:3000/api/v1' },
    api: { maxRetries: 2, requestTimeoutMs: 30000 },
  },
}));

describe('api service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('getInvestigations normalizes _id to id', async () => {
    const { default: api } = await import('./api');
    mockClient.get.mockResolvedValueOnce({
      data: { success: true, data: [{ _id: 'abc', name: 'Test' }] },
    });
    const result = await api.getInvestigations({ page: 1, limit: 10 });
    expect(result.data?.[0]).toHaveProperty('id', 'abc');
  });

  it('normalizeEntity preserves existing id', async () => {
    const { default: api } = await import('./api');
    mockClient.get.mockResolvedValueOnce({
      data: { success: true, data: [{ _id: 'x', id: 'y' }] },
    });
    const result = await api.getInvestigations({ page: 1, limit: 10 });
    expect(result.data?.[0]).toHaveProperty('id', 'y');
  });

  it('login sends correct payload', async () => {
    const { default: api } = await import('./api');
    mockClient.post.mockResolvedValueOnce({
      data: { success: true, data: { user: { _id: '1' }, tokens: {} } },
    });
    await api.login({ email: 'user@test.com', password: 'secret' });
    expect(mockClient.post).toHaveBeenCalledWith('/auth/login', { email: 'user@test.com', password: 'secret' });
  });

  it('rejects on network error', async () => {
    const { default: api } = await import('./api');
    mockClient.post.mockRejectedValueOnce({
      response: { status: 401, data: { message: 'Invalid credentials' } },
    });
    await expect(api.login({ email: 'a@b.com', password: 'p' })).rejects.toThrow();
  });
});
