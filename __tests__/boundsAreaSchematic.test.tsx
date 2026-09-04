import { BoundsAreaSchematic } from '../src/features/downloads/BoundsAreaSchematic';
import { render } from '@testing-library/react-native';

describe('BoundsAreaSchematic', () => {
  it('renders a framed area for rectangle corners', () => {
    const { getByTestId } = render(
      <BoundsAreaSchematic
        corners={[
          { longitude: 10, latitude: 54 },
          { longitude: 11, latitude: 54 },
          { longitude: 11, latitude: 55 },
          { longitude: 10, latitude: 55 },
        ]}
        bounds={[10, 54, 11, 55]}
        height={140}
        fillColor="#0073ad33"
        lineColor="#0073ad"
        backgroundColor="#fff"
        borderColor="#ccc"
        testID="schematic"
      />,
    );
    expect(getByTestId('schematic')).toBeTruthy();
  });

  it('returns null when there is nothing to draw', () => {
    const { toJSON } = render(
      <BoundsAreaSchematic
        corners={[]}
        height={140}
        fillColor="#0073ad33"
        lineColor="#0073ad"
        backgroundColor="#fff"
        borderColor="#ccc"
        testID="schematic"
      />,
    );
    expect(toJSON()).toBeNull();
  });
});
