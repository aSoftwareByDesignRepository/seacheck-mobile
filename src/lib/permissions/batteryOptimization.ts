import * as Application from 'expo-application';
import * as IntentLauncher from 'expo-intent-launcher';
import { Linking, Platform } from 'react-native';

/** Whether Android Doze / battery saver may stop GPS and background tasks. */
export type BatteryOptimizationStatus = 'exempt' | 'restricted' | 'unknown';

type BatteryModule = typeof import('expo-battery');

async function loadBatteryModule(): Promise<BatteryModule | null> {
  try {
    // Deferred require — no native module at import time; works with Jest manual mocks.
    return require('expo-battery') as BatteryModule;
  } catch {
    return null;
  }
}

/**
 * On Android: `true` from expo-battery means optimization is ON (app may be killed in Doze).
 * On iOS: always exempt — no equivalent restriction API.
 */
export async function getBatteryOptimizationStatus(): Promise<BatteryOptimizationStatus> {
  if (Platform.OS !== 'android') return 'exempt';
  try {
    const Battery = await loadBatteryModule();
    if (!Battery) return 'unknown';
    const restricted = await Battery.isBatteryOptimizationEnabledAsync();
    return restricted ? 'restricted' : 'exempt';
  } catch {
    return 'unknown';
  }
}

/** Opens the system list where users can exempt SeaCheck from battery optimization. */
export async function openBatteryOptimizationSettings(): Promise<void> {
  if (Platform.OS !== 'android') {
    await Linking.openSettings();
    return;
  }
  try {
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
  } catch {
    await Linking.openSettings();
  }
}

/** Opens the direct “allow unrestricted battery” prompt for this app (Android 6+). */
export async function requestBatteryOptimizationExemption(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const packageName = Application.applicationId;
  if (!packageName) {
    await openBatteryOptimizationSettings();
    return;
  }
  try {
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, {
      data: `package:${packageName}`,
    });
  } catch {
    await openBatteryOptimizationSettings();
  }
}
