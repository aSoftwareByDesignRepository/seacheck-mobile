import { Image, type ImageProps } from 'expo-image';

/**
 * Memory-safe image host for Play Console bitmap optimization.
 *
 * Play flags raw React Native `Image` / Fresco decode paths when bitmaps
 * are shown without an image-loading library. `expo-image` downsamples,
 * caches, and recycles bitmaps (Glide on Android).
 */
export function OptimizedImage({
  cachePolicy = 'memory-disk',
  contentFit = 'contain',
  transition = 0,
  ...rest
}: ImageProps) {
  return (
    <Image
      cachePolicy={cachePolicy}
      contentFit={contentFit}
      transition={transition}
      {...rest}
    />
  );
}
