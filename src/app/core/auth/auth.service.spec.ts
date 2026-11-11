import '@angular/compiler';
import { HttpBackend, HttpRequest, HttpResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { TokenStorageService } from './token-storage.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let mockRouter: { navigate: ReturnType<typeof vi.fn<(commands: unknown[]) => Promise<boolean>>> };
  let mockBackend: { handle: ReturnType<typeof vi.fn<(req: HttpRequest<unknown>) => Observable<HttpResponse<unknown>>>> };

  beforeEach(() => {
    localStorage.clear();
    mockRouter = { navigate: vi.fn<(commands: unknown[]) => Promise<boolean>>().mockResolvedValue(true) };
    mockBackend = {
      handle: vi.fn((req: HttpRequest<unknown>) => {
        if (req.url.endsWith('/auth/login')) {
          return of(
            new HttpResponse({
              status: 200,
              body: {
                accessToken: 'jwt-123',
                refreshToken: 'ref-456',
                user: { id: 1, companyId: 1, email: 'admin@finledger.com', fullName: 'Admin User' },
                permissions: ['INVOICE_VIEW', 'INVOICE_CREATE']
              }
            })
          );
        }
        if (req.url.endsWith('/auth/me')) {
          return of(
            new HttpResponse({
              status: 200,
              body: {
                user: { id: 1, companyId: 1, email: 'admin@finledger.com', fullName: 'Admin User' },
                company: {
                  id: 1,
                  code: 'BSB',
                  legalName: 'BSB Trading LLC',
                  countryCode: 'AE',
                  baseCurrency: 'AED',
                  fiscalYearStartMonth: 1,
                  isActive: true
                },
                permissions: ['INVOICE_VIEW', 'INVOICE_CREATE']
              }
            })
          );
        }
        if (req.url.endsWith('/auth/refresh')) {
          return of(
            new HttpResponse({
              status: 200,
              body: { accessToken: 'jwt-new', refreshToken: 'ref-new' }
            })
          );
        }
        return of(new HttpResponse({ status: 204 }));
      })
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        TokenStorageService,
        { provide: Router, useValue: mockRouter },
        { provide: HttpBackend, useValue: mockBackend }
      ]
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('should authenticate, persist tokens, hydrate company/permissions, and evaluate hasPermission', () => {
    let resolvedName = '';
    service.login({ email: 'admin@finledger.com', password: 'password' }).subscribe(me => {
      resolvedName = me.company.legalName;
    });

    expect(resolvedName).toBe('BSB Trading LLC');
    expect(service.isAuthenticated()).toBe(true);
    expect(service.currentUser()?.email).toBe('admin@finledger.com');
    expect(service.currentCompany()?.baseCurrency).toBe('AED');
    expect(localStorage.getItem('finledger_access_token')).toBe('jwt-123');
    expect(localStorage.getItem('finledger_refresh_token')).toBe('ref-456');

    expect(service.hasPermission('INVOICE_CREATE')).toBe(true);
    expect(service.hasPermission('JOURNAL_VOID')).toBe(false);
    expect(service.hasAnyPermission(['JOURNAL_VOID', 'INVOICE_VIEW'])).toBe(true);
  });

  it('should rotate refresh token and store updated tokens', () => {
    localStorage.setItem('finledger_refresh_token', 'ref-old');

    let newJwt = '';
    service.refreshToken().subscribe(res => {
      newJwt = res.accessToken;
    });

    expect(newJwt).toBe('jwt-new');
    expect(localStorage.getItem('finledger_access_token')).toBe('jwt-new');
    expect(localStorage.getItem('finledger_refresh_token')).toBe('ref-new');
  });

  it('should clear session, tokens, and navigate to login on logout', () => {
    service.login({ email: 'admin@finledger.com', password: 'password' }).subscribe();
    expect(service.isAuthenticated()).toBe(true);

    service.logout(true);

    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
    expect(service.permissions().size).toBe(0);
    expect(localStorage.getItem('finledger_access_token')).toBeNull();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
  });
});
