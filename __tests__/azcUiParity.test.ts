/**
 * AC-UI.1: SeaCheck light/dark/HC tokens must match COMPANION-DESIGN-SYSTEM
 * (AZC / Budget / Project). Chart/map paints may stay domain-fixed; chrome may not.
 * redNight is opt-in maritime night-vision — not default canvas dialect.
 */
import fs from 'fs';
import path from 'path';

import {
  darkPalette,
  highContrastPalette,
  lightPalette,
  themeSpacing,
} from '../src/theme/ThemeContext';

describe('AZC UI token parity (seacheck)', () => {
  it('keeps Check-family light canvas and primary (§2)', () => {
    expect(lightPalette.background).toBe('#f5f7fb');
    expect(lightPalette.surface).toBe('#ffffff');
    expect(lightPalette.border).toBe('#d9e2ec');
    expect(lightPalette.text).toBe('#102a43');
    expect(lightPalette.textMuted).toBe('#486581');
    expect(lightPalette.textSubtle).toBe('#56697d');
    expect(lightPalette.primary).toBe('#0073ad');
    expect(lightPalette.primaryText).toBe('#ffffff');
    expect(lightPalette.danger).toBe('#ba1b1b');
    expect(lightPalette.dangerText).toBe('#ffffff');
    expect(lightPalette.dangerBg).toBe('#fde8e8');
    expect(lightPalette.dangerBorder).toBe('#f5c2c2');
    expect(lightPalette.success).toBe('#0d7a4a');
    expect(lightPalette.successBg).toBe('#e6f4ed');
    expect(lightPalette.successBorder).toBe('#9fd4b8');
    expect(lightPalette.warningBg).toBe('#fff4e6');
    expect(lightPalette.warningBorder).toBe('#f0c987');
    expect(lightPalette.warningText).toBe('#8a4b08');
    expect(lightPalette.overlay).toBe('rgba(16, 42, 67, 0.45)');
    expect(lightPalette.trafficRed).toBe('#ba1b1b');
  });

  it('keeps Check-family dark canvas (not ops-instrument night)', () => {
    expect(darkPalette.background).toBe('#0b1622');
    expect(darkPalette.surface).toBe('#152536');
    expect(darkPalette.primary).toBe('#4dabf7');
    expect(darkPalette.danger).toBe('#c62828');
    expect(darkPalette.dangerText).toBe('#ffffff');
    expect(darkPalette.trafficRed).toBe('#ff6b6b');
    expect(darkPalette.background).not.toBe('#0b1220');
    expect(darkPalette.background).not.toBe('#0f172a');
    expect(darkPalette.primary).not.toBe('#38bdf8');
    expect(darkPalette.danger).not.toBe('#ff6b6b');
  });

  it('ships highContrast palette (COMPANION-DESIGN-SYSTEM §7)', () => {
    expect(highContrastPalette.background).toBe('#000000');
    expect(highContrastPalette.surface).toBe('#000000');
    expect(highContrastPalette.text).toBe('#ffffff');
    expect(highContrastPalette.primary).toBe('#ffff00');
    expect(highContrastPalette.primaryText).toBe('#000000');
    expect(highContrastPalette.danger).toBe('#ff6666');
    expect(highContrastPalette.dangerText).toBe('#000000');
  });

  it('uses family spacing scale (§4)', () => {
    expect(Object.values(themeSpacing)).toEqual([4, 8, 12, 16, 24, 32]);
  });

  it('exposes soft status wells (not solid hero fills)', () => {
    expect(lightPalette.dangerBg).toBe('#fde8e8');
    expect(lightPalette.dangerBorder).toBe('#f5c2c2');
    expect(lightPalette.successBg).toBe('#e6f4ed');
    expect(lightPalette.warningBg).toBe('#fff4e6');
    expect(lightPalette.neutralBg).toBe('#e8eef5');
    expect(lightPalette.neutralBorder).toBe('#c5d4e3');
    expect(darkPalette.neutralBg).toBe('#1a2838');
    expect(darkPalette.neutralBorder).toBe('#3d5166');
    expect(lightPalette.dangerBg).not.toBe('#7f1d1d');
    expect(lightPalette.dangerBg).not.toBe('#ef4444');
  });

  it('does not ship stage / kitchen / door-plate dialect tokens', () => {
    const light = lightPalette as Record<string, string>;
    for (const banned of [
      'kitchenStageTop',
      'kitchenStageMid',
      'doorPlateWood',
      'leatherDesk',
      'opsInstrumentNight',
      'skyBrand',
      'parchment',
    ]) {
      expect(light[banned]).toBeUndefined();
    }
    expect(lightPalette.background).not.toBe('#eef2f5');
    expect(lightPalette.background).not.toBe('#e8dcc8');
    expect(lightPalette.primary).not.toBe('#004f7a');
    expect(lightPalette.primary).not.toBe('#0082c9');
  });

  it('does not import LinearGradient, ImageBackground, or banned theatre hex as chrome', () => {
    const root = path.join(__dirname, '../src');
    const walk = (dir: string): string[] => {
      const out: string[] = [];
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        if (ent.name === 'node_modules' || ent.name === '__tests__' || ent.name === 'test') continue;
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) out.push(...walk(p));
        else if (/\.(tsx|ts)$/.test(ent.name) && !ent.name.endsWith('.test.ts') && !ent.name.endsWith('.test.tsx')) {
          out.push(p);
        }
      }
      return out;
    };
    // Chart paints (#aad3df water) and map overlays are content — banned chrome only.
    const bannedChrome =
      /LinearGradient|ImageBackground|KitchenStage|FridgeShelfRail|#38bdf8|#0b1220|#0f172a|#7f1d1d|#ef4444|#fbbf24|#e8dcc8/;
    for (const file of walk(root)) {
      const src = fs.readFileSync(file, 'utf8');
      expect({ file: path.relative(root, file), hit: bannedChrome.test(src) }).toEqual({
        file: path.relative(root, file),
        hit: false,
      });
    }
  });

  it('Button exposes four family variants', () => {
    const buttonSrc = fs.readFileSync(path.join(__dirname, '../src/ui/Button.tsx'), 'utf8');
    expect(buttonSrc).toMatch(/'primary'\s*\|\s*'secondary'\s*\|\s*'danger'\s*\|\s*'ghost'/);
    expect(buttonSrc).toMatch(/colors\.dangerText/);
  });
});
