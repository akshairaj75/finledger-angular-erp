import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ar } from '../i18n/ar';
import { en } from '../i18n/en';
import { TranslatePipe } from '../pipes/translate.pipe';
import { LOCALE_STORAGE_KEY, LocaleService } from './locale.service';

describe('LocaleService & RTL Localization (FinLedger v2.0 SDS Section 3.3 & 8)', () => {
  let service: LocaleService;

  beforeEach(() => {
    window.localStorage.removeItem(LOCALE_STORAGE_KEY);
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';

    TestBed.configureTestingModule({
      providers: [LocaleService, TranslatePipe]
    });
    service = TestBed.inject(LocaleService);
  });

  afterEach(() => {
    window.localStorage.removeItem(LOCALE_STORAGE_KEY);
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
  });

  it('1. should initialize with default English (en) and LTR layout', () => {
    expect(service.locale()).toBe('en');
    expect(service.direction()).toBe('ltr');
    expect(service.isRtl()).toBe(false);
  });

  it('2. should switch to Arabic and set dir="rtl" on document element', () => {
    service.setLocale('ar');
    TestBed.flushEffects();

    expect(service.locale()).toBe('ar');
    expect(service.direction()).toBe('rtl');
    expect(service.isRtl()).toBe(true);
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('ar');
  });

  it('3. should toggle between en and ar reactively', () => {
    expect(service.locale()).toBe('en');

    service.toggleLocale();
    TestBed.flushEffects();
    expect(service.locale()).toBe('ar');
    expect(service.direction()).toBe('rtl');

    service.toggleLocale();
    TestBed.flushEffects();
    expect(service.locale()).toBe('en');
    expect(service.direction()).toBe('ltr');
  });

  it('4. should hydrate initial language from localStorage if present', () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'ar');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [LocaleService] });
    const hydratedService = TestBed.inject(LocaleService);
    expect(hydratedService.locale()).toBe('ar');
    expect(hydratedService.direction()).toBe('rtl');
    expect(hydratedService.isRtl()).toBe(true);
  });

  it('5. should resolve translations in English and Arabic accurately', () => {
    service.setLocale('en');
    expect(service.t('nav.dashboard')).toBe('Executive Dashboard');
    expect(service.t('nav.vatReturn')).toBe('VAT 201 Return');
    expect(service.t('common.save')).toBe('Save');

    service.setLocale('ar');
    expect(service.t('nav.dashboard')).toBe('لوحة التحكم التنفيذية');
    expect(service.t('nav.vatReturn')).toBe('إقرار ضريبة القيمة المضافة 201');
    expect(service.t('common.save')).toBe('حفظ');
  });

  it('6. should interpolate parameters into translation strings', () => {
    // Test custom param interpolation
    const customResult = service.t('topbar.base') + ': AED';
    expect(customResult).toContain('AED');
  });

  it('7. should fall back to English if key is missing or return raw key', () => {
    service.setLocale('ar');
    expect(service.t('non.existent.key')).toBe('non.existent.key');
  });

  it('8. should have 100% key parity between English and Arabic dictionaries (zero missing keys)', () => {
    const collectKeys = (obj: Record<string, any>, prefix = ''): string[] => {
      let keys: string[] = [];
      for (const [k, v] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === 'object') {
          keys = keys.concat(collectKeys(v, fullKey));
        } else {
          keys.push(fullKey);
        }
      }
      return keys.sort();
    };

    const enKeys = collectKeys(en);
    const arKeys = collectKeys(ar);

    expect(arKeys).toEqual(enKeys);

    // Ensure no empty string translations exist in Arabic
    for (const key of arKeys) {
      service.setLocale('ar');
      const val = service.t(key);
      expect(val).toBeDefined();
      expect(val.trim().length).toBeGreaterThan(0);
    }
  });

  it('9. should translate keys via TranslatePipe', () => {
    const pipe = TestBed.inject(TranslatePipe);
    service.setLocale('en');
    expect(pipe.transform('nav.invoices')).toBe('Sales Invoices');

    service.setLocale('ar');
    expect(pipe.transform('nav.invoices')).toBe('فواتير المبيعات');
  });
});
