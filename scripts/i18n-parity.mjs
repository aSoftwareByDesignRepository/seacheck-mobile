import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runFullLocaleParity } from '../../scripts/lib/i18n-parity-full.mjs';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const result = runFullLocaleParity({ appRoot });
if (!result.ok) {
  process.exit(1);
}
console.log(`PASS i18n parity (${result.keyCount} keys × ${result.localeCount} locales)`);
