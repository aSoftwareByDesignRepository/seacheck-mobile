import { classifySeamarkPlanningCategory } from '../src/lib/seamarks/seamarkCategories';
import {
  DEFAULT_SEAMARK_PLANNING,
  isSeamarkPlanningCategoryVisible,
  normalizeSeamarkPlanning,
  patchSeamarkPlanningCategory,
} from '../src/lib/settings/seamarkSettings';
import { approxViewportBounds } from '../src/lib/map/viewportBounds';

describe('seamarkCategories', () => {
  it('classifies harbour and anchorage types', () => {
    expect(classifySeamarkPlanningCategory({ 'seamark:type': 'harbour' })).toBe('harbour');
    expect(classifySeamarkPlanningCategory({ 'seamark:type': 'small_craft_facility' })).toBe('harbour');
    expect(classifySeamarkPlanningCategory({ 'seamark:type': 'anchorage' })).toBe('anchorage');
  });

  it('classifies navigation and hazard types', () => {
    expect(classifySeamarkPlanningCategory({ 'seamark:type': 'buoy_lateral' })).toBe('navigation');
    expect(classifySeamarkPlanningCategory({ 'seamark:type': 'light' })).toBe('navigation');
    expect(classifySeamarkPlanningCategory({ 'seamark:type': 'wreck' })).toBe('hazard');
  });

  it('returns null for unmapped types', () => {
    expect(classifySeamarkPlanningCategory({ 'seamark:type': 'radar_reflector' })).toBeNull();
  });
});

describe('seamarkSettings', () => {
  it('normalizes invalid planning config to defaults', () => {
    expect(normalizeSeamarkPlanning(null)).toEqual(DEFAULT_SEAMARK_PLANNING);
    expect(normalizeSeamarkPlanning({ enabled: false, harbour: { enabled: true, fromZoom: 99 } }).harbour.fromZoom).toBe(8);
  });

  it('patches a single category', () => {
    const next = patchSeamarkPlanningCategory(DEFAULT_SEAMARK_PLANNING, 'harbour', { fromZoom: 10 });
    expect(next.harbour.fromZoom).toBe(10);
    expect(next.anchorage.fromZoom).toBe(9);
  });

  it('gates visibility by zoom and toggles', () => {
    expect(isSeamarkPlanningCategoryVisible(DEFAULT_SEAMARK_PLANNING, 'harbour', 8)).toBe(true);
    expect(isSeamarkPlanningCategoryVisible(DEFAULT_SEAMARK_PLANNING, 'harbour', 7)).toBe(false);
    expect(isSeamarkPlanningCategoryVisible(DEFAULT_SEAMARK_PLANNING, 'navigation', 12)).toBe(false);
    expect(
      isSeamarkPlanningCategoryVisible(
        patchSeamarkPlanningCategory(DEFAULT_SEAMARK_PLANNING, 'navigation', { enabled: true }),
        'navigation',
        12,
      ),
    ).toBe(true);
  });
});

describe('approxViewportBounds', () => {
  it('returns a padded box around centre', () => {
    const [west, south, east, north] = approxViewportBounds(54.3, 10.1, 10);
    expect(west).toBeLessThan(10.1);
    expect(east).toBeGreaterThan(10.1);
    expect(south).toBeLessThan(54.3);
    expect(north).toBeGreaterThan(54.3);
  });
});
