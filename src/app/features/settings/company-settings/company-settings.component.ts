import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { NotificationService } from '../../../core/services/notification.service';
import { SettingsService } from '../services/settings.service';

@Component({
  selector: 'app-company-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HasPermissionDirective],
  template: `
    <div class="settings-page">
      <div class="page-header">
        <div>
          <h2>Company Profile & Tax Settings</h2>
          <p class="subtitle">Configure tenant legal entity identity, TRN, base currency, and fiscal calendar</p>
        </div>
      </div>

      <div class="card">
        <form [formGroup]="form" (ngSubmit)="save()" class="form-grid">
          <div class="form-group">
            <label>Legal Entity Name *</label>
            <input type="text" formControlName="legalName" />
          </div>

          <div class="form-group">
            <label>TRN / VAT Registration No.</label>
            <input type="text" formControlName="trn" placeholder="100xxxxxxxxxxxx" />
          </div>

          <div class="form-group">
            <label>Country Code *</label>
            <select formControlName="countryCode">
              <option value="AE">United Arab Emirates (AE)</option>
              <option value="SA">Saudi Arabia (SA)</option>
              <option value="US">United States (US)</option>
              <option value="GB">United Kingdom (GB)</option>
            </select>
          </div>

          <div class="form-group">
            <label>Base Currency *</label>
            <select formControlName="baseCurrency">
              <option value="AED">AED - UAE Dirham</option>
              <option value="SAR">SAR - Saudi Riyal</option>
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
            </select>
          </div>

          <div class="form-group">
            <label>Fiscal Year Start Month *</label>
            <select formControlName="fiscalYearStartMonth">
              <option *ngFor="let m of months" [value]="m.val">{{ m.label }}</option>
            </select>
          </div>

          <div class="form-group">
            <label>Corporate Email</label>
            <input type="email" formControlName="email" />
          </div>

          <div class="form-group">
            <label>Phone Number</label>
            <input type="text" formControlName="phone" />
          </div>

          <div class="form-group full-width">
            <label>Registered Office Address</label>
            <textarea rows="2" formControlName="address"></textarea>
          </div>

          <div class="form-group full-width">
            <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;font-weight:500;">
              <input type="checkbox" formControlName="allowNegativeStock" style="width:auto;" />
              <span>Allow negative stock balances on outbound movements &amp; invoices</span>
            </label>
          </div>

          <div class="form-actions full-width" *appHasPermission="['COMPANY_EDIT', 'SETTINGS_EDIT']">
            <button type="submit" class="btn-primary" [disabled]="saving() || form.invalid">
              {{ saving() ? 'Saving...' : 'Save Company Profile' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .settings-page { max-width: 900px; }
    .page-header { margin-bottom: 1.5rem; }
    .page-header h2 { margin: 0; font-size: 1.45rem; color: #0f172a; }
    .subtitle { margin: 0.25rem 0 0; color: #64748b; font-size: 0.875rem; }
    .card {
      background: #ffffff;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      padding: 1.75rem;
    }
    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1.25rem;
    }
    .full-width { grid-column: 1 / -1; }
    .form-group { display: flex; flex-direction: column; gap: 0.35rem; }
    .form-group label { font-size: 0.82rem; font-weight: 600; color: #334155; }
    .form-group input, .form-group select, .form-group textarea {
      padding: 0.6rem 0.85rem;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 0.9rem;
    }
    .form-actions { display: flex; justify-content: flex-end; margin-top: 0.5rem; }
    .btn-primary {
      background: #2563eb;
      color: #fff;
      border: none;
      padding: 0.65rem 1.35rem;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
  `]
})
export class CompanySettingsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private settingsService = inject(SettingsService);
  private authService = inject(AuthService);
  private notification = inject(NotificationService);

  saving = signal<boolean>(false);
  months = [
    { val: 1, label: 'January' }, { val: 2, label: 'February' }, { val: 3, label: 'March' },
    { val: 4, label: 'April' }, { val: 5, label: 'May' }, { val: 6, label: 'June' },
    { val: 7, label: 'July' }, { val: 8, label: 'August' }, { val: 9, label: 'September' },
    { val: 10, label: 'October' }, { val: 11, label: 'November' }, { val: 12, label: 'December' }
  ];

  form = this.fb.nonNullable.group({
    legalName: ['', Validators.required],
    trn: [''],
    countryCode: ['AE', Validators.required],
    baseCurrency: ['AED', Validators.required],
    fiscalYearStartMonth: [1, Validators.required],
    email: [''],
    phone: [''],
    address: [''],
    allowNegativeStock: [false]
  });

  ngOnInit(): void {
    this.settingsService.getCurrentCompany().subscribe({
      next: (company) => {
        this.form.patchValue({
          legalName: company.legalName,
          trn: company.trn || '',
          countryCode: company.countryCode,
          baseCurrency: company.baseCurrency,
          fiscalYearStartMonth: company.fiscalYearStartMonth,
          email: company.email || '',
          phone: company.phone || '',
          address: company.address || '',
          allowNegativeStock: Boolean(company.allowNegativeStock)
        });
      }
    });
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const val = this.form.getRawValue();
    this.settingsService.updateCurrentCompany({
      ...val,
      fiscalYearStartMonth: Number(val.fiscalYearStartMonth),
      isActive: true
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.notification.success('Company settings saved');
        this.authService.reloadProfile().subscribe();
      },
      error: () => {
        this.saving.set(false);
      }
    });
  }
}

