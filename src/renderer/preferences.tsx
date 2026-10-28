import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Settings2 } from 'lucide-react';
import type { DesktopBridge, ProgressResult } from '../core/bridge';
import { resolveLanguage, type Language, type LanguageSetting } from '../core/language';
import { defaultSettings, type ProviderFailure, type StudioSettings } from '../core/provider';
import { en } from './i18n/en';
import { forPlatform } from './i18n/devices';
import { it, type Messages } from './i18n/it';

export const CATALOGS: Record<Language, Messages> = { it, en };
export type Theme = 'paper' | 'blueprint';
type ThemeSetting = NonNullable<StudioSettings['theme']>;
interface Preferences {
  language: Language; theme: Theme; t: Messages;
  /** Numbers formatted for the interface language. */
  n: (value: number) => string;
  /** Settings shared by the header and Studio; undefined until loaded. */
  settings?: StudioSettings;
  update: (patch: Partial<StudioSettings>) => void;
}
const numberFormat = (language: Language) => new Intl.NumberFormat(language === 'it' ? 'it-IT' : 'en-US').format;
const Context = createContext<Preferences>({ language: 'it', theme: 'paper', t: it, n: numberFormat('it'), update: () => {} });
export const usePreferences = () => useContext(Context);

// In the browser preview there is no settings store: theme and language are kept per browser.
const LOCAL_KEY = 'btw:preferences';
function readLocal(): Pick<StudioSettings, 'theme' | 'language'> {
  try {
    const value = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '{}') as Record<string, unknown>;
    return {
      ...(['system', 'paper', 'blueprint'].includes(value.theme as string) ? { theme: value.theme as ThemeSetting } : {}),
      ...(['system', 'it', 'en'].includes(value.language as string) ? { language: value.language as LanguageSetting } : {}),
    };
  } catch { return {}; }
}
const prefersDark = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;

/**
 * One owner for the settings file in the renderer, so a header toggle and Studio never overwrite each other's
 * fields with a stale copy. It also sets `lang` and `data-theme` on the document.
 */
export function PreferencesProvider({ bridge, children }: { bridge: DesktopBridge; children: ReactNode }) {
  const studio = bridge.studio;
  const [settings, setSettings] = useState<StudioSettings | undefined>(() => studio ? undefined : { ...defaultSettings, ...readLocal() });
  const [locale, setLocale] = useState(() => typeof navigator === 'undefined' ? undefined : navigator.language);
  const [dark, setDark] = useState(prefersDark);
  const [platform, setPlatform] = useState<string>();
  const latest = useRef(settings);
  useEffect(() => {
    let active = true;
    void studio?.getSettings().then(value => { if (active) { latest.current = value; setSettings(value); } }).catch(() => {});
    void bridge.getRuntime().then(info => { if (!active) return; setPlatform(info.platform); if (info.locale) setLocale(info.locale); }).catch(() => {});
    return () => { active = false; };
  }, [bridge, studio]);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => setDark(query.matches);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);
  const update = useCallback((patch: Partial<StudioSettings>) => {
    const next = { ...(latest.current ?? defaultSettings), ...patch };
    latest.current = next; setSettings(next);
    if (studio) void studio.saveSettings(next);
    else try { localStorage.setItem(LOCAL_KEY, JSON.stringify({ theme: next.theme, language: next.language })); } catch { /* A preference must not block the app. */ }
  }, [studio]);
  const language = resolveLanguage(settings?.language, locale);
  const theme: Theme = settings?.theme === 'paper' || settings?.theme === 'blueprint' ? settings.theme : dark ? 'blueprint' : 'paper';
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dataset.theme = theme;
  }, [language, theme]);
  // Texts that name the computer follow the platform: "this Mac" on macOS, "this PC" on Windows.
  const value = useMemo(() => ({ language, theme, t: forPlatform(CATALOGS[language], language, platform), n: numberFormat(language), settings, update }), [language, theme, platform, settings, update]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** Theme and language, reachable from every top bar. */
export function PreferencesMenu() {
  const { t, settings, update } = usePreferences();
  return <details className="preferences-menu"><summary aria-label={t.preferences.label}><Settings2 size={17}/></summary><div className="preferences-panel">
    <label>{t.preferences.theme}<select value={settings?.theme ?? 'system'} disabled={!settings} onChange={e => update({ theme: e.target.value as ThemeSetting })}>
      {(['system', 'paper', 'blueprint'] as const).map(x => <option key={x} value={x}>{t.preferences.themes[x]}</option>)}</select></label>
    <label>{t.preferences.language}<select value={settings?.language ?? 'system'} disabled={!settings} onChange={e => update({ language: e.target.value as LanguageSetting })}>
      {(['system', 'it', 'en'] as const).map(x => <option key={x} value={x}>{t.preferences.languages[x]}</option>)}</select></label>
  </div></details>;
}

/** Who wrote a generated disassembly: ChatGPT or a local model with its model, or the learner's assistant (P-20261028-mcp-integration M5). */
export const originText = (t: Messages, g: { provider: 'chatgpt' | 'local' | 'assistant'; model: string }) =>
  g.provider === 'assistant' ? t.tools.writtenByAssistant(g.model) : t.tools.generatedBy(g.provider === 'local', g.model);

/** Host failures are worded from their most specific code. */
export const failureText = (t: Messages, failure: ProviderFailure) => failure.reason ? t.reasons[failure.reason] : t.failures[failure.code];
/** Restore notices: disassemblies and lessons share codes but keep their own nouns. */
export function restoreText(t: Messages, result: Pick<ProgressResult, 'notice' | 'noticeCode'>, kind: 'lesson' | 'disassembly'): string {
  const code = result.noticeCode;
  if (!code) return result.notice ?? '';
  if (code === 'unreadable' || code === 'invalid') return t.restore[code];
  if (code === 'empty') return t.restore.lessonEmpty;
  if (kind === 'disassembly') return t.restore[code];
  return code === 'revision-changed' ? t.restore.lessonRevision : t.restore.lessonReferences;
}
