import type { FormFactor } from '../../hooks/useFormFactor';
import { shouldUseMasterDetail } from '../responsive/splitLayout';

export type PassageDetailTab = 'route' | 'map';

export type PassageEditorLayoutPolicy = {
  /** Render map preview pane (tablet split / route-map tabs). */
  showMapPreview: boolean;
  /** Plan / show-on-map buttons in waypoint section (phones). */
  showMapHandoffButtons: boolean;
  /** Initial tab when route + map are toggled (landscape tablet, compact with waypoints). */
  defaultDetailTab: PassageDetailTab;
};

/**
 * Responsive passage editor — map hand-off must stay reachable on every form factor.
 * Tablet portrait: map preview pane is always visible (side-by-side).
 * Tablet landscape: map tab defaults open when the passage has no waypoints yet.
 */
export function resolvePassageEditorLayout(opts: {
  formFactor: FormFactor;
  isLandscape: boolean;
  waypointCount: number;
}): PassageEditorLayoutPolicy {
  const { formFactor, isLandscape, waypointCount } = opts;
  const compact = formFactor === 'compact';
  const split = shouldUseMasterDetail(formFactor, isLandscape);

  const showMapPreview = !compact || waypointCount >= 1;
  const showMapHandoffButtons = compact;
  const usesTabLayout = showMapPreview && !split;
  const defaultDetailTab: PassageDetailTab =
    usesTabLayout && waypointCount === 0 && !compact ? 'map' : 'route';

  return { showMapPreview, showMapHandoffButtons, defaultDetailTab };
}
