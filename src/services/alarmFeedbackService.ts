import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccessibilityInfo, Platform, Vibration } from 'react-native';

import { useFeedbackStore } from '../store/feedbackStore';
import { showMaritimeAlarmNotification } from './maritimeAlarmNotifications';

export type AlarmSeverity = 'warning' | 'critical';

type AudioPlayerLike = {
  seekTo: (position: number) => Promise<void>;
  play: () => void;
};

type AudioModule = typeof import('expo-audio');
type HapticsModule = typeof import('expo-haptics');

let alarmPlayer: AudioPlayerLike | null = null;
let audioInitialized = false;
let backgroundAudioInitialized = false;

async function loadAudioModule(): Promise<AudioModule | null> {
  try {
    return require('expo-audio') as AudioModule;
  } catch {
    return null;
  }
}

async function loadHapticsModule(): Promise<HapticsModule | null> {
  try {
    return require('expo-haptics') as HapticsModule;
  } catch {
    return null;
  }
}

async function ensureAlarmAudio(inBackground: boolean) {
  const Audio = await loadAudioModule();
  if (!Audio) return;

  if (inBackground) {
    if (backgroundAudioInitialized) return;
    await Audio.setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true });
    if (!alarmPlayer) {
      alarmPlayer = Audio.createAudioPlayer(require('../../assets/sounds/alarm.wav'));
    }
    backgroundAudioInitialized = true;
    return;
  }
  if (audioInitialized) return;
  await Audio.setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true });
  alarmPlayer = Audio.createAudioPlayer(require('../../assets/sounds/alarm.wav'));
  audioInitialized = true;
  backgroundAudioInitialized = true;
}

const SETTINGS_STORAGE_KEY = 'seacheck.settings.v1';

async function readAlarmPrefs(): Promise<{ sound: boolean; haptic: boolean }> {
  const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!raw) return { sound: true, haptic: true };
  try {
    const parsed = JSON.parse(raw) as { alarmSoundEnabled?: boolean; alarmHapticEnabled?: boolean };
    return {
      sound: parsed.alarmSoundEnabled !== false,
      haptic: parsed.alarmHapticEnabled !== false,
    };
  } catch {
    return { sound: true, haptic: true };
  }
}

async function playAlarmSound(repeat = 1, inBackground = false) {
  const prefs = await readAlarmPrefs();
  if (!prefs.sound) return;
  try {
    await ensureAlarmAudio(inBackground);
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
  const prefs = await readAlarmPrefs();
  if (!prefs.haptic) return;
  try {
    const Haptics = await loadHapticsModule();
    if (!Haptics) return;

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

type AlarmOptions = {
  inBackground?: boolean;
};

/** Maritime alarm: banner + accessibility + optional sound/haptic + notification when backgrounded. */
export async function triggerMaritimeAlarm(severity: AlarmSeverity, message: string, options: AlarmOptions = {}) {
  const inBackground = Boolean(options.inBackground);
  void AccessibilityInfo.announceForAccessibility(message);

  if (inBackground) {
    const [title, ...rest] = message.split(':');
    await showMaritimeAlarmNotification(title.trim(), rest.join(':').trim() || message);
  } else if (severity === 'critical') {
    useFeedbackStore.getState().showError(message);
  } else {
    useFeedbackStore.getState().showInfo(message);
  }

  if (severity === 'critical') {
    await Promise.all([playAlarmSound(2, inBackground), pulseHaptic('critical')]);
  } else {
    await Promise.all([playAlarmSound(1, inBackground), pulseHaptic('warning')]);
  }
}

/** Short haptic for map interactions (waypoint drop, MOB confirm). */
export async function pulseUiAcknowledgement() {
  const prefs = await readAlarmPrefs();
  if (!prefs.haptic) return;
  try {
    const Haptics = await loadHapticsModule();
    if (!Haptics) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    /* ignore */
  }
}
