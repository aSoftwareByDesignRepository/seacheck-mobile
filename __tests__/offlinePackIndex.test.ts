import { sanitizePersistedIndex } from '../src/lib/offline/offlinePackIndex';

describe('sanitizePersistedIndex', () => {
  it('keeps valid region and custom entries', () => {
    const index = sanitizePersistedIndex({
      'kiel-bay': { packId: 'pack-1', seamarksIndexed: true },
      custom_abc: {
        packId: 'pack-2',
        custom: true,
        name: 'Harbor',
        bounds: [9.8, 54.2, 10.2, 54.5],
        minZoom: 10,
        maxZoom: 14,
      },
    });

    expect(index['kiel-bay']).toEqual({ packId: 'pack-1', seamarksIndexed: true });
    expect(index.custom_abc).toMatchObject({
      packId: 'pack-2',
      custom: true,
      name: 'Harbor',
      minZoom: 10,
      maxZoom: 14,
    });
  });

  it('drops malformed rows and oversized custom bounds', () => {
    const index = sanitizePersistedIndex({
      '': { packId: 'x' },
      bad: { packId: '' },
      huge: {
        packId: 'pack-huge',
        custom: true,
        bounds: [0, 0, 10, 10],
        minZoom: 10,
        maxZoom: 14,
      },
      evil: {
        packId: 'pack-evil',
        name: 'bad\u0000name',
        bounds: [200, 0, 201, 1],
      },
    });

    expect(index.evil).toEqual({ packId: 'pack-evil', name: 'badname' });
    expect(index.evil?.bounds).toBeUndefined();
  });

  it('sanitizes display names and clamps zoom levels', () => {
    const index = sanitizePersistedIndex({
      custom_ok: {
        packId: 'pack-3',
        custom: true,
        name: `  ${'x'.repeat(200)}  `,
        bounds: [9.8, 54.2, 10.0, 54.4],
        minZoom: -2,
        maxZoom: 99,
      },
    });

    expect(index.custom_ok?.name?.length).toBe(120);
    expect(index.custom_ok?.minZoom).toBe(10);
    expect(index.custom_ok?.maxZoom).toBe(14);
  });
});
