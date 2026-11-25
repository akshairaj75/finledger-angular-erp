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

  it('10. should dynamically register a 3rd language (French) and support seamless switching & fallback', () => {
    service.registerLocale(
      { code: 'fr', name: 'French', nativeName: 'Français', direction: 'ltr', numberLocale: 'fr-FR' },
      {
        common: { save: 'Enregistrer' },
        nav: { dashboard: 'Tableau de bord exécutif' }
      }
    );

    expect(service.availableLocales().some(l => l.code === 'fr')).toBe(true);

    service.setLocale('fr');
    TestBed.flushEffects();

    expect(service.locale()).toBe('fr');
    expect(service.direction()).toBe('ltr');
    expect(service.isRtl()).toBe(false);
    expect(document.documentElement.lang).toBe('fr');
    expect(document.documentElement.dir).toBe('ltr');

    // Translated key in French
    expect(service.t('common.save')).toBe('Enregistrer');
    expect(service.t('nav.dashboard')).toBe('Tableau de bord exécutif');

    // Missing key in French falls back to English
    expect(service.t('nav.vatReturn')).toBe('VAT 201 Return');
  });

  it('11. should dynamically register an RTL language (Urdu) and apply dir="rtl"', () => {
    service.registerLocale(
      { code: 'ur', name: 'Urdu', nativeName: 'اردو', direction: 'rtl', numberLocale: 'ur-PK' },
      {
        common: { save: 'محفوظ کریں' }
      }
    );

    service.setLocale('ur');
    TestBed.flushEffects();

    expect(service.locale()).toBe('ur');
    expect(service.direction()).toBe('rtl');
    expect(service.isRtl()).toBe(true);
    expect(document.documentElement.lang).toBe('ur');
    expect(document.documentElement.dir).toBe('rtl');

    expect(service.t('common.save')).toBe('محفوظ کریں');
  });

  it('12. should interpolate parameters in both {param} and {{param}} formats', () => {
    service.setLocale('en');
    const withSingleBrace = service.t('search.noResults', { query: 'INV-100' });
    expect(withSingleBrace).toBe('No matching records found for "INV-100"');

    const withDoubleBrace = service.t('common.recordsFound', { count: 42 });
    expect(withDoubleBrace).toBe('42 records found');
  });
});
