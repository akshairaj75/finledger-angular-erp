import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { NotificationService } from '../../../core/services/notification.service';
import { FiscalYear } from '../models/settings.model';
import { SettingsService } from '../services/settings.service';

@Component({
  selector: 'app-fiscal-years',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HasPermissionDirective],
  template: `
    <div class="fy-page">
      <div class="page-header">
        <div>
          <h2>Fiscal Years & Accounting Periods</h2>
          <p class="subtitle">Manage open/closed posting windows to protect historical accounting ledgers</p>
        </div>
        <button *appHasPermission="'SETTINGS_EDIT'" class="btn-primary" (click)="showModal = true">
          + New Fiscal Year
        </button>
      </div>

      <div *ngFor="let fy of fiscalYears" class="fy-card">
        <div class="fy-header">
          <div>
            <h3>{{ fy.name }}</h3>
            <span class="dates">{{ fy.startDate }} to {{ fy.endDate }}</span>
          </div>
          <span class="status-badge" [class.open]="fy.status === 'OPEN'">{{ fy.status }}</span>
        </div>

        <table class="periods-table">
          <thead>
            <tr>
              <th>Period #</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Status</th>
              <th class="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let p of fy.periods">
              <td>Period {{ p.periodNo }}</td>
              <td>{{ p.startDate }}</td>
              <td>{{ p.endDate }}</td>
              <td>
                <span
                  class="status-pill"
                  [class.open]="p.status === 'OPEN'"
                  [class.closed]="p.status === 'CLOSED'"
                  [class.locked]="p.status === 'LOCKED'"
                >
                  {{ p.status }}
                </span>
              </td>
              <td class="text-right">
                <button
                  *ngIf="p.status === 'OPEN'"
                  class="btn-sm btn-warn"
                  (click)="closePeriod(p.id)"
                  [disabled]="!canEdit"
                >
                  Close Period
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="modal-backdrop" *ngIf="showModal">
        <div class="modal-card">
          <div class="modal-header">
            <h3>Create Fiscal Year</h3>
            <button class="close-btn" (click)="showModal = false">&times;</button>
          </div>
          <form [formGroup]="form" (ngSubmit)="createFy()" class="modal-body">
            <div class="form-group">
              <label>Year Code *</label>
              <input type="text" formControlName="name" placeholder="FY2027" />
            </div>
            <div class="form-group">
              <label>Start Date *</label>
              <input type="date" formControlName="startDate" />
            </div>
            <div class="form-group">
              <label>End Date *</label>
              <input type="date" formControlName="endDate" />
            </div>
            <label class="check-row">
              <input type="checkbox" formControlName="autoGeneratePeriods" />
              <span>Auto-generate 12 monthly OPEN periods</span>
            </label>
            <div class="modal-footer">
              <button type="button" class="btn-outline" (click)="showModal = false">Cancel</button>
              <button type="submit" class="btn-primary" [disabled]="form.invalid || saving">
                {{ saving ? 'Creating...' : 'Create Fiscal Year' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .page-header h2 { margin: 0; font-size: 1.45rem; color: #0f172a; }
    .subtitle { margin: 0.25rem 0 0; color: #64748b; font-size: 0.875rem; }
    .fy-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 1.5rem; overflow: hidden; }
    .fy-header {
      padding: 1rem 1.25rem;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .fy-header h3 { margin: 0; font-size: 1.1rem; }
    .dates { font-size: 0.82rem; color: #64748b; }
    .periods-table { width: 100%; border-collapse: collapse; }
    .periods-table th { padding: 0.65rem 1.25rem; text-align: left; font-size: 0.75rem; color: #64748b; border-bottom: 1px solid #e2e8f0; }
    .periods-table td { padding: 0.65rem 1.25rem; border-bottom: 1px solid #f1f5f9; font-size: 0.88rem; }
    .text-right { text-align: right; }
    .status-badge, .status-pill {
      padding: 0.2rem 0.65rem;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 700;
      background: #e2e8f0;
      color: #475569;
    }
    .open { background: #dcfce7; color: #166534; }
    .closed { background: #fef3c7; color: #92400e; }
    .locked { background: #fee2e2; color: #991b1b; }
    .btn-primary { background: #2563eb; color: #fff; border: none; padding: 0.6rem 1.15rem; border-radius: 8px; font-weight: 600; cursor: pointer; }
    .btn-sm { padding: 0.3rem 0.7rem; font-size: 0.78rem; border-radius: 6px; cursor: pointer; font-weight: 600; }
    .btn-warn { background: #fef3c7; border: 1px solid #f59e0b; color: #92400e; }
    .btn-outline { background: #fff; border: 1px solid #cbd5e1; color: #334155; padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer; }
    .modal-backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.55); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal-card { background: #fff; border-radius: 12px; width: 100%; max-width: 440px; }
    .modal-header { padding: 1rem 1.35rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
    .modal-header h3 { margin: 0; }
    .close-btn { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #64748b; }
    .modal-body { padding: 1.35rem; display: flex; flex-direction: column; gap: 1rem; }
    .form-group { display: flex; flex-direction: column; gap: 0.3rem; }
    .form-group label { font-size: 0.82rem; font-weight: 600; color: #334155; }
    .form-group input { padding: 0.55rem 0.8rem; border: 1px solid #cbd5e1; border-radius: 8px; }
    .check-row { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 0.5rem; }
  `]
})
export class FiscalYearsComponent implements OnInit {
  private settingsService = inject(SettingsService);
  private notification = inject(NotificationService);
  private fb = inject(FormBuilder);

  fiscalYears: FiscalYear[] = [];
  showModal = false;
  saving = false;
  canEdit = true;

  form = this.fb.nonNullable.group({
    name: ['FY' + (new Date().getFullYear() + 1), Validators.required],
    startDate: [`${new Date().getFullYear() + 1}-01-01`, Validators.required],
    endDate: [`${new Date().getFullYear() + 1}-12-31`, Validators.required],
    autoGeneratePeriods: [true]
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.settingsService.getFiscalYears().subscribe(res => (this.fiscalYears = res || []));
  }

  closePeriod(periodId: number): void {
    if (!confirm('Close this fiscal period? No further postings will be permitted in this date range.')) {
      return;
    }
    this.settingsService.closeFiscalPeriod(periodId).subscribe(() => {
      this.notification.success('Fiscal period closed');
      this.load();
    });
  }

  createFy(): void {
    if (this.form.invalid || this.saving) return;
    this.saving = true;
    this.settingsService.createFiscalYear(this.form.getRawValue()).subscribe({
      next: () => {
        this.saving = false;
        this.showModal = false;
        this.notification.success('Fiscal year created with 12 periods');
        this.load();
      },
      error: () => (this.saving = false)
    });
  }
}

