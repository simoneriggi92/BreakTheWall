/** The interface speaks English or Italian; a disassembly's content keeps its own language. */
export type Language = 'it' | 'en';
export type LanguageSetting = 'system' | Language;
/** `system` follows the operating system: an Italian locale gives Italian, any other gives English. */
export function resolveLanguage(setting: LanguageSetting | undefined, locale: string | undefined): Language {
  if (setting === 'it' || setting === 'en') return setting;
  return locale?.toLowerCase().startsWith('it') ? 'it' : 'en';
}
