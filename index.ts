import { LogBox } from 'react-native';
import { registerRootComponent } from 'expo';

import { configureMapLogging } from './src/map/mapLogging';

// Registers background GPS task before React mounts — must stay a side-effect import.
import './src/services/trackBackgroundTask';
import App from './App';

configureMapLogging();

// MapLibre logs non-fatal tile/render noise on emulators — avoid LogBox spam (real failures still hit logcat).
LogBox.ignoreLogs([
  'MapLibre Native',
  '[Mbgl]',
  'Failed to load tile',
]);

registerRootComponent(App);
