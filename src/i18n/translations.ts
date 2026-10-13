import en from './locales/en.json';
import es from './locales/es.json';
import pt from './locales/pt.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import ja from './locales/ja.json';
import zh from './locales/zh.json';

export type LocaleCode = 'en' | 'es' | 'pt' | 'de' | 'fr' | 'ja' | 'zh';

export type TranslationDictionary = typeof en;

export interface LanguageOption {
  code: LocaleCode;
  badge: string;
  label: string;
  htmlLang: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', badge: 'US', label: 'English', htmlLang: 'en-US' },
  { code: 'es', badge: 'ES', label: 'Español', htmlLang: 'es-ES' },
  { code: 'pt', badge: 'BR', label: 'Português', htmlLang: 'pt-BR' },
  { code: 'de', badge: 'DE', label: 'Deutsch', htmlLang: 'de-DE' },
  { code: 'fr', badge: 'FR', label: 'Français', htmlLang: 'fr-FR' },
  { code: 'ja', badge: 'JP', label: '日本語', htmlLang: 'ja-JP' },
  { code: 'zh', badge: 'CN', label: '简体中文', htmlLang: 'zh-CN' },
];

export const DEFAULT_LANGUAGE: LocaleCode = 'en';

const dictionaries: Record<LocaleCode, TranslationDictionary> = {
  en,
  es,
  pt,
  de,
  fr,
  ja,
  zh,
};

export function getDictionary(lang?: string): TranslationDictionary {
  if (lang && lang in dictionaries) {
    return dictionaries[lang as LocaleCode];
  }
  return dictionaries[DEFAULT_LANGUAGE];
}

export function getLocalePath(code: LocaleCode): string {
  return code === DEFAULT_LANGUAGE ? '/' : `/${code}/`;
}
