import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="unauth-container">
      <div class="unauth-card">
        <div class="code-badge">403</div>
        <h2>Access Restricted</h2>
        <p>
          Your current user role does not include the required permissions to open this page.
          Please contact your FinLedger Administrator if you need access.
        </p>
        <div class="actions">
          <a routerLink="/dashboard" class="btn-primary">Return to Dashboard</a>
          <button (click)="signOut()" class="btn-secondary">Switch Account</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .unauth-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 65vh;
      padding: 2rem;
    }

    .unauth-card {
      max-width: 460px;
      text-align: center;
      background: #ffffff;
      padding: 2.5rem;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);
    }

    .code-badge {
      display: inline-block;
      background: #fef2f2;
      color: #dc2626;
      font-weight: 800;
      font-size: 1.5rem;
      padding: 0.45rem 1.1rem;
      border-radius: 999px;
      margin-bottom: 1rem;
    }

    h2 {
      margin: 0 0 0.65rem;
      color: #0f172a;
      font-size: 1.4rem;
    }

    p {
      color: #64748b;
      font-size: 0.92rem;
      line-height: 1.55;
      margin-bottom: 1.75rem;
    }

    .actions {
      display: flex;
      gap: 0.75rem;
      justify-content: center;
    }

    .btn-primary {
      background: #2563eb;
      color: #ffffff;
      padding: 0.6rem 1.2rem;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.875rem;
    }

    .btn-secondary {
      background: #f1f5f9;
      color: #334155;
      padding: 0.6rem 1.2rem;
      border-radius: 8px;
      border: 1px solid #cbd5e1;
      font-weight: 600;
      font-size: 0.875rem;
      cursor: pointer;
    }
  `]
})
export class UnauthorizedComponent {
  private authService = inject(AuthService);

  signOut(): void {
    this.authService.logout(true);
  }
}

