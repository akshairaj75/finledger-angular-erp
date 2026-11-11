import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-change-password-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="modal-backdrop">
      <div class="modal-card">
        <div class="modal-header">
          <h3>Change Password</h3>
          <button class="close-btn" (click)="closed.emit()">&times;</button>
        </div>
        <form [formGroup]="form" (ngSubmit)="submit()" class="modal-body">
          <div class="form-group">
            <label>Current Password *</label>
            <input type="password" formControlName="currentPassword" />
          </div>
          <div class="form-group">
            <label>New Password * (min 8 characters)</label>
            <input type="password" formControlName="newPassword" />
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-outline" (click)="closed.emit()">Cancel</button>
            <button type="submit" class="btn-primary" [disabled]="form.invalid || saving()">
              {{ saving() ? 'Updating...' : 'Update Password' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.55); display: flex; align-items: center; justify-content: center; z-index: 1200; }
    .modal-card { background: #fff; border-radius: 12px; width: 100%; max-width: 400px; box-shadow: 0 20px 30px rgba(0, 0, 0, 0.25); }
    .modal-header { padding: 1rem 1.35rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
    .modal-header h3 { margin: 0; font-size: 1.05rem; }
    .close-btn { background: none; border: none; font-size: 1.4rem; cursor: pointer; color: #64748b; }
    .modal-body { padding: 1.35rem; display: flex; flex-direction: column; gap: 1rem; }
    .form-group { display: flex; flex-direction: column; gap: 0.35rem; }
    .form-group label { font-size: 0.82rem; font-weight: 600; color: #334155; }
    .form-group input { padding: 0.55rem 0.8rem; border: 1px solid #cbd5e1; border-radius: 8px; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 0.5rem; }
    .btn-primary { background: #2563eb; color: #fff; border: none; padding: 0.55rem 1.1rem; border-radius: 8px; font-weight: 600; cursor: pointer; }
    .btn-outline { background: #fff; border: 1px solid #cbd5e1; color: #334155; padding: 0.55rem 1rem; border-radius: 8px; cursor: pointer; }
  `]
})
export class ChangePasswordModalComponent {
  @Output() closed = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private notification = inject(NotificationService);

  saving = signal(false);
  form = this.fb.nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(8)]]
  });

  submit(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.authService.changePassword(this.form.getRawValue()).subscribe({
      next: () => {
        this.saving.set(false);
        this.notification.success('Password updated successfully');
        this.closed.emit();
      },
      error: () => this.saving.set(false)
    });
  }
}

