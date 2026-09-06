import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

describe('SeaCheck App Store / iOS review contract', () => {
  const root = join(__dirname, '..');

  it('uses customer-facing location purpose strings and declares background location', () => {
    const config = readFileSync(join(root, 'app.config.ts'), 'utf8');
    expect(config).toMatch(/NSLocationWhenInUseUsageDescription/);
    expect(config).toMatch(/NSLocationAlwaysAndWhenInUseUsageDescription/);
    expect(config).toMatch(/anchor alarms|Anchor/i);
    expect(config).toContain("UIBackgroundModes: ['location']");
    expect(config).toContain('usesNonExemptEncryption: false');
    expect(config).not.toMatch(/NSBonjourServices|_expo\._tcp/);
  });

  it('excludes expo-dev-client from production autolinking', () => {
    const config = readFileSync(join(root, 'app.config.ts'), 'utf8');
    expect(config).toContain("exclude: ['expo-dev-client'");
  });

  it('keeps privacy policy and terms reachable from Settings → About', () => {
    const about = readFileSync(join(root, 'src/screens/settings/SettingsAboutScreen.tsx'), 'utf8');
    expect(about).toContain('privacyPolicyUrl');
    expect(about).toContain('termsOfUseUrl');
    expect(about).toContain('settings.about.privacy');
    expect(about).toContain('settings.about.terms');
    expect(about).toContain('NavigationDisclaimer');
  });

  it('ships App Store Connect paste kit', () => {
    const appStore = join(root, 'docs/app-store');
    for (const file of [
      'README.md',
      'LISTING-en.txt',
      'LISTING-de.txt',
      'REVIEW-NOTES.txt',
      'GRAPHICS.md',
      'APP-PRIVACY.txt',
    ]) {
      expect(existsSync(join(appStore, file))).toBe(true);
    }
    const notes = readFileSync(join(appStore, 'REVIEW-NOTES.txt'), 'utf8');
    expect(notes).toMatch(/Background location/i);
    expect(notes).toMatch(/privacy-seacheck-mobile\.html/);
    expect(notes).toMatch(/Sign-in required:\s*\*\*No\*\*/i);
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string };
    expect(notes).toContain(`version ${pkg.version}`);
    expect(readFileSync(join(appStore, 'LISTING-en.txt'), 'utf8')).toContain(`Version: ${pkg.version}`);
    const privacy = readFileSync(join(appStore, 'APP-PRIVACY.txt'), 'utf8');
    expect(privacy).toMatch(/Precise Location/i);
    expect(privacy).toMatch(/Used for Tracking[\s\S]*No/i);
    expect(privacy).not.toMatch(/AZC2|Nextcloud Login Flow/i);
  });

  it('ships framed App Store screenshot assets (iPhone 6.5″ + iPad 13″)', () => {
    const assets = join(root, 'docs/app-store/assets');
    for (const n of ['01', '02', '03', '04', '05', '06']) {
      expect(existsSync(join(assets, `iphone-65-${n}.png`))).toBe(true);
      expect(existsSync(join(assets, `ipad-13-${n}.png`))).toBe(true);
    }
  });

  it('blocks health-adjacent Android permissions', () => {
    const config = readFileSync(join(root, 'app.config.ts'), 'utf8');
    expect(config).toContain('ACTIVITY_RECOGNITION');
    expect(config).toContain('blockedPermissions');
    expect(config).toContain('isAndroidMotionActivityEnabled: false');
  });
});
