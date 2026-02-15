/**
 * Utility functions for handling images with fallbacks
 */

/**
 * Generates a Lorem Picsum URL with specific dimensions and optional seed
 * @param width - Image width
 * @param height - Image height
 * @param seed - Optional seed for consistent random images
 * @returns Lorem Picsum URL
 */
export const getLoremPicsumUrl = (
  width: number = 800,
  height: number = 600,
  seed?: string | number
): string => {
  if (seed !== undefined) {
    return `https://picsum.photos/seed/${seed}/${width}/${height}?grayscale`;
  }
  return `https://picsum.photos/${width}/${height}?grayscale`;
};

/**
 * Gets a fallback image URL, preferring Lorem Picsum
 * @param originalUrl - The original image URL to display (currently ignored for development)
 * @param fallbackWidth - Width for fallback image
 * @param fallbackHeight - Height for fallback image
 * @param seed - Optional seed for consistent random images
 * @returns Lorem Picsum URL for development preview
 */
export const getImageWithFallback = (
  originalUrl: string | undefined | null,
  fallbackWidth: number = 800,
  fallbackHeight: number = 600,
  seed?: string | number
): string => {
  if (originalUrl && originalUrl.trim() !== '') {
    return originalUrl;
  }
  return getLoremPicsumUrl(fallbackWidth, fallbackHeight, seed);
};
