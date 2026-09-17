#!/usr/bin/env node
/**
 * Universal Play-compliance mutation gate for any Check companion app.
 *
 * Usage (from app root via package.json):
 *   "test:play-compliance": "node ../shared/android15-play-compliance/scripts/mutate-app-play-compliance.cjs"
 * SeaCheck / FlowCheck (vendor):
 *   "test:play-compliance": "node node_modules/@check/android15-play-compliance/scripts/mutate-app-play-compliance.cjs"
 *
 * Mutates orientation + OptimizedImage contracts and asserts Jest catches them.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const appRoot = process.cwd();

// Prefer monorepo bail helper; fall back to plain jest if missing.
let npxJestMutationArgs = (patterns) => ['jest', ...patterns, '--runInBand', '--forceExit', '--bail', '--no-coverage'];
let acquireMutationLock = () => {};
try {
  const bail = require(path.resolve(appRoot, '../scripts/lib/mutation-jest-bail.cjs'));
  npxJestMutationArgs = bail.npxJestMutationArgs;
  acquireMutationLock = bail.acquireMutationLock;
} catch {
  try {
    const bail = require(path.resolve(appRoot, '../../scripts/lib/mutation-jest-bail.cjs'));
    npxJestMutationArgs = bail.npxJestMutationArgs;
    acquireMutationLock = bail.acquireMutationLock;
  } catch {
    /* plain jest */
  }
}

acquireMutationLock(path.join(appRoot, 'scripts'));

function findFirst(candidates) {
  for (const rel of candidates) {
    const abs = path.join(appRoot, rel);
    if (fs.existsSync(abs)) return { rel, abs };
  }
  return null;
}

const appConfig = findFirst(['app.config.ts', 'app.config.js']);
if (!appConfig) {
  console.error('mutate-app-play-compliance: no app.config.ts/js in', appRoot);
  process.exit(1);
}

const optimized = findFirst(['src/ui/OptimizedImage.tsx', 'src/components/OptimizedImage.tsx']);
const login = findFirst(['src/screens/LoginScreen.tsx']);
const brandMark = findFirst([
  'src/ui/BrandMark.tsx',
  'src/components/BrandMark.tsx',
]);

const complianceTests = [
  'src/__tests__/androidPlayCompliance.test.ts',
  'src/test/androidPlayCompliance.test.ts',
  '__tests__/androidPlayCompliance.test.ts',
].filter((rel) => fs.existsSync(path.join(appRoot, rel)));

const optimizedTests = [
  'src/ui/__tests__/OptimizedImage.test.tsx',
  'src/test/OptimizedImage.test.tsx',
  'src/ui/__tests__/OptimizedImage.test.ts',
].filter((rel) => fs.existsSync(path.join(appRoot, rel)));

if (!complianceTests.length) {
  console.error('mutate-app-play-compliance: no androidPlayCompliance.test.ts found');
  process.exit(1);
}

const jestTargets = [...complianceTests, ...optimizedTests];

const originals = new Map();
function snapshot(abs) {
  originals.set(abs, fs.readFileSync(abs, 'utf8'));
}
function restoreAll() {
  for (const [abs, text] of originals) fs.writeFileSync(abs, text);
}

snapshot(appConfig.abs);
if (optimized) snapshot(optimized.abs);
if (login) snapshot(login.abs);
if (brandMark && brandMark.abs.includes('BrandMark') && /OptimizedImage/.test(fs.readFileSync(brandMark.abs, 'utf8'))) {
  snapshot(brandMark.abs);
}

function runJest() {
  const args = npxJestMutationArgs([...jestTargets, '--no-coverage']);
  return spawnSync('npx', args, {
    cwd: appRoot,
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'test' },
  });
}

function fail(msg) {
  restoreAll();
  console.error(msg);
  process.exit(1);
}

const baseline = runJest();
if (baseline.status !== 0) {
  fail(`baseline play-compliance tests failed:\n${baseline.stdout}\n${baseline.stderr}`);
}
console.log('play-compliance baseline OK');

const mutants = [
  {
    name: 'portrait-lock-restored',
    apply: () => {
      const text = originals.get(appConfig.abs);
      fs.writeFileSync(
        appConfig.abs,
        text.replace(/orientation:\s*'default'/, "orientation: 'portrait'"),
      );
    },
  },
];

if (optimized) {
  mutants.push({
    name: 'optimized-imports-rn-image',
    apply: () => {
      fs.writeFileSync(
        optimized.abs,
        `import { Image } from 'react-native';

export function OptimizedImage(props: Record<string, unknown>) {
  return <Image {...props} />;
}
`,
      );
    },
  });
}

if (login && /OptimizedImage/.test(originals.get(login.abs) || '')) {
  mutants.push({
    name: 'login-uses-rn-image',
    apply: () => {
      let next = originals.get(login.abs);
      next = next.replace("import { OptimizedImage } from '../ui/OptimizedImage';\n", '');
      next = next.replace(
        /import\s*\{([^}]*)\}\s*from\s*['"]react-native['"]/,
        (full, inner) => {
          if (/\bImage\b/.test(inner)) return full;
          const body = inner.replace(/^\s*\n/, '').replace(/\n\s*$/, '');
          return `import {\n  Image,\n${body}\n} from 'react-native'`;
        },
      );
      next = next
        .replace(/<OptimizedImage([\s\S]*?)\/>/g, '<Image$1 resizeMode="contain" />')
        .replace(/contentFit="contain"\n\s*/g, '');
      fs.writeFileSync(login.abs, next);
    },
  });
}

if (brandMark && originals.has(brandMark.abs)) {
  mutants.push({
    name: 'brandmark-uses-rn-image',
    apply: () => {
      const original = originals.get(brandMark.abs);
      fs.writeFileSync(
        brandMark.abs,
        original
          .replace("import { OptimizedImage } from '../ui/OptimizedImage';\n", '')
          .replace("import { OptimizedImage } from './OptimizedImage';\n", '')
          .replace(
            /import \{ ([^}]*) \} from 'react-native'/,
            (m, inner) => {
              if (/\bImage\b/.test(inner)) return m;
              return `import { Image, ${inner} } from 'react-native'`;
            },
          )
          .replace(/<OptimizedImage([\s\S]*?)\/>/, '<Image$1 resizeMode="contain" />')
          .replace('contentFit="contain"\n', ''),
      );
    },
  });
}

for (const mutant of mutants) {
  restoreAll();
  mutant.apply();
  const result = runJest();
  if (result.status === 0) {
    fail(`mutation ${mutant.name} was NOT caught by tests`);
  }
  console.log(`mutation ${mutant.name} caught (exit ${result.status})`);
}

restoreAll();
console.log(`play-compliance mutation gate OK (${path.basename(appRoot)})`);
