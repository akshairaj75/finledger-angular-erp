import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { NotificationService } from '../../../core/services/notification.service';
import { CompanyUpdateRequest } from '../models/settings.model';
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

          <!-- Company Logo Upload -->
          <div class="logo-section full-width">
            <div class="logo-preview">
              <img *ngIf="logoPreviewUrl()" [src]="logoPreviewUrl()" alt="Company Logo" class="logo-img" />
              <div *ngIf="!logoPreviewUrl()" class="logo-placeholder">No Logo</div>
            </div>

            <div class="logo-details">
              <label class="logo-title">Company Logo</label>
              <p class="logo-hint">Upload PNG or JPEG (max 2 MB)</p>

              <div class="logo-buttons">
                <input #fileInput
                       type="file"
                       (change)="onFileSelected($event)"
                       accept="image/png,image/jpeg"
                       style="display: none;" />

                <button type="button" class="btn-secondary" (click)="fileInput.click()">
                  {{ logoPreviewUrl() ? 'Change Logo' : 'Upload Logo' }}
                </button>

                <button type="button"
                        class="btn-danger"
                        *ngIf="logoPreviewUrl()"
                        (click)="onRemoveLogo(fileInput)">
                  Remove Logo
                </button>
              </div>
            </div>
          </div>

          <!-- Existing Form Fields -->
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

    /* Logo section */
    .logo-section {
      display: flex;
      gap: 1.25rem;
      align-items: center;
      padding: 1rem;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
    }
    .logo-preview {
      width: 100px;
      height: 100px;
      min-width: 100px;
      border-radius: 6px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .logo-img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    .logo-placeholder {
      font-size: 0.75rem;
      color: #94a3b8;
      font-weight: 500;
    }
    .logo-details {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .logo-title {
      font-size: 0.9rem;
      font-weight: 600;
      color: #1e293b;
    }
    .logo-hint {
      margin: 0;
      font-size: 0.8rem;
      color: #64748b;
    }
    .logo-buttons {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.25rem;
    }
    .btn-secondary {
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #cbd5e1;
      padding: 0.4rem 0.85rem;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-secondary:hover { background: #e2e8f0; }
    .btn-danger {
      background: #fff;
      color: #dc2626;
      border: 1px solid #fca5a5;
      padding: 0.4rem 0.85rem;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-danger:hover { background: #fee2e2; }
  `]
})
export class CompanySettingsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private settingsService = inject(SettingsService);
  private authService = inject(AuthService);
  private notification = inject(NotificationService);

  saving = signal<boolean>(false);
  hasExistingLogo = signal<boolean>(false);
  removeLogo = signal<boolean>(false);
  logoPreviewUrl = signal<string | null>(null);

  selectedLogoFile: File | null = null;

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

        if (company.logoPath) {
          this.hasExistingLogo.set(true);
          this.settingsService.getCompanyLogo().subscribe({
            next: (blob) => {
              this.logoPreviewUrl.set(URL.createObjectURL(blob));
            },
            error: () => {
              this.hasExistingLogo.set(false);
            }
          });
        }
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      this.notification.error('Only PNG and JPEG images are allowed.');
      input.value = '';
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      this.notification.error('Logo file size must not exceed 2 MB.');
      input.value = '';
      return;
    }

    this.selectedLogoFile = file;
    this.removeLogo.set(false);
    this.logoPreviewUrl.set(URL.createObjectURL(file));
    input.value = '';
  }

  onRemoveLogo(input?: HTMLInputElement): void {
    this.selectedLogoFile = null;
    this.removeLogo.set(true);
    this.logoPreviewUrl.set(null);
    if (input) input.value = '';
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const val = this.form.getRawValue();

    const companyData: CompanyUpdateRequest = {
      legalName: val.legalName,
      trn: val.trn || undefined,
      countryCode: val.countryCode,
      baseCurrency: val.baseCurrency,
      fiscalYearStartMonth: Number(val.fiscalYearStartMonth),
      email: val.email || undefined,
      phone: val.phone || undefined,
      address: val.address || undefined,
      allowNegativeStock: Boolean(val.allowNegativeStock),
      isActive: true,
      removeLogo: this.removeLogo()
    };

    const formData = new FormData();
    formData.append(
      'data',
      new Blob([JSON.stringify(companyData)], { type: 'application/json' })
    );

    if (this.selectedLogoFile) {
      formData.append('logoFile', this.selectedLogoFile);
    }

    this.settingsService.updateCurrentCompany(formData).subscribe({
      next: () => {
        this.saving.set(false);
        this.notification.success('Company profile and logo saved successfully');

        if (this.removeLogo()) {
          this.hasExistingLogo.set(false);
          this.removeLogo.set(false);
        } else if (this.selectedLogoFile) {
          this.hasExistingLogo.set(true);
          this.selectedLogoFile = null;
        }

        this.authService.reloadProfile().subscribe();
      },
      error: () => {
        this.saving.set(false);
      }
    });
  }
}
