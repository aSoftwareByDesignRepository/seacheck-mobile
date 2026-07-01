import { useWindowDimensions } from 'react-native';

export type FormFactor = 'compact' | 'medium' | 'expanded';

export function useFormFactor(): {
  formFactor: FormFactor;
  width: number;
  height: number;
  isLandscape: boolean;
  instrumentHeroSize: number;
  /** Map dock coordinate readout — readable on paper charts. */
  instrumentCoordsSize: number;
  /** Full-screen instruments layout — primary position readout. */
  instrumentProminentCoordsSize: number;
  /** Full-screen instruments hero chips (SOG/COG). */
  instrumentFullScreenHeroSize: number;
} {
  const { width, height } = useWindowDimensions();
  const formFactor: FormFactor = width >= 840 ? 'expanded' : width >= 600 ? 'medium' : 'compact';
  const instrumentHeroSize = formFactor === 'expanded' ? 36 : formFactor === 'medium' ? 32 : 28;
  const instrumentCoordsSize = formFactor === 'expanded' ? 20 : formFactor === 'medium' ? 18 : 17;
  const instrumentProminentCoordsSize = formFactor === 'expanded' ? 32 : formFactor === 'medium' ? 28 : 24;
  const instrumentFullScreenHeroSize = Math.min(
    64,
    Math.max(instrumentHeroSize + 16, Math.round(Math.min(width, height) * 0.11)),
  );
  return {
    formFactor,
    width,
    height,
    isLandscape: width > height,
    instrumentHeroSize,
    instrumentCoordsSize,
    instrumentProminentCoordsSize,
    instrumentFullScreenHeroSize,
  };
}
