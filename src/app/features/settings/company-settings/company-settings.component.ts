import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';
import { NotificationService } from '../../../core/services/notification.service';
import { CompanyUpdateRequest } from '../models/settings.model';
import { SettingsService } from '../services/settings.service';

@Component({
  selector: 'app-company-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HasPermissionDirective, TranslatePipe],
  template: `
    <div class="settings-page">
      <div class="page-header">
        <div>
          <h2>{{ 'settings.companyTitle' | translate }}</h2>
          <p class="subtitle">{{ 'settings.companySubtitle' | translate }}</p>
        </div>
      </div>

      <div class="card">
        <form [formGroup]="form" (ngSubmit)="save()" class="form-grid">

          <!-- Company Logo Upload -->
          <div class="logo-section full-width">
            <div class="logo-preview">
              <img *ngIf="logoPreviewUrl()" [src]="logoPreviewUrl()" alt="Company Logo" class="logo-img" />
              <div *ngIf="!logoPreviewUrl()" class="logo-placeholder">{{ 'settings.noLogo' | translate }}</div>
            </div>

            <div class="logo-details">
              <label class="logo-title">{{ 'settings.companyLogo' | translate }}</label>
              <p class="logo-hint">{{ 'settings.logoHint' | translate }}</p>

              <div class="logo-buttons">
                <input #fileInput
                       type="file"
                       (change)="onFileSelected($event)"
                       accept="image/png,image/jpeg"
                       style="display: none;" />

                <button type="button" class="btn-secondary" (click)="fileInput.click()">
                  {{ logoPreviewUrl() ? ('settings.changeLogo' | translate) : ('settings.uploadLogo' | translate) }}
                </button>

                <button type="button"
                        class="btn-danger"
                        *ngIf="logoPreviewUrl()"
                        (click)="onRemoveLogo(fileInput)">
                  {{ 'settings.removeLogo' | translate }}
                </button>
              </div>
            </div>
          </div>

          <!-- Existing Form Fields -->
          <div class="form-group">
            <label>{{ 'settings.legalName' | translate }} *</label>
            <input type="text" formControlName="legalName" />
          </div>

          <div class="form-group">
            <label>{{ 'settings.trnVat' | translate }}</label>
            <input type="text" formControlName="trn" placeholder="100xxxxxxxxxxxx" />
          </div>

          <div class="form-group">
            <label>{{ 'settings.countryCode' | translate }} *</label>
            <select formControlName="countryCode">
              <option value="AE">{{ 'settings.countries.AE' | translate }}</option>
              <option value="SA">{{ 'settings.countries.SA' | translate }}</option>
              <option value="US">{{ 'settings.countries.US' | translate }}</option>
              <option value="GB">{{ 'settings.countries.GB' | translate }}</option>
            </select>
          </div>

          <div class="form-group">
            <label>{{ 'settings.baseCurrency' | translate }} *</label>
            <select formControlName="baseCurrency">
              <option value="AED">{{ 'settings.currencies.AED' | translate }}</option>
              <option value="SAR">{{ 'settings.currencies.SAR' | translate }}</option>
              <option value="USD">{{ 'settings.currencies.USD' | translate }}</option>
              <option value="EUR">{{ 'settings.currencies.EUR' | translate }}</option>
              <option value="GBP">{{ 'settings.currencies.GBP' | translate }}</option>
            </select>
          </div>

          <div class="form-group">
            <label>{{ 'settings.fiscalYearStartMonth' | translate }} *</label>
            <select formControlName="fiscalYearStartMonth">
              <option *ngFor="let m of months" [value]="m.val">{{ 'settings.months.' + m.val | translate }}</option>
            </select>
          </div>

          <div class="form-group">
            <label>{{ 'settings.corporateEmail' | translate }}</label>
            <input type="email" formControlName="email" />
          </div>

          <div class="form-group">
            <label>{{ 'settings.phoneNumber' | translate }}</label>
            <input type="text" formControlName="phone" />
          </div>

          <div class="form-group full-width">
            <label>{{ 'settings.registeredAddress' | translate }}</label>
            <textarea rows="2" formControlName="address"></textarea>
          </div>

          <div class="form-group full-width">
            <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;font-weight:500;">
              <input type="checkbox" formControlName="allowNegativeStock" style="width:auto;" />
              <span>{{ 'settings.allowNegativeStock' | translate }}</span>
            </label>
          </div>

          <div class="form-actions full-width" *appHasPermission="['COMPANY_EDIT', 'SETTINGS_EDIT']">
            <button type="submit" class="btn-primary" [disabled]="saving() || form.invalid">
              {{ saving() ? ('settings.savingCompanyProfile' | translate) : ('settings.saveCompanyProfile' | translate) }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .settings-page { padding: 1.5rem; max-width: 940px; }
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
