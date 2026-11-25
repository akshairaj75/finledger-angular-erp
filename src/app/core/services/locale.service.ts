import { Injectable, computed, effect, signal } from '@angular/core';
import { ar } from '../i18n/ar';
import { en, TranslationDictionary } from '../i18n/en';
import { Direction, LocaleConfig, SUPPORTED_LOCALES } from '../i18n/locale.model';

export type SupportedLocale = string;
export type { Direction, LocaleConfig };
export { SUPPORTED_LOCALES };

export const LOCALE_STORAGE_KEY = 'finledger_lang';

@Injectable({
  providedIn: 'root'
})
export class LocaleService {
  private readonly dictionaries = signal<Record<string, any>>({ en, ar });

  public readonly availableLocales = signal<LocaleConfig[]>(SUPPORTED_LOCALES);
  public readonly locale = signal<string>(this.resolveInitialLocale());

  public readonly currentConfig = computed<LocaleConfig>(() => {
    const code = this.locale();
    return this.availableLocales().find(l => l.code === code) || this.availableLocales()[0] || {
      code: 'en',
      name: 'English',
      nativeName: 'English',
      direction: 'ltr',
      numberLocale: 'en-US'
    };
  });

  public readonly direction = computed<Direction>(() => this.currentConfig().direction);
  public readonly isRtl = computed<boolean>(() => this.direction() === 'rtl');

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

  public registerLocale(config: LocaleConfig, dictionary: any): void {
    const existing = this.availableLocales();
    if (!existing.some(l => l.code === config.code)) {
      this.availableLocales.set([...existing, config]);
    }
    this.dictionaries.update(dict => ({ ...dict, [config.code]: dictionary }));
  }

  public setLocale(newLocale: string): void {
    if (this.availableLocales().some(l => l.code === newLocale)) {
      this.locale.set(newLocale);
    }
  }

  public toggleLocale(): void {
    const locales = this.availableLocales();
    if (locales.length === 0) return;
    const currentIndex = locales.findIndex(l => l.code === this.locale());
    const nextIndex = (currentIndex + 1) % locales.length;
    this.setLocale(locales[nextIndex].code);
  }

  /**
   * Resolves translation key (e.g. 'nav.dashboard', 'common.save')
   * with optional interpolation params { name: 'X' } or {{ name: 'X' }}.
   */
  public t(key: string, params?: Record<string, any>): string {
    const dicts = this.dictionaries();
    const activeDict = dicts[this.locale()] || dicts['en'];
    let translation = this.lookupKey(activeDict, key);

    // Fallback to English if missing in active dictionary
    if (translation === undefined && this.locale() !== 'en' && dicts['en']) {
      translation = this.lookupKey(dicts['en'], key);
    }

    if (translation === undefined) {
      return key;
    }

    if (params) {
      return Object.entries(params).reduce(
        (str, [paramKey, val]) => str.replace(new RegExp(`\\{+${paramKey}\\}+`, 'g'), String(val)),
        translation
      );
    }

    return translation;
  }

  private lookupKey(dict: any, key: string): string | undefined {
    if (!dict) return undefined;
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

  private resolveInitialLocale(): string {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      try {
        const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
        if (stored && SUPPORTED_LOCALES.some(l => l.code === stored)) {
          return stored;
        }
      } catch {
        // Fall back to default
      }
    }
    return 'en';
  }
}
