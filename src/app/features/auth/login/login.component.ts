import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { LocaleService } from '../../../core/services/locale.service';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  template: `
    <div class="login-split-page">
      <!-- Left Product Showcase Panel (FinLedger v2.0 Section 4.1) -->
      <section class="brand-panel">
        <div class="brand-content">
          <div class="logo-row">
            <div class="brand-badge">FL</div>
            <div>
              <span class="brand-title">{{ 'app.title' | translate }}</span>
              <span class="brand-version">{{ 'app.version' | translate }}</span>
            </div>
          </div>

          <h1>{{ 'login.headline' | translate }}</h1>
          <p class="lead-copy">
            {{ 'login.lead' | translate }}
          </p>

          <ul class="feature-list">
            <li>
              <span class="feat-icon">📖</span>
              <div>
                <strong>{{ 'login.featGl' | translate }}</strong>
                <span>{{ 'login.featGlDesc' | translate }}</span>
              </div>
            </li>
            <li>
              <span class="feat-icon">📦</span>
              <div>
                <strong>{{ 'login.featCosting' | translate }}</strong>
                <span>{{ 'login.featCostingDesc' | translate }}</span>
              </div>
            </li>
            <li>
              <span class="feat-icon">📑</span>
              <div>
                <strong>{{ 'login.featVat' | translate }}</strong>
                <span>{{ 'login.featVatDesc' | translate }}</span>
              </div>
            </li>
            <li>
              <span class="feat-icon">🏦</span>
              <div>
                <strong>{{ 'login.featCrm' | translate }}</strong>
                <span>{{ 'login.featCrmDesc' | translate }}</span>
              </div>
            </li>
          </ul>
        </div>
      </section>

      <!-- Right Sign-In Panel -->
      <section class="form-panel">
        <div class="login-top-bar">
          <div class="login-lang-wrapper">
            <button
              type="button"
              class="lang-pill-btn"
              (click)="toggleLangMenu()"
              [attr.aria-label]="'lang.selectLanguage' | translate"
            >
              🌐 <span>{{ localeService.currentConfig().nativeName }}</span>
              <span class="caret">▾</span>
            </button>

            <div class="login-lang-dropdown" *ngIf="showLangMenu()">
              <button
                *ngFor="let loc of localeService.availableLocales()"
                type="button"
                class="login-lang-option"
                [class.active]="loc.code === localeService.locale()"
                (click)="selectLocale(loc.code)"
              >
                <span class="lang-opt-native">{{ loc.nativeName }}</span>
                <span class="lang-opt-eng">({{ loc.name }})</span>
                <span *ngIf="loc.code === localeService.locale()" class="lang-opt-check">✓</span>
              </button>
            </div>
          </div>
        </div>

        <div class="login-card">
          <div class="form-header">
            <h2>{{ 'login.cardTitle' | translate }}</h2>
            <p>{{ 'login.cardSubtitle' | translate }}</p>
          </div>

          <div *ngIf="errorBanner()" class="error-alert" [class.locked-alert]="isLocked()">
            <span class="alert-icon">{{ isLocked() ? '🔒' : '⚠️' }}</span>
            <div class="alert-body">
              <strong>{{ isLocked() ? ('login.accountLocked' | translate) : ('login.authFailed' | translate) }}</strong>
              <p>{{ errorBanner() }}</p>
            </div>
          </div>

          <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="login-form">
            <div class="form-group">
              <label for="email">{{ 'login.workEmail' | translate }}</label>
              <input
                id="email"
                type="email"
                formControlName="email"
                [placeholder]="localeService.t('login.workEmailPlaceholder')"
                autocomplete="email"
                [class.invalid]="isInvalid('email')"
              />
              <span class="field-error" *ngIf="isInvalid('email')">
                {{ 'login.emailError' | translate }}
              </span>
            </div>

            <div class="form-group">
              <label for="password">{{ 'login.password' | translate }}</label>
              <div class="password-wrapper">
                <input
                  id="password"
                  [type]="showPassword() ? 'text' : 'password'"
                  formControlName="password"
                  [placeholder]="localeService.t('login.passwordPlaceholder')"
                  autocomplete="current-password"
                  [class.invalid]="isInvalid('password')"
                />
                <button
                  type="button"
                  class="toggle-pw"
                  (click)="showPassword.set(!showPassword())"
                  tabindex="-1"
                  [attr.aria-label]="showPassword() ? ('login.hide' | translate) : ('login.show' | translate)"
                >
                  {{ showPassword() ? ('login.hide' | translate) : ('login.show' | translate) }}
                </button>
              </div>
              <span class="field-error" *ngIf="isInvalid('password')">
                {{ 'login.passwordError' | translate }}
              </span>
            </div>

            <button type="submit" class="btn-submit" [disabled]="loading() || loginForm.invalid">
              <span *ngIf="loading()" class="spinner-sm"></span>
              {{ loading() ? ('login.signingIn' | translate) : ('login.signIn' | translate) }}
            </button>
          </form>

          <div *ngIf="!isProduction" class="dev-hint">
            <span>{{ 'login.devCreds' | translate }}</span>
            <code>admin&#64;finledger.com</code> / <code>password</code>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .login-split-page {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 1.15fr 1fr;
      background: #f8fafc;
    }

    @media (max-width: 920px) {
      .login-split-page {
        grid-template-columns: 1fr;
      }
      .brand-panel {
        display: none;
      }
    }

    .brand-panel {
      background: linear-gradient(145deg, #0f172a 0%, #1e293b 55%, #0f172a 100%);
      color: #f8fafc;
      padding-block: 3.5rem;
      padding-inline: 4rem;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
    }

    .brand-panel::before {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at 20% 20%, rgba(37, 99, 235, 0.25), transparent 50%),
                  radial-gradient(circle at 80% 85%, rgba(16, 185, 129, 0.14), transparent 45%);
      pointer-events: none;
    }

    .brand-content {
      max-width: 520px;
      position: relative;
      z-index: 1;
    }

    .logo-row {
      display: flex;
      align-items: center;
      gap: 0.9rem;
      margin-block-end: 2.25rem;
    }

    .brand-badge {
      width: 46px;
      height: 46px;
      background: #2563eb;
      color: #ffffff;
      font-weight: 800;
      font-size: 1.15rem;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .brand-title {
      display: block;
      font-size: 1.35rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1.1;
    }

    .brand-version {
      font-size: 0.75rem;
      color: #94a3b8;
      font-weight: 600;
    }

    .brand-panel h1 {
      font-size: 2.1rem;
      font-weight: 800;
      line-height: 1.25;
      margin: 0 0 1rem;
      color: #ffffff;
      letter-spacing: -0.02em;
    }

    .lead-copy {
      font-size: 1rem;
      color: #94a3b8;
      line-height: 1.6;
      margin-block-end: 2.25rem;
    }

    .feature-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 1.15rem;
    }

    .feature-list li {
      display: flex;
      align-items: flex-start;
      gap: 0.85rem;
    }

    .feat-icon {
      font-size: 1.35rem;
      line-height: 1.2;
      flex-shrink: 0;
    }

    .feature-list strong {
      display: block;
      color: #f1f5f9;
      font-size: 0.95rem;
      font-weight: 600;
      margin-block-end: 0.15rem;
    }

    .feature-list span {
      display: block;
      color: #94a3b8;
      font-size: 0.825rem;
      line-height: 1.45;
    }

    .form-panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding-block: 2rem;
      padding-inline: 2.5rem;
      position: relative;
    }

    .login-top-bar {
      position: absolute;
      inset-block-start: 1.5rem;
      inset-inline-end: 1.5rem;
      z-index: 100;
    }

    .login-lang-wrapper {
      position: relative;
    }

    .lang-pill-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.35rem 0.75rem;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 20px;
      font-size: 0.8rem;
      color: #334155;
      font-weight: 500;
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      transition: all 0.15s ease;
    }

    .lang-pill-btn:hover {
      background: #f1f5f9;
      border-color: #94a3b8;
    }

    .lang-pill-btn .caret {
      font-size: 0.7rem;
      color: #64748b;
    }

    .login-lang-dropdown {
      position: absolute;
      top: calc(100% + 6px);
      inset-inline-end: 0;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
      min-width: 170px;
      z-index: 1050;
      overflow: hidden;
      padding: 0.35rem;
    }

    .login-lang-option {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      background: transparent;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      text-align: start;
      font-size: 0.85rem;
      color: #334155;
      transition: background 0.15s ease;
    }

    .login-lang-option:hover {
      background: #f1f5f9;
    }

    .login-lang-option.active {
      background: #eff6ff;
      color: #1d4ed8;
      font-weight: 600;
    }

    .lang-opt-native {
      font-size: 0.85rem;
    }

    .lang-opt-eng {
      font-size: 0.72rem;
      color: #64748b;
    }

    .lang-opt-check {
      font-size: 0.85rem;
      color: #1d4ed8;
      font-weight: bold;
    }

    .login-card {
      width: 100%;
      max-width: 420px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding-block: 2.5rem;
      padding-inline: 2.25rem;
      box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.05),
                  0 8px 10px -6px rgba(15, 23, 42, 0.04);
    }

    .form-header {
      margin-block-end: 1.75rem;
      text-align: start;
    }

    .form-header h2 {
      font-size: 1.5rem;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
      letter-spacing: -0.02em;
    }

    .form-header p {
      margin: 0.35rem 0 0;
      font-size: 0.875rem;
      color: #64748b;
    }

    .error-alert {
      display: flex;
      gap: 0.75rem;
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #991b1b;
      padding-block: 0.85rem;
      padding-inline: 1rem;
      border-radius: 10px;
      margin-block-end: 1.25rem;
      font-size: 0.85rem;
      text-align: start;
    }

    .error-alert.locked-alert {
      background: #fffbeb;
      border-color: #fde68a;
      color: #92400e;
    }

    .alert-body strong {
      display: block;
      margin-block-end: 0.15rem;
    }

    .alert-body p {
      margin: 0;
      line-height: 1.4;
    }

    .login-form {
      display: flex;
      flex-direction: column;
      gap: 1.15rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      text-align: start;
    }

    .form-group label {
      font-size: 0.825rem;
      font-weight: 600;
      color: #334155;
    }

    .form-group input {
      width: 100%;
      box-sizing: border-box;
      padding-block: 0.7rem;
      padding-inline: 0.9rem;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 0.925rem;
      color: #0f172a;
    }

    .form-group input:focus {
      outline: none;
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
    }

    .form-group input.invalid {
      border-color: #ef4444;
    }

    .password-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }

    .password-wrapper input {
      padding-inline-end: 3.75rem;
    }

    .toggle-pw {
      position: absolute;
      inset-inline-end: 0.65rem;
      background: transparent;
      border: none;
      color: #64748b;
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
    }

    .field-error {
      font-size: 0.75rem;
      color: #dc2626;
    }

    .btn-submit {
      margin-block-start: 0.5rem;
      padding-block: 0.8rem;
      padding-inline: 1rem;
      border: none;
      border-radius: 8px;
      background: #2563eb;
      color: #ffffff;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .btn-submit:hover:not(:disabled) {
      background: #1d4ed8;
    }

    .btn-submit:disabled {
      opacity: 0.65;
      cursor: not-allowed;
    }

    .spinner-sm {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.4);
      border-top-color: #ffffff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .dev-hint {
      margin-block-start: 1.5rem;
      padding-block-start: 1rem;
      border-top: 1px solid #f1f5f9;
      text-align: center;
      font-size: 0.78rem;
      color: #64748b;
    }

    .dev-hint code {
      background: #f1f5f9;
      padding: 0.15rem 0.35rem;
      border-radius: 4px;
      color: #334155;
    }
  `]
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  public localeService = inject(LocaleService);

  public readonly isProduction = environment.production;
  public loading = signal(false);
  public showPassword = signal(false);
  public showLangMenu = signal(false);
  public errorBanner = signal<string | null>(null);
  public isLocked = signal(false);

  toggleLangMenu(): void {
    this.showLangMenu.update(v => !v);
  }

  selectLocale(code: string): void {
    this.localeService.setLocale(code);
    this.showLangMenu.set(false);
  }

  public loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  isInvalid(field: 'email' | 'password'): boolean {
    const ctrl = this.loginForm.controls[field];
    return ctrl.invalid && (ctrl.dirty || ctrl.touched);
  }

  onSubmit(): void {
    if (this.loginForm.invalid || this.loading()) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorBanner.set(null);
    this.isLocked.set(false);

    const { email, password } = this.loginForm.getRawValue();
    this.authService.login({ email: email.trim(), password }).subscribe({
      next: (me) => {
        this.loading.set(false);
        this.notificationService.success(`Welcome back, ${me.user.fullName}`);
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
        this.router.navigateByUrl(returnUrl);
      },
      error: (err) => {
        this.loading.set(false);
        const code = err?.error?.code;
        this.isLocked.set(code === 'ACCOUNT_LOCKED');
        this.errorBanner.set(
          err?.error?.message ||
          (err?.status === 0
            ? 'Unable to connect to the FinLedger server.'
            : 'Invalid email or password.')
        );
      }
    });
  }
}
