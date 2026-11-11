import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpRequest, HttpHandlerFn, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';

describe('authInterceptor', () => {
  let mockTokenStorage: { getAccessToken: ReturnType<typeof vi.fn<() => string | null>> };
  let mockNext: HttpHandlerFn;

  beforeEach(() => {
    mockTokenStorage = {
      getAccessToken: vi.fn<() => string | null>()
    };
    mockNext = vi.fn((req: HttpRequest<unknown>) => of(new HttpResponse({ status: 200 })));
  });

  const runInterceptor = (request: HttpRequest<unknown>) => {
    const token = mockTokenStorage.getAccessToken();
    if (token && !request.url.includes('/auth/login') && !request.url.includes('/auth/refresh')) {
      const cloned = request.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
      return mockNext(cloned);
    }
    return mockNext(request);
  };

  it('should attach Authorization Bearer header when token is present and endpoint is not login/refresh', () => {
    mockTokenStorage.getAccessToken.mockReturnValue('valid-jwt-token');
    const req = new HttpRequest('GET', '/api/v1/invoices');

    runInterceptor(req);

    expect(mockNext).toHaveBeenCalled();
    const passedReq = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0] as HttpRequest<unknown>;
    expect(passedReq.headers.get('Authorization')).toBe('Bearer valid-jwt-token');
  });

  it('should not attach Authorization header for /auth/login', () => {
    mockTokenStorage.getAccessToken.mockReturnValue('valid-jwt-token');
    const req = new HttpRequest('POST', '/api/v1/auth/login', { username: 'test' });

    runInterceptor(req);

    const passedReq = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0] as HttpRequest<unknown>;
    expect(passedReq.headers.has('Authorization')).toBe(false);
  });

  it('should not attach Authorization header when token is null', () => {
    mockTokenStorage.getAccessToken.mockReturnValue(null);
    const req = new HttpRequest('GET', '/api/v1/invoices');

    runInterceptor(req);

    const passedReq = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0] as HttpRequest<unknown>;
    expect(passedReq.headers.has('Authorization')).toBe(false);
  });
});
