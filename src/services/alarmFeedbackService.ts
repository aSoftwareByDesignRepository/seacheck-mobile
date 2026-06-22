import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { AccessibilityInfo, Platform, Vibration } from 'react-native';

import { useFeedbackStore } from '../store/feedbackStore';
import { useSettingsStore } from '../store/settingsStore';

export type AlarmSeverity = 'warning' | 'critical';

let alarmPlayer: AudioPlayer | null = null;
let audioInitialized = false;

async function ensureAlarmAudio() {
  if (audioInitialized) return;
  await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false });
  alarmPlayer = createAudioPlayer(require('../../assets/sounds/alarm.wav'));
  audioInitialized = true;
}

async function playAlarmSound(repeat = 1) {
  if (!useSettingsStore.getState().alarmSoundEnabled) return;
  try {
    await ensureAlarmAudio();
    if (!alarmPlayer) return;
    for (let i = 0; i < repeat; i++) {
      await alarmPlayer.seekTo(0);
      alarmPlayer.play();
      if (i < repeat - 1) {
        await new Promise((r) => setTimeout(r, 450));
      }
    }
  } catch {
    /* audio unavailable on this device */
  }
}

async function pulseHaptic(severity: AlarmSeverity) {
  if (!useSettingsStore.getState().alarmHapticEnabled) return;
  try {
    if (severity === 'critical') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (Platform.OS === 'android') {
        Vibration.vibrate([0, 400, 150, 400, 150, 400]);
      } else {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      if (Platform.OS === 'android') {
        Vibration.vibrate(300);
      }
    }
  } catch {
    /* haptics unavailable */
  }
}

/** Maritime alarm: banner + accessibility + optional sound/haptic. */
export async function triggerMaritimeAlarm(severity: AlarmSeverity, message: string) {
  void AccessibilityInfo.announceForAccessibility(message);
  if (severity === 'critical') {
    useFeedbackStore.getState().showError(message);
    await Promise.all([playAlarmSound(2), pulseHaptic('critical')]);
  } else {
    useFeedbackStore.getState().showInfo(message);
    await Promise.all([playAlarmSound(1), pulseHaptic('warning')]);
  }
}

/** Short haptic for map interactions (waypoint drop, MOB confirm). */
export async function pulseUiAcknowledgement() {
  if (!useSettingsStore.getState().alarmHapticEnabled) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    /* ignore */
  }
}
