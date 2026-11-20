import '@angular/compiler';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../core/auth/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SettingsService } from '../services/settings.service';
import { CompanySettingsComponent } from './company-settings.component';
import { CompanyProfile } from '../../../core/models/auth.model';

describe('CompanySettingsComponent - Logo & Profile Management', () => {
  let component: CompanySettingsComponent;
  let settingsService: SettingsService;
  let notificationService: NotificationService;

  const mockCompanyWithLogo: CompanyProfile = {
    id: 1,
    code: 'BSB',
    legalName: 'BSB Trading LLC',
    trn: '100234567800003',
    countryCode: 'AE',
    baseCurrency: 'AED',
    fiscalYearStartMonth: 1,
    email: 'info@bsb.com',
    phone: '+97140000000',
    address: 'Business Bay, Dubai',
    logoPath: '/api/v1/companies/current/logo',
    isActive: true,
    allowNegativeStock: false
  };

  const mockCompanyWithoutLogo: CompanyProfile = {
    ...mockCompanyWithLogo,
    logoPath: undefined
  };

  beforeEach(() => {
    // Stub URL.createObjectURL and URL.revokeObjectURL for jsdom environment
    if (!window.URL.createObjectURL) {
      window.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/test-blob-url');
    } else {
      vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:http://localhost/test-blob-url');
    }
    if (!window.URL.revokeObjectURL) {
      window.URL.revokeObjectURL = vi.fn();
    } else {
      vi.spyOn(window.URL, 'revokeObjectURL');
    }

    TestBed.configureTestingModule({
      imports: [CompanySettingsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            reloadProfile: () => of(null)
          }
        },
        {
          provide: NotificationService,
          useValue: {
            success: vi.fn(),
            error: vi.fn(),
            info: vi.fn()
          }
        }
      ]
    });

    const fixture = TestBed.createComponent(CompanySettingsComponent);
    component = fixture.componentInstance;
    settingsService = TestBed.inject(SettingsService);
    notificationService = TestBed.inject(NotificationService);
  });

  it('1. should display existing logo on load when company has logoPath', () => {
    const logoBlob = new Blob(['fake-image-bytes'], { type: 'image/png' });
    vi.spyOn(settingsService, 'getCurrentCompany').mockReturnValue(of(mockCompanyWithLogo));
    vi.spyOn(settingsService, 'getCompanyLogo').mockReturnValue(of(logoBlob));

    component.ngOnInit();

    expect(component.form.get('legalName')?.value).toBe('BSB Trading LLC');
    expect(component.hasExistingLogo()).toBe(true);
    expect(component.logoPreviewUrl()).toBe('blob:http://localhost/test-blob-url');
  });

  it('2. should preview selected logo when user chooses a valid PNG file', () => {
    vi.spyOn(settingsService, 'getCurrentCompany').mockReturnValue(of(mockCompanyWithoutLogo));
    component.ngOnInit();

    const file = new File(['png-data'], 'logo.png', { type: 'image/png' });
    const event = { target: { files: [file], value: '' } } as unknown as Event;

    component.onFileSelected(event);

    expect(component.selectedLogoFile).toBe(file);
    expect(component.removeLogo()).toBe(false);
    expect(component.logoPreviewUrl()).toBe('blob:http://localhost/test-blob-url');
  });

  it('3. should submit company details and logo together in one FormData request', async () => {
    vi.spyOn(settingsService, 'getCurrentCompany').mockReturnValue(of(mockCompanyWithoutLogo));
    let capturedFormData: FormData | null = null;
    vi.spyOn(settingsService, 'updateCurrentCompany').mockImplementation((data) => {
      capturedFormData = data as FormData;
      return of(mockCompanyWithLogo);
    });

    component.ngOnInit();

    const file = new File(['png-data'], 'logo.png', { type: 'image/png' });
    component.selectedLogoFile = file;
    component.form.patchValue({ legalName: 'Updated Company LLC' });

    component.save();

    expect(capturedFormData).not.toBeNull();
    const dataPart = capturedFormData!.get('data') as Blob;
    expect(dataPart).toBeTruthy();

    const text = await dataPart.text();
    const parsed = JSON.parse(text);
    expect(parsed.legalName).toBe('Updated Company LLC');
    expect(parsed.removeLogo).toBe(false);

    const filePart = capturedFormData!.get('logoFile') as File;
    expect(filePart).toBeTruthy();
    expect(filePart.name).toBe('logo.png');
    expect(notificationService.success).toHaveBeenCalledWith('Company profile and logo saved successfully');
  });

  it('4. should submit without selecting a logo (keeping logo untouched)', async () => {
    vi.spyOn(settingsService, 'getCurrentCompany').mockReturnValue(of(mockCompanyWithLogo));
    vi.spyOn(settingsService, 'getCompanyLogo').mockReturnValue(of(new Blob([])));
    let capturedFormData: FormData | null = null;
    vi.spyOn(settingsService, 'updateCurrentCompany').mockImplementation((data) => {
      capturedFormData = data as FormData;
      return of(mockCompanyWithLogo);
    });

    component.ngOnInit();
    component.save();

    expect(capturedFormData).not.toBeNull();
    const dataPart = capturedFormData!.get('data') as Blob;
    const text = await dataPart.text();
    const parsed = JSON.parse(text);
    expect(parsed.removeLogo).toBe(false);
    expect(capturedFormData!.get('logoFile')).toBeNull();
  });

  it('5. should remove an existing logo when user clicks remove and submit removeLogo=true', async () => {
    vi.spyOn(settingsService, 'getCurrentCompany').mockReturnValue(of(mockCompanyWithLogo));
    vi.spyOn(settingsService, 'getCompanyLogo').mockReturnValue(of(new Blob([])));
    let capturedFormData: FormData | null = null;
    vi.spyOn(settingsService, 'updateCurrentCompany').mockImplementation((data) => {
      capturedFormData = data as FormData;
      return of(mockCompanyWithoutLogo);
    });

    component.ngOnInit();
    component.onRemoveLogo();

    expect(component.removeLogo()).toBe(true);
    expect(component.logoPreviewUrl()).toBeNull();
    expect(component.selectedLogoFile).toBeNull();

    component.save();

    expect(capturedFormData).not.toBeNull();
    const text = await (capturedFormData!.get('data') as Blob).text();
    const parsed = JSON.parse(text);
    expect(parsed.removeLogo).toBe(true);
    expect(capturedFormData!.get('logoFile')).toBeNull();
  });

  it('6. should reject invalid image file types and files exceeding 2 MB', () => {
    vi.spyOn(settingsService, 'getCurrentCompany').mockReturnValue(of(mockCompanyWithoutLogo));
    component.ngOnInit();

    // Invalid MIME type
    const txtFile = new File(['text-content'], 'test.txt', { type: 'text/plain' });
    component.onFileSelected({ target: { files: [txtFile], value: '' } } as unknown as Event);
    expect(notificationService.error).toHaveBeenCalledWith('Only PNG and JPEG images are allowed.');
    expect(component.selectedLogoFile).toBeNull();

    // Oversized file > 2MB
    const largeBytes = new Uint8Array(2 * 1024 * 1024 + 1);
    const largeFile = new File([largeBytes], 'large.png', { type: 'image/png' });
    component.onFileSelected({ target: { files: [largeFile], value: '' } } as unknown as Event);
    expect(notificationService.error).toHaveBeenCalledWith('Logo file size must not exceed 2 MB.');
    expect(component.selectedLogoFile).toBeNull();
  });

  it('7. should handle API failure gracefully without losing current state', () => {
    vi.spyOn(settingsService, 'getCurrentCompany').mockReturnValue(of(mockCompanyWithLogo));
    vi.spyOn(settingsService, 'getCompanyLogo').mockReturnValue(of(new Blob([])));
    vi.spyOn(settingsService, 'updateCurrentCompany').mockReturnValue(throwError(() => new Error('Server Error')));

    component.ngOnInit();

    const file = new File(['png-data'], 'new-logo.png', { type: 'image/png' });
    component.selectedLogoFile = file;

    component.save();

    expect(component.saving()).toBe(false);
    expect(component.selectedLogoFile).toBe(file); // File is retained so user can retry
  });
});
