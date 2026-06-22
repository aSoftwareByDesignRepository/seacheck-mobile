import { useEffect, useState } from 'react';

import { getBarometerState, startBarometerSampling, subscribeBarometer } from '../services/barometerService';

export function useBarometer() {
  const [state, setState] = useState(getBarometerState);

  useEffect(() => {
    void startBarometerSampling();
    return subscribeBarometer(setState);
  }, []);

  return state;
}
