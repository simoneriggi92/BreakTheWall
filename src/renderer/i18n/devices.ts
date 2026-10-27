import type { Language } from '../../core/language';
import type { Messages } from './it';

/** How the texts that name the computer or its credential store refer to them. */
export interface DeviceWords {
  /** "this Mac": where the app, the local model and the sources are. */
  here: string;
  /** The credential store, as the subject of "… is not available". */
  store: string;
  /** Where signed-in credentials are kept, after "credentials stay …". */
  kept: string;
}

type DeviceTexts = {
  suggest: Pick<Messages['suggest'], 'local'>;
  generate: Pick<Messages['generate'], 'noKeychain' | 'useAccount' | 'sentLocal'>;
  local: Pick<Messages['local'], 'staysHere' | 'models' | 'otherAddress'>;
  failures: Pick<Messages['failures'], 'storage' | 'local-address'>;
};

export const DEVICES: Record<Language, Record<'mac' | 'windows' | 'other', DeviceWords>> = {
  en: {
    mac: { here: 'this Mac', store: 'The system keychain', kept: 'in this Mac’s keychain' },
    windows: { here: 'this PC', store: 'Windows credential protection', kept: 'protected by Windows on this PC' },
    other: { here: 'this computer', store: 'The system keyring', kept: 'in the system keyring' },
  },
  it: {
    mac: { here: 'questo Mac', store: 'Il portachiavi di sistema', kept: 'nel portachiavi di questo Mac' },
    windows: { here: 'questo PC', store: 'La protezione delle credenziali di Windows', kept: 'protette da Windows su questo PC' },
    other: { here: 'questo computer', store: 'Il portachiavi di sistema', kept: 'nel portachiavi di sistema' },
  },
};

/** The device texts of each catalog, written once with the device's words. With the Mac's words they equal the catalog. */
export const DEVICE_TEXTS: Record<Language, (w: DeviceWords) => DeviceTexts> = {
  en: w => ({
    suggest: { local: (model: string) => `${model} on ${w.here}` },
    generate: {
      noKeychain: `${w.store} is not available: sign-in is turned off so that no credentials are stored in plain text.`,
      useAccount: `Use your ChatGPT account. The browser opens; credentials stay ${w.kept}.`,
      sentLocal: (runtime: string, url: string) => `Only when you press "Generate": this first request, with the app's fixed instructions and the schema, goes to ${runtime} on ${w.here} (${url}). Then one request per part, with only that part's lines, and one for the runs. The source does not leave the computer.`,
    },
    local: { staysHere: `the source stays on ${w.here}`, models: `Models on ${w.here}`, otherAddress: `Another address on ${w.here}` },
    failures: {
      storage: `${w.store} is not available: credentials cannot be stored securely.`,
      'local-address': `To protect your sources, the local model must answer on ${w.here}: use an address such as localhost:1234 or 127.0.0.1:11434.`,
    },
  }),
  it: w => ({
    suggest: { local: (model: string) => `${model} su ${w.here}` },
    generate: {
      noKeychain: `${w.store} non è disponibile: l’accesso è disattivato per non salvare credenziali in chiaro.`,
      useAccount: `Usa il tuo account ChatGPT. Si apre il browser; le credenziali restano ${w.kept}.`,
      sentLocal: (runtime: string, url: string) => `Solo quando premi «Genera»: questa prima richiesta, con le istruzioni fisse dell’app e lo schema, va a ${runtime} su ${w.here} (${url}). Poi una richiesta per pezzo, con le sole righe di quel pezzo, e una per le prove. La fonte non lascia il computer.`,
    },
    local: { staysHere: `la fonte resta su ${w.here}`, models: `Modelli su ${w.here}`, otherAddress: `Altro indirizzo su ${w.here}` },
    failures: {
      storage: `${w.store} non è disponibile: le credenziali non possono essere salvate in modo protetto.`,
      'local-address': `Per proteggere le tue fonti, il modello locale deve rispondere su ${w.here}: usa un indirizzo come localhost:1234 o 127.0.0.1:11434.`,
    },
  }),
};

/**
 * The catalog for the platform the app runs on. macOS and the browser preview keep the catalog as written (it names
 * the Mac); Windows and other systems get their device's words in the few texts that name it.
 */
export function forPlatform(catalog: Messages, language: Language, platform: string | undefined): Messages {
  const device = platform === 'win32' ? 'windows' : platform && platform !== 'darwin' && platform !== 'web' ? 'other' : undefined;
  if (!device) return catalog;
  const texts = DEVICE_TEXTS[language](DEVICES[language][device]);
  return {
    ...catalog,
    suggest: { ...catalog.suggest, ...texts.suggest },
    generate: { ...catalog.generate, ...texts.generate },
    local: { ...catalog.local, ...texts.local },
    failures: { ...catalog.failures, ...texts.failures },
  };
}
