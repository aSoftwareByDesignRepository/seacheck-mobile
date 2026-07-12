import { shouldTracksScreenUseScrollRoot, resolveShellTabBarLayout } from '../src/lib/navigation/shellLayoutPolicy';
import { shouldSplitMapLayout, shouldUseMasterDetail } from '../src/lib/responsive/splitLayout';

type Case = {
  label: string;
  formFactor: 'compact' | 'medium' | 'expanded';
  isLandscape: boolean;
  windowHeight: number;
  tabBarPosition: 'bottom' | 'left';
  splitMap: boolean;
  masterDetail: boolean;
  tracksScrollRoot: boolean;
};

/** Every phone/tablet orientation × form-factor combination the shell must handle. */
const MATRIX: Case[] = [
  {
    label: 'phone portrait',
    formFactor: 'compact',
    isLandscape: false,
    windowHeight: 640,
    tabBarPosition: 'bottom',
    splitMap: false,
    masterDetail: false,
    tracksScrollRoot: false,
  },
  {
    label: 'phone landscape',
    formFactor: 'compact',
    isLandscape: true,
    windowHeight: 320,
    tabBarPosition: 'bottom',
    splitMap: false,
    masterDetail: false,
    tracksScrollRoot: false,
  },
  {
    label: 'phablet portrait',
    formFactor: 'medium',
    isLandscape: false,
    windowHeight: 640,
    tabBarPosition: 'bottom',
    splitMap: false,
    masterDetail: true,
    tracksScrollRoot: true,
  },
  {
    label: 'phablet landscape',
    formFactor: 'medium',
    isLandscape: true,
    windowHeight: 600,
    tabBarPosition: 'bottom',
    splitMap: false,
    masterDetail: true,
    tracksScrollRoot: true,
  },
  {
    label: 'tablet portrait',
    formFactor: 'expanded',
    isLandscape: false,
    windowHeight: 640,
    tabBarPosition: 'bottom',
    splitMap: false,
    masterDetail: true,
    tracksScrollRoot: true,
  },
  {
    label: 'tablet landscape',
    formFactor: 'expanded',
    isLandscape: true,
    windowHeight: 800,
    tabBarPosition: 'bottom',
    splitMap: true,
    masterDetail: true,
    tracksScrollRoot: true,
  },
];

describe('shellLayoutPolicy', () => {
  it.each(MATRIX)('$label — tab bar, map split, master–detail', ({
    formFactor,
    isLandscape,
    windowHeight,
    tabBarPosition,
    splitMap,
    masterDetail,
    tracksScrollRoot,
  }) => {
    const shell = resolveShellTabBarLayout(formFactor, isLandscape);
    expect(shell.tabBarPosition).toBe(tabBarPosition);
    expect(shell.useRail).toBe(tabBarPosition === 'left');
    expect(shouldSplitMapLayout(formFactor, isLandscape, 'map-forward', windowHeight)).toBe(splitMap);
    expect(shouldUseMasterDetail(formFactor)).toBe(masterDetail);
    expect(shouldTracksScreenUseScrollRoot(formFactor)).toBe(tracksScrollRoot);
  });

  it('never uses side navigation rail', () => {
    for (const row of MATRIX) {
      const shell = resolveShellTabBarLayout(row.formFactor, row.isLandscape);
      expect(shell.useRail).toBe(false);
      expect(shell.tabBarPosition).toBe('bottom');
    }
  });
});
