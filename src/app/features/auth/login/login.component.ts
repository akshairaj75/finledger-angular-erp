import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="login-split-page">
      <!-- Left Product Showcase Panel (FinLedger v2.0 Section 4.1) -->
      <section class="brand-panel">
        <div class="brand-content">
          <div class="logo-row">
            <div class="brand-badge">FL</div>
            <div>
              <span class="brand-title">FinLedger</span>
              <span class="brand-version">ERP v2.0</span>
            </div>
          </div>

          <h1>Double-Entry Accounting &amp; Operations in One Platform</h1>
          <p class="lead-copy">
            End-to-end lead-to-cash, procure-to-pay, inventory costing, and automated financial
            reporting designed for UAE &amp; KSA enterprises.
          </p>

          <ul class="feature-list">
            <li>
              <span class="feat-icon">📒</span>
              <div>
                <strong>Immutable General Ledger</strong>
                <span>Strict debit/credit validation, fiscal period locking &amp; reversal audit trails.</span>
              </div>
            </li>
            <li>
              <span class="feat-icon">📦</span>
              <div>
                <strong>Multi-Warehouse Weighted-Average Costing</strong>
                <span>Concurrent row locking prevents overselling and keeps valuation accurate.</span>
              </div>
            </li>
            <li>
              <span class="feat-icon">📑</span>
              <div>
                <strong>UAE 5% &amp; KSA 15% VAT Ready</strong>
                <span>Tax invoices, input/output VAT recovery, and FTA 201 return summaries.</span>
              </div>
            </li>
            <li>
              <span class="feat-icon">🏦</span>
              <div>
                <strong>CRM Pipeline &amp; Auto Bank Reconciliation</strong>
                <span>Quote-to-invoice conversion and zero-difference bank statement matching.</span>
              </div>
            </li>
          </ul>
        </div>
      </section>

      <!-- Right Sign-In Panel -->
      <section class="form-panel">
        <div class="login-card">
          <div class="form-header">
            <h2>Sign in to FinLedger</h2>
            <p>Enter your company email and password to continue</p>
          </div>

          <div *ngIf="errorBanner()" class="error-alert" [class.locked-alert]="isLocked()">
            <span class="alert-icon">{{ isLocked() ? '🔒' : '⚠️' }}</span>
            <div class="alert-body">
              <strong>{{ isLocked() ? 'Account Locked (5 Failed Attempts)' : 'Authentication Failed' }}</strong>
              <p>{{ errorBanner() }}</p>
            </div>
          </div>

          <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="login-form">
            <div class="form-group">
              <label for="email">Work Email</label>
              <input
                id="email"
                type="email"
                formControlName="email"
                placeholder="name@company.com"
                autocomplete="email"
                [class.invalid]="isInvalid('email')"
              />
              <span class="field-error" *ngIf="isInvalid('email')">
                Please enter a valid corporate email address.
              </span>
            </div>

            <div class="form-group">
              <label for="password">Password</label>
              <div class="password-wrapper">
                <input
                  id="password"
                  [type]="showPassword() ? 'text' : 'password'"
                  formControlName="password"
                  placeholder="Enter your password"
                  autocomplete="current-password"
                  [class.invalid]="isInvalid('password')"
                />
                <button
                  type="button"
                  class="toggle-pw"
                  (click)="showPassword.set(!showPassword())"
                  tabindex="-1"
                  [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
                >
                  {{ showPassword() ? 'Hide' : 'Show' }}
                </button>
              </div>
              <span class="field-error" *ngIf="isInvalid('password')">
                Password is required.
              </span>
            </div>

            <button type="submit" class="btn-submit" [disabled]="loading() || loginForm.invalid">
              <span *ngIf="loading()" class="spinner-sm"></span>
              {{ loading() ? 'Authenticating...' : 'Sign In' }}
            </button>
          </form>

          <div *ngIf="!isProduction" class="dev-hint">
            <span>Seeded Admin:</span>
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
      padding: 3.5rem 4rem;
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
      margin-bottom: 2.25rem;
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
      font-weight: 700;
    }

    .brand-version {
      font-size: 0.72rem;
      color: #94a3b8;
      letter-spacing: 0.05em;
    }

    .brand-content h1 {
      font-size: 2rem;
      line-height: 1.25;
      margin: 0 0 1rem;
      font-weight: 700;
    }

    .lead-copy {
      color: #cbd5e1;
      font-size: 0.98rem;
      line-height: 1.6;
      margin-bottom: 2.25rem;
    }

    .feature-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 1.2rem;
    }

    .feature-list li {
      display: flex;
      align-items: flex-start;
      gap: 0.9rem;
    }

    .feat-icon {
      font-size: 1.35rem;
      line-height: 1;
      margin-top: 0.1rem;
    }

    .feature-list strong {
      display: block;
      font-size: 0.92rem;
      color: #f8fafc;
      margin-bottom: 0.15rem;
    }

    .feature-list span {
      font-size: 0.82rem;
      color: #94a3b8;
      line-height: 1.4;
    }

    .form-panel {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }

    .login-card {
      width: 100%;
      max-width: 410px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 2.25rem;
      box-shadow: 0 12px 30px -10px rgba(15, 23, 42, 0.12);
    }

    .form-header {
      margin-bottom: 1.75rem;
    }

    .form-header h2 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: #0f172a;
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
      padding: 0.85rem 1rem;
      border-radius: 10px;
      margin-bottom: 1.25rem;
      font-size: 0.85rem;
    }

    .error-alert.locked-alert {
      background: #fffbeb;
      border-color: #fde68a;
      color: #92400e;
    }

    .alert-body strong {
      display: block;
      margin-bottom: 0.15rem;
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
    }

    .form-group label {
      font-size: 0.825rem;
      font-weight: 600;
      color: #334155;
    }

    .form-group input {
      width: 100%;
      box-sizing: border-box;
      padding: 0.7rem 0.9rem;
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
      padding-right: 3.75rem;
    }

    .toggle-pw {
      position: absolute;
      right: 0.65rem;
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
      margin-top: 0.5rem;
      padding: 0.8rem 1rem;
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
      margin-top: 1.5rem;
      padding-top: 1rem;
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

  public readonly isProduction = environment.production;
  public loading = signal(false);
  public showPassword = signal(false);
  public errorBanner = signal<string | null>(null);
  public isLocked = signal(false);

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
