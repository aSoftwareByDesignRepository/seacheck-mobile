import { resolvePassageEditorLayout } from '../src/lib/passage/passageEditorLayoutPolicy';

describe('passageEditorLayoutPolicy', () => {
  it('keeps map hand-off in waypoint section on compact phones', () => {
    expect(
      resolvePassageEditorLayout({ formFactor: 'compact', isLandscape: false, waypointCount: 0 }),
    ).toEqual({
      showMapPreview: false,
      showMapHandoffButtons: true,
      defaultDetailTab: 'route',
    });
    expect(
      resolvePassageEditorLayout({ formFactor: 'compact', isLandscape: false, waypointCount: 2 }),
    ).toEqual({
      showMapPreview: true,
      showMapHandoffButtons: true,
      defaultDetailTab: 'route',
    });
  });

  it('shows map preview on tablet portrait even with zero waypoints', () => {
    expect(
      resolvePassageEditorLayout({ formFactor: 'medium', isLandscape: false, waypointCount: 0 }),
    ).toEqual({
      showMapPreview: true,
      showMapHandoffButtons: false,
      defaultDetailTab: 'route',
    });
    expect(
      resolvePassageEditorLayout({ formFactor: 'expanded', isLandscape: false, waypointCount: 0 }),
    ).toEqual({
      showMapPreview: true,
      showMapHandoffButtons: false,
      defaultDetailTab: 'route',
    });
  });

  it('opens map tab by default on tablet landscape for empty passages', () => {
    expect(
      resolvePassageEditorLayout({ formFactor: 'medium', isLandscape: true, waypointCount: 0 }),
    ).toEqual({
      showMapPreview: true,
      showMapHandoffButtons: false,
      defaultDetailTab: 'map',
    });
    expect(
      resolvePassageEditorLayout({ formFactor: 'expanded', isLandscape: true, waypointCount: 0 }),
    ).toEqual({
      showMapPreview: true,
      showMapHandoffButtons: false,
      defaultDetailTab: 'map',
    });
  });

  it('returns to route tab on tablet landscape once waypoints exist', () => {
    expect(
      resolvePassageEditorLayout({ formFactor: 'medium', isLandscape: true, waypointCount: 1 }),
    ).toEqual({
      showMapPreview: true,
      showMapHandoffButtons: false,
      defaultDetailTab: 'route',
    });
  });
});
