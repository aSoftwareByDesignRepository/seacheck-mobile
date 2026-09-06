/**
 * On-screen size for Android MapLibre hosts that must stay in the viewport for
 * tile cache / OfflineManager work, but must not cover the UI.
 *
 * Fullscreen TextureViews ignore parent opacity on many Android devices and paint
 * opaque black (or ocean) over the whole app — never size those hosts to fill.
 */
export const HIDDEN_MAP_ENGINE_SIZE_PX = 256;
