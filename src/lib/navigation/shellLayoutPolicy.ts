import type { FormFactor } from '../../hooks/useFormFactor';

export type ShellTabBarPosition = 'bottom' | 'left';

/** Bottom tabs in every orientation — same navigation pattern as portrait. */
export function resolveShellTabBarLayout(
  _formFactor: FormFactor,
  _isLandscape: boolean,
): { useRail: boolean; tabBarPosition: ShellTabBarPosition } {
  return {
    useRail: false,
    tabBarPosition: 'bottom',
  };
}

/** Tracks uses a full-height master pane only when master–detail is split. */
export function shouldTracksScreenUseScrollRoot(formFactor: FormFactor): boolean {
  return formFactor !== 'compact';
}
