import { useWindowDimensions } from 'react-native';

export type FormFactor = 'compact' | 'medium' | 'expanded';

export function useFormFactor(): {
  formFactor: FormFactor;
  width: number;
  height: number;
  isLandscape: boolean;
  instrumentHeroSize: number;
} {
  const { width, height } = useWindowDimensions();
  const formFactor: FormFactor = width >= 840 ? 'expanded' : width >= 600 ? 'medium' : 'compact';
  const instrumentHeroSize = formFactor === 'expanded' ? 36 : formFactor === 'medium' ? 32 : 28;
  return {
    formFactor,
    width,
    height,
    isLandscape: width > height,
    instrumentHeroSize,
  };
}
