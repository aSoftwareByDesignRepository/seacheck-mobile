import { useCustomDownloadStore } from '../src/store/customDownloadStore';
import { boundsFromPoints, rectangleCornersFromBounds } from '../src/lib/map/customDownloadCorners';

describe('customDownloadStore', () => {
  beforeEach(() => {
    useCustomDownloadStore.getState().cancelSelecting();
  });

  it('builds live preview after two corners', () => {
    const store = useCustomDownloadStore.getState();
    store.startSelecting();
    store.addCorner({ latitude: 54.3, longitude: 10.0 });
    store.addCorner({ latitude: 54.5, longitude: 10.2 });

    expect(store.getPreviewBounds()).toEqual([10.0, 54.3, 10.2, 54.5]);
    expect(store.getBounds()).toBeNull();
    expect(store.phase).toBe('placing');
  });

  it('completes rectangle after four corners', () => {
    const store = useCustomDownloadStore.getState();
    store.startSelecting();
    const points = rectangleCornersFromBounds([10.0, 54.3, 10.2, 54.5]);
    for (const point of points) {
      store.addCorner(point);
    }

    const after = useCustomDownloadStore.getState();
    expect(after.phase).toBe('complete');
    expect(after.getBounds()).toEqual([10.0, 54.3, 10.2, 54.5]);
    expect(after.corners).toHaveLength(4);
  });

  it('rejects too-small rectangle on completion', () => {
    const store = useCustomDownloadStore.getState();
    store.startSelecting();
    store.addCorner({ latitude: 54.32, longitude: 10.14 });
    store.addCorner({ latitude: 54.3205, longitude: 10.1405 });
    const third = store.addCorner({ latitude: 54.3206, longitude: 10.1406 });
    const fourth = store.addCorner({ latitude: 54.3207, longitude: 10.1407 });

    expect(third.kind).toBe('added');
    expect(fourth).toEqual({ kind: 'complete_invalid', code: 'too_small' });
    expect(useCustomDownloadStore.getState().corners).toHaveLength(4);
  });

  it('moves and removes corners while keeping indices sequential', () => {
    const store = useCustomDownloadStore.getState();
    store.startSelecting();
    const points = rectangleCornersFromBounds([10.0, 54.3, 10.2, 54.5]);
    for (const point of points) {
      store.addCorner(point);
    }
    const firstId = useCustomDownloadStore.getState().corners[0].id;

    store.removeCorner(firstId);
    const afterRemove = useCustomDownloadStore.getState();
    expect(afterRemove.corners).toHaveLength(3);
    expect(afterRemove.corners[0].index).toBe(1);
    expect(afterRemove.phase).toBe('placing');

    store.moveCorner(afterRemove.corners[0].id, { latitude: 54.25, longitude: 9.95 });
    const movedBounds = boundsFromPoints(useCustomDownloadStore.getState().corners);
    expect(movedBounds?.[1]).toBeCloseTo(54.25, 2);
  });

  it('prefills four corners from existing bounds', () => {
    useCustomDownloadStore.getState().prefillFromBounds([10.0, 54.3, 10.2, 54.5], 'Passage area');
    const store = useCustomDownloadStore.getState();
    expect(store.phase).toBe('complete');
    expect(store.corners).toHaveLength(4);
    expect(store.getBounds()).toEqual([10.0, 54.3, 10.2, 54.5]);
    expect(store.packName).toBe('Passage area');
  });
});
