export type Direction = 'ltr' | 'rtl';

export interface LocaleConfig {
  code: string;            // ISO code: 'en', 'ar', 'fr', 'ur', etc.
  name: string;            // English name: 'English', 'Arabic', 'French', 'Urdu'
  nativeName: string;      // Native representation: 'English', 'العربية', 'Français', 'اردو'
  direction: Direction;    // Layout direction
  flag?: string;           // Optional flag icon or emoji
  dateFormat?: string;     // Default date format mask
  numberLocale?: string;   // For Intl.NumberFormat: 'en-US', 'ar-AE', 'fr-FR'
}

export const SUPPORTED_LOCALES: LocaleConfig[] = [
  { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr', numberLocale: 'en-US', dateFormat: 'YYYY-MM-DD' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', direction: 'rtl', numberLocale: 'ar-AE', dateFormat: 'YYYY-MM-DD' }
];
