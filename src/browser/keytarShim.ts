/**
 * Runtime shim to broaden Keychain/DPAPI lookups without vendoring chrome-cookies-secure.
 * It tries a list of alternative service/account labels after the original call fails.
 * Configure via ORACLE_KEYCHAIN_LABELS='[{"service":"Microsoft Edge Safe Storage","account":"Microsoft Edge"},...]'
 *
 * In CI or headless environments without libsecret/Keychain, set ORACLE_NO_KEYCHAIN=1 to skip
 * loading `keytar` entirely (calls become no-ops/nulls instead of crashing).
 */
import { createRequire } from 'node:module';
import type * as KeytarModule from 'keytar';

function buildNoopKeytar(): typeof KeytarModule {
  return {
    getPassword: async () => null,
    setPassword: async () => {
      throw new Error('Keychain disabled via ORACLE_NO_KEYCHAIN');
    },
    deletePassword: async () => false,
    findCredentials: async () => [],
    findPassword: async () => null,
  } as unknown as typeof KeytarModule;
}

const require = createRequire(import.meta.url);

let keytar: typeof KeytarModule;
if (process.env.ORACLE_NO_KEYCHAIN === '1') {
  keytar = buildNoopKeytar();
} else {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    keytar = require('keytar') as typeof KeytarModule;
  } catch (error) {
    if (process.env.CI) {
      // In CI we prefer a soft failure so the suite can continue without keytar.
      keytar = buildNoopKeytar();
    } else {
      throw error;
    }
  }
}

type Label = { service: string; account: string };

const defaultLabels: Label[] = [
  { service: 'Chrome Safe Storage', account: 'Chrome' },
  { service: 'Chromium Safe Storage', account: 'Chromium' },
  { service: 'Microsoft Edge Safe Storage', account: 'Microsoft Edge' },
  { service: 'Brave Safe Storage', account: 'Brave' },
  { service: 'Vivaldi Safe Storage', account: 'Vivaldi' },
];

function loadEnvLabels(): Label[] {
  const raw = process.env.ORACLE_KEYCHAIN_LABELS;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((entry) => (entry && typeof entry === 'object' ? entry : null))
        .filter((entry): entry is Label => Boolean(entry?.service && entry?.account));
    }
  } catch {
    // ignore invalid env payload
  }
  return [];
}

const fallbackLabels = [...loadEnvLabels(), ...defaultLabels];
const originalGetPassword = keytar.getPassword.bind(keytar);

keytar.getPassword = async (service: string, account: string): Promise<string | null> => {
  const primary = await originalGetPassword(service, account);
  if (primary) {
    return primary;
  }
  for (const label of fallbackLabels) {
    if (label.service === service && label.account === account) {
      continue; // already tried
    }
    const value = await originalGetPassword(label.service, label.account);
    if (value) {
      return value;
    }
  }
  return null;
};
