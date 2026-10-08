/**
 * StatusBar coverage contract (sc-vis-onboarding-statusbar-icons-invisible):
 * the isDark-aware <StatusBar> must be mounted ONCE at the root so boot,
 * onboarding, and every shell screen get readable status-bar icons.
 * OnboardingScreen renders outside MainShell — a shell-local StatusBar left
 * icons light-on-#f5f7fb (WCAG 1.4.11 fail, pixel-verified 0 dark px).
 */
import fs from 'fs';
import path from 'path';

const readSrc = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

describe('root-level StatusBar coverage', () => {
  it('RootNavigator mounts an isDark-aware StatusBar before BootGate (covers all branches)', () => {
    const src = readSrc('src/shell/RootNavigator.tsx');
    expect(src).toMatch(/import\s*{\s*StatusBar\s*}\s*from\s*'expo-status-bar'/);
    expect(src).toMatch(/<StatusBar\s+style=\{isDark\s*\?\s*'light'\s*:\s*'dark'\}\s*\/>/);
    // Must render unconditionally — outside the settingsHydrated/onboarding ternary.
    expect(src.indexOf('<StatusBar')).toBeGreaterThanOrEqual(0);
    expect(src.indexOf('<StatusBar')).toBeLessThan(src.indexOf('<BootGate'));
    expect(src).toMatch(/<OnboardingScreen\s*\/>/);
  });

  it('MainShell does not shadow the root StatusBar with a second mount', () => {
    const src = readSrc('src/shell/MainShell.tsx');
    expect(src).not.toMatch(/<StatusBar/);
  });
});
