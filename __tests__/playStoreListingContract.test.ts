import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Play + App Store listing kit must stay publish-ready (standalone nav app — no AZC seats).
 */
describe('SeaCheck store listing contract', () => {
  const playRoot = join(__dirname, '../docs/play-store');
  const appStoreRoot = join(__dirname, '../docs/app-store');
  const appRoot = join(__dirname, '..');

  it('English Play listing names package, privacy URL, disclaimer, and no license gate', () => {
    const text = readFileSync(join(playRoot, 'LISTING-en.txt'), 'utf8');
    expect(text).toContain('de.softwarebydesign.seacheck');
    expect(text).toMatch(/privacy-seacheck-mobile\.html/);
    expect(text).toMatch(/NOT FOR PRIMARY NAVIGATION|not a certified chart plotter/i);
    expect(text).toMatch(/OpenSeaMap/);
    expect(text).not.toMatch(/AZC2|mobile seat|LicenseGate|Nextcloud Login Flow/i);
    expect(text).not.toMatch(/TODO|FIXME|lorem ipsum|_fill_/i);
  });

  it('German Play listing names package, Datenschutz URL, and Navigationshinweis', () => {
    const text = readFileSync(join(playRoot, 'LISTING-de.txt'), 'utf8');
    expect(text).toContain('de.softwarebydesign.seacheck');
    expect(text).toMatch(/datenschutz-seacheck-mobile\.html/);
    expect(text).toMatch(/amtlich|Hauptnavigation|Seekarten/i);
    expect(text).not.toMatch(/AZC2|Mobilplatz|Lizenzschlüssel/i);
    expect(text).not.toMatch(/TODO|FIXME|lorem ipsum/i);
  });

  it('App Store EN listing matches privacy URL and standalone scope', () => {
    const text = readFileSync(join(appStoreRoot, 'LISTING-en.txt'), 'utf8');
    expect(text).toContain('de.softwarebydesign.seacheck');
    expect(text).toMatch(/privacy-seacheck-mobile\.html/);
    expect(text).toMatch(/not for primary navigation|not a certified/i);
    expect(text).not.toMatch(/AZC2|LicenseGate|mobile seat|Login Flow/i);
    expect(text).not.toMatch(/requires a Nextcloud/i);
  });

  it('legalUrls.ts points at deployed website HTML paths', () => {
    const src = readFileSync(join(appRoot, 'src/lib/legal/legalUrls.ts'), 'utf8');
    expect(src).toContain('privacy-seacheck-mobile.html');
    expect(src).toContain('datenschutz-seacheck-mobile.html');
    expect(src).toContain('terms-seacheck-mobile.html');
    expect(src).toContain('nutzungsbedingungen-seacheck-mobile.html');
  });

  it('ships Play graphics kit assets', () => {
    expect(existsSync(join(playRoot, 'assets/feature-graphic-1024x500.png'))).toBe(true);
    expect(existsSync(join(playRoot, 'assets/play-icon-512.png'))).toBe(true);
  });

  it('ships at least six phone screenshot placeholders', () => {
    const names = [
      'phone-01-map.png',
      'phone-02-disclaimer.png',
      'phone-03-passage.png',
      'phone-04-downloads.png',
      'phone-05-offline.png',
      'phone-06-about.png',
    ];
    expect(names.every((n) => existsSync(join(playRoot, 'assets/screenshots', n)))).toBe(true);
  });

  it('app.config version matches package.json', () => {
    const pkg = JSON.parse(readFileSync(join(appRoot, 'package.json'), 'utf8')) as { version: string };
    const config = readFileSync(join(appRoot, 'app.config.ts'), 'utf8');
    expect(config).toContain(`version: '${pkg.version}'`);
    expect(config).toContain("package: 'de.softwarebydesign.seacheck'");
    expect(config).toContain("bundleIdentifier: 'de.softwarebydesign.seacheck'");
    expect(config).toContain('usesNonExemptEncryption: false');
  });

  it('release notes exist for current package version', () => {
    const pkg = JSON.parse(readFileSync(join(appRoot, 'package.json'), 'utf8')) as { version: string };
    expect(existsSync(join(playRoot, `release-notes/${pkg.version}.txt`))).toBe(true);
  });
});
