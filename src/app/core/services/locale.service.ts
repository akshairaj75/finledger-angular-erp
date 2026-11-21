import { Injectable, computed, effect, signal } from '@angular/core';
import { ar } from '../i18n/ar';
import { en, TranslationDictionary } from '../i18n/en';

export type SupportedLocale = 'en' | 'ar';
export type Direction = 'ltr' | 'rtl';

export const LOCALE_STORAGE_KEY = 'finledger_lang';

@Injectable({
  providedIn: 'root'
})
export class LocaleService {
  private readonly dictionaries: Record<SupportedLocale, TranslationDictionary> = { en, ar };

  public readonly locale = signal<SupportedLocale>(this.resolveInitialLocale());
  public readonly direction = computed<Direction>(() => (this.locale() === 'ar' ? 'rtl' : 'ltr'));
  public readonly isRtl = computed<boolean>(() => this.locale() === 'ar');

  constructor() {
    effect(() => {
      const current = this.locale();
      const dir = this.direction();

      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        document.documentElement.lang = current;
        document.documentElement.dir = dir;

        try {
          window.localStorage.setItem(LOCALE_STORAGE_KEY, current);
        } catch {
          // Ignore localStorage access failures (e.g., security restrictions)
        }
      }
    });
  }

  public setLocale(newLocale: SupportedLocale): void {
    if (newLocale === 'en' || newLocale === 'ar') {
      this.locale.set(newLocale);
    }
  }

  public toggleLocale(): void {
    this.setLocale(this.locale() === 'en' ? 'ar' : 'en');
  }

  /**
   * Resolves translation key (e.g. 'nav.dashboard', 'common.save')
   * with optional interpolation params { name: 'X' }.
   */
  public t(key: string, params?: Record<string, string | number>): string {
    const activeDict = this.dictionaries[this.locale()] || this.dictionaries.en;
    let translation = this.lookupKey(activeDict, key);

    // Fallback to English if missing in active dictionary
    if (translation === undefined && this.locale() !== 'en') {
      translation = this.lookupKey(this.dictionaries.en, key);
    }

    if (translation === undefined) {
      return key;
    }

    if (params) {
      return Object.entries(params).reduce(
        (str, [paramKey, val]) => str.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(val)),
        translation
      );
    }

    return translation;
  }

  private lookupKey(dict: any, key: string): string | undefined {
    const segments = key.split('.');
    let curr = dict;
    for (const segment of segments) {
      if (curr && typeof curr === 'object' && segment in curr) {
        curr = curr[segment];
      } else {
        return undefined;
      }
    }
    return typeof curr === 'string' ? curr : undefined;
  }

  private resolveInitialLocale(): SupportedLocale {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      try {
        const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
        if (stored === 'en' || stored === 'ar') {
          return stored;
        }
      } catch {
        // Fall back to default
      }
    }
    return 'en';
  }
}
