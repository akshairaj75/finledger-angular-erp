import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  BehaviorSubject,
  Observable,
  catchError,
  filter,
  finalize,
  map,
  of,
  switchMap,
  take,
  tap,
  throwError
} from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AuthResponse,
  ChangePasswordRequest,
  CompanyProfile,
  LoginRequest,
  MeResponse,
  TokenResponse
} from '../models/auth.model';
import { User } from '../models/user.model';
import { TokenStorageService } from './token-storage.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private rawHttp = new HttpClient(inject(HttpBackend));
  private tokenStorage = inject(TokenStorageService);
  private router = inject(Router);
  private base = `${environment.apiBaseUrl}/auth`;

  private currentUserSignal = signal<User | null>(null);
  private currentCompanySignal = signal<CompanyProfile | null>(null);
  private permissionsSignal = signal<Set<string>>(new Set());

  private isRefreshing = false;
  private refreshTokenSubject = new BehaviorSubject<string | null>(null);

  public readonly currentUser = this.currentUserSignal.asReadonly();
  public readonly currentCompany = this.currentCompanySignal.asReadonly();
  public readonly permissions = this.permissionsSignal.asReadonly();
  public readonly isAuthenticated = computed(() => !!this.currentUserSignal());

  /**
   * Restores user session and company metadata on application bootstrap.
   */
  initializeSession(): Observable<void> {
    const accessToken = this.tokenStorage.getAccessToken();
    const refreshToken = this.tokenStorage.getRefreshToken();

    if (!accessToken && !refreshToken) {
      return of(void 0);
    }

    if (accessToken) {
      return this.fetchMeRaw(accessToken).pipe(
        catchError(() => {
          if (refreshToken) {
            return this.refreshToken().pipe(
              switchMap(res => this.fetchMeRaw(res.accessToken)),
              catchError(() => {
                this.clearSession();
                return of(void 0);
              })
            );
          }
          this.clearSession();
          return of(void 0);
        })
      );
    }

    return this.refreshToken().pipe(
      switchMap(res => this.fetchMeRaw(res.accessToken)),
      catchError(() => {
        this.clearSession();
        return of(void 0);
      })
    );
  }

  login(request: LoginRequest): Observable<MeResponse> {
    return this.rawHttp.post<AuthResponse>(`${this.base}/login`, request).pipe(
      tap(res => {
        this.tokenStorage.setAccessToken(res.accessToken);
        this.tokenStorage.setRefreshToken(res.refreshToken);
        this.currentUserSignal.set(res.user);
        this.permissionsSignal.set(new Set(res.permissions || []));
      }),
      switchMap(res =>
        this.rawHttp
          .get<MeResponse>(`${this.base}/me`, {
            headers: { Authorization: `Bearer ${res.accessToken}` }
          })
          .pipe(
            tap(me => {
              this.currentUserSignal.set(me.user);
              this.currentCompanySignal.set(me.company);
              this.permissionsSignal.set(new Set(me.permissions || []));
            }),
            catchError(() =>
              of({
                user: res.user,
                company: {
                  id: res.user.companyId || 1,
                  code: 'BSB',
                  legalName: 'BSB Trading LLC',
                  countryCode: 'AE',
                  baseCurrency: 'AED',
                  fiscalYearStartMonth: 1,
                  isActive: true
                },
                permissions: res.permissions
              } as MeResponse)
            )
          )
      )
    );
  }

  /**
   * Coordinates concurrent 401 responses so refresh token rotation executes once.
   */
  refreshToken(): Observable<TokenResponse> {
    const refresh = this.tokenStorage.getRefreshToken();
    if (!refresh) {
      return throwError(() => new Error('No refresh token available'));
    }

    if (this.isRefreshing) {
      return this.refreshTokenSubject.pipe(
        filter((token): token is string => token !== null),
        take(1),
        map(accessToken => ({
          accessToken,
          refreshToken: this.tokenStorage.getRefreshToken() || ''
        }))
      );
    }

    this.isRefreshing = true;
    this.refreshTokenSubject.next(null);

    return this.rawHttp.post<TokenResponse>(`${this.base}/refresh`, { refreshToken: refresh }).pipe(
      tap(res => {
        this.tokenStorage.setAccessToken(res.accessToken);
        this.tokenStorage.setRefreshToken(res.refreshToken);
        this.refreshTokenSubject.next(res.accessToken);
      }),
      catchError(err => {
        this.clearSession();
        return throwError(() => err);
      }),
      finalize(() => {
        this.isRefreshing = false;
      })
    );
  }

  changePassword(request: ChangePasswordRequest): Observable<void> {
    return this.http.post<void>(`${this.base}/change-password`, request);
  }

  reloadProfile(): Observable<MeResponse> {
    return this.http.get<MeResponse>(`${this.base}/me`).pipe(
      tap(me => {
        this.currentUserSignal.set(me.user);
        this.currentCompanySignal.set(me.company);
        this.permissionsSignal.set(new Set(me.permissions || []));
      })
    );
  }

  logout(redirectToLogin: boolean = true): void {
    const refreshToken = this.tokenStorage.getRefreshToken();
    if (refreshToken) {
      this.rawHttp
        .post(`${this.base}/logout`, { refreshToken })
        .pipe(catchError(() => of(void 0)))
        .subscribe();
    }

    this.clearSession();
    if (redirectToLogin) {
      this.router.navigate(['/login']);
    }
  }

  clearSession(): void {
    this.tokenStorage.clearTokens();
    this.currentUserSignal.set(null);
    this.currentCompanySignal.set(null);
    this.permissionsSignal.set(new Set());
  }

  hasPermission(permission: string): boolean {
    return this.permissionsSignal().has(permission);
  }

  hasAnyPermission(permissions: string[]): boolean {
    if (!permissions || permissions.length === 0) {
      return true;
    }
    const granted = this.permissionsSignal();
    return permissions.some(p => granted.has(p));
  }

  private fetchMeRaw(accessToken: string): Observable<void> {
    return this.rawHttp
      .get<MeResponse>(`${this.base}/me`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      .pipe(
        tap(me => {
          this.currentUserSignal.set(me.user);
          this.currentCompanySignal.set(me.company);
          this.permissionsSignal.set(new Set(me.permissions || []));
        }),
        map(() => void 0)
      );
  }
}

