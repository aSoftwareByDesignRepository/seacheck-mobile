/**
 * DS §5 system-nav floor (Atlas 3.5.11): primary CTAs docked at the window
 * bottom must survive Android 3-button nav / AVDs that report insets.bottom=0
 * while chrome still covers ~48px. Source-scan parity with azcUiParity.test.ts.
 */
import fs from 'fs';
import path from 'path';

const readSrc = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

describe('system-nav 48dp floor on bottom-docked chrome (DS §5)', () => {
  it('AdaptiveTabBar pads the bottom tab bar to >=48', () => {
    const src = readSrc('src/navigation/AdaptiveTabBar.tsx');
    expect(src).toMatch(/paddingBottom:\s*Math\.max\(insets\.bottom,\s*48\)/);
  });

  it('AdaptiveTabBar honors side-docked nav (landscape right/left edge insets)', () => {
    const src = readSrc('src/navigation/AdaptiveTabBar.tsx');
    expect(src).toMatch(/paddingRight:\s*insets\.right/);
    expect(src).toMatch(/paddingLeft:\s*insets\.left/);
  });

  it('BottomSheetChrome sheet pad keeps a 48 floor for footer CTAs', () => {
    const src = readSrc('src/ui/sheetHost.tsx');
    expect(src).toMatch(/paddingBottom:\s*Math\.max\(insets\.bottom\s*\+\s*spacing\.lg,\s*48\)/);
  });

  it('OnboardingScreen sticky disclaimer CTA clears the nav bar on zero-inset devices', () => {
    const src = readSrc('src/screens/OnboardingScreen.tsx');
    expect(src).toMatch(/useSafeAreaInsets/);
    expect(src).toMatch(/Math\.max\(48\s*-\s*insets\.bottom,\s*0\)/);
    expect(src).toMatch(/paddingBottom:\s*stickyBottomPad/);
  });

  it('DownloadFailureModal backdrop keeps a 48 floor for its buttons', () => {
    const src = readSrc('src/ui/DownloadFailureModal.tsx');
    expect(src).toMatch(/paddingBottom:\s*Math\.max\(insets\.bottom\s*\+\s*spacing\.md,\s*48\)/);
  });

  it('ScreenLockOverlay clamps the MOB host bottom to a 48 floor inside the window modal', () => {
    const src = readSrc('src/features/map/ScreenLockOverlay.tsx');
    expect(src).toMatch(/useSafeAreaInsets/);
    expect(src).toMatch(/Math\.max\(layout\.actionsColumnBottom,\s*Math\.max\(insets\.bottom,\s*48\)\s*\+\s*spacing\.sm\)/);
  });
});
