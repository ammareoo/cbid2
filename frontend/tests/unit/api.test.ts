import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, setCsrfToken, setUnauthorizedHandler } from '../../src/api/client';

afterEach(() => {
  vi.restoreAllMocks();
  setCsrfToken(null);
  setUnauthorizedHandler(null);
});

describe('API response and failure handling', () => {
  it('rejects an HTML success response from a misconfigured proxy', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<html>Sign in</html>', {
      headers: { 'content-type': 'text/html' },
    }));
    await expect(api.get('/me/profile')).rejects.toMatchObject({ code: 'invalid_response', status: 502 });
  });

  it('reports a timeout without suggesting the mutation definitely failed', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new DOMException('Timed out', 'TimeoutError'));
    await expect(api.post('/assignments/example/submissions', { body: 'My answer' })).rejects.toMatchObject({
      code: 'timeout', message: 'The server took too long to respond. Refresh to check the result.',
    });
  });

  it('accepts an empty successful deletion response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    await expect(api.del('/me/profile/photo')).resolves.toBeUndefined();
  });

  it('expires cached authentication on a private API denial', async () => {
    const expired = vi.fn();
    setUnauthorizedHandler(expired);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', {
      status: 401, headers: { 'content-type': 'application/json' },
    }));
    await expect(api.get('/me/profile')).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledOnce();
  });
});
