import '@angular/compiler';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../auth/auth.service';
import { NotificationService } from '../services/notification.service';
import { authGuard, guestGuard, permissionGuard } from './auth.guard';

describe('Auth & Permission Route Guards', () => {
  let isAuthenticatedSig = signal(false);
  let hasAnyPermissionMock: ReturnType<typeof vi.fn<(perms: string[]) => boolean>>;
  let mockRouter: { createUrlTree: ReturnType<typeof vi.fn<(commands: string[], extras?: unknown) => UrlTree>> };
  let mockNotification: { warning: ReturnType<typeof vi.fn<(msg: string) => void>> };

  beforeEach(() => {
    isAuthenticatedSig = signal(false);
    hasAnyPermissionMock = vi.fn<(perms: string[]) => boolean>();
    mockRouter = {
      createUrlTree: vi.fn((commands: string[], extras?: unknown) => ({ commands, extras }) as unknown as UrlTree)
    };
    mockNotification = { warning: vi.fn<(msg: string) => void>() };

    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: isAuthenticatedSig,
            hasAnyPermission: hasAnyPermissionMock
          }
        },
        { provide: Router, useValue: mockRouter },
        { provide: NotificationService, useValue: mockNotification }
      ]
    });
  });

  it('authGuard should redirect unauthenticated users to /login with returnUrl', () => {
    isAuthenticatedSig.set(false);
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/sales/invoices' } as RouterStateSnapshot)
    );

    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/sales/invoices' }
    });
    expect(result).not.toBe(true);
  });

  it('authGuard should allow authenticated users', () => {
    isAuthenticatedSig.set(true);
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/sales/invoices' } as RouterStateSnapshot)
    );
    expect(result).toBe(true);
  });

  it('guestGuard should redirect authenticated users to /dashboard', () => {
    isAuthenticatedSig.set(true);
    TestBed.runInInjectionContext(() =>
      guestGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/dashboard']);
  });

  it('permissionGuard should redirect to /unauthorized when lacking required permission', () => {
    isAuthenticatedSig.set(true);
    hasAnyPermissionMock.mockReturnValue(false);

    const route = { data: { permissions: ['JOURNAL_POST'] } } as unknown as ActivatedRouteSnapshot;
    TestBed.runInInjectionContext(() => permissionGuard(route, {} as RouterStateSnapshot));

    expect(hasAnyPermissionMock).toHaveBeenCalledWith(['JOURNAL_POST']);
    expect(mockNotification.warning).toHaveBeenCalled();
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/unauthorized']);
  });

  it('permissionGuard should allow access when user holds required permission', () => {
    isAuthenticatedSig.set(true);
    hasAnyPermissionMock.mockReturnValue(true);

    const route = { data: { permissions: ['INVOICE_VIEW'] } } as unknown as ActivatedRouteSnapshot;
    const result = TestBed.runInInjectionContext(() => permissionGuard(route, {} as RouterStateSnapshot));

    expect(result).toBe(true);
  });
});
