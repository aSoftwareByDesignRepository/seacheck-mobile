import { StyleSheet, Text, View } from 'react-native';

import { t } from '../../i18n';
import { RACING_PACK_V11 } from '../../lib/featureFlags';
import { useNavigationStore } from '../../store/navigationStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';
import { ButtonStack } from '../../ui/Screen';
import { FilterChip } from '../../ui/FilterChip';

const WIND_PRESETS = [
  { deg: 0, key: 'N' },
  { deg: 45, key: 'NE' },
  { deg: 90, key: 'E' },
  { deg: 135, key: 'SE' },
  { deg: 180, key: 'S' },
  { deg: 225, key: 'SW' },
  { deg: 270, key: 'W' },
  { deg: 315, key: 'NW' },
] as const;

const TACK_PRESETS = [42, 45, 50] as const;
const TARGET_SOG_PRESETS = [4, 5, 6, 7] as const;
const COUNTDOWN_PRESETS_MIN = [5, 3, 1] as const;

type Props = {
  /** Render inside Settings card — skips outer margin. */
  embedded?: boolean;
};

export function RacePackSection({ embedded = false }: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const patchSettings = useSettingsStore((s) => s.patchSettings);
  const wind = useSettingsStore((s) => s.raceWindDirectionTrue);
  const tacking = useSettingsStore((s) => s.raceTackingAngleDeg);
  const showLaylines = useSettingsStore((s) => s.raceShowLaylines);
  const targetSog = useSettingsStore((s) => s.raceTargetSogKn);
  const raceStartAtMs = useNavigationStore((s) => s.raceStartAtMs);
  const setRaceStartAt = useNavigationStore((s) => s.setRaceStartAt);

  if (!RACING_PACK_V11) return null;

  return (
    <View style={embedded ? { minHeight: minTouch } : { marginTop: spacing.lg, minHeight: minTouch }} testID="race.pack">
      <Text style={[styles.groupLabel, { color: colors.textMuted }]}>{t('race.windTitle')}</Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>{t('race.windBody')}</Text>
      <View style={styles.chipRow}>
        {WIND_PRESETS.map((p) => (
          <FilterChip
            key={p.key}
            label={p.key}
            selected={wind === p.deg}
            onPress={() => void patchSettings({ raceWindDirectionTrue: p.deg })}
            testID={`race.wind.${p.key}`}
          />
        ))}
        <FilterChip label={t('race.windClear')} selected={wind == null} onPress={() => void patchSettings({ raceWindDirectionTrue: null })} testID="race.wind.clear" />
      </View>

      <Text style={[styles.groupLabel, { color: colors.textMuted, marginTop: spacing.md }]}>{t('race.tackingTitle')}</Text>
      <View style={styles.chipRow}>
        {TACK_PRESETS.map((deg) => (
          <FilterChip
            key={deg}
            label={`${deg}°`}
            selected={tacking === deg}
            onPress={() => void patchSettings({ raceTackingAngleDeg: deg })}
            testID={`race.tack.${deg}`}
          />
        ))}
      </View>

      <FilterChip
        label={t('race.laylinesToggle')}
        selected={showLaylines}
        onPress={() => void patchSettings({ raceShowLaylines: !showLaylines })}
        testID="race.laylines.toggle"
      />

      <Text style={[styles.groupLabel, { color: colors.textMuted, marginTop: spacing.md }]}>{t('race.targetSogTitle')}</Text>
      <View style={styles.chipRow}>
        {TARGET_SOG_PRESETS.map((kn) => (
          <FilterChip
            key={kn}
            label={`${kn} kn`}
            selected={targetSog === kn}
            onPress={() => void patchSettings({ raceTargetSogKn: kn })}
            testID={`race.target.${kn}`}
          />
        ))}
        <FilterChip label={t('race.targetClear')} selected={targetSog == null} onPress={() => void patchSettings({ raceTargetSogKn: null })} testID="race.target.clear" />
      </View>

      <Text style={[styles.groupLabel, { color: colors.textMuted, marginTop: spacing.lg }]}>{t('race.countdownTitle')}</Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>{t('race.countdownBody')}</Text>
      <ButtonStack>
        {COUNTDOWN_PRESETS_MIN.map((min) => (
          <Button
            key={min}
            label={t('race.countdownPreset', { min })}
            variant="secondary"
            onPress={() => void setRaceStartAt(Date.now() + min * 60_000)}
            testID={`race.countdown.preset.${min}`}
          />
        ))}
        <Button label={t('race.countdownSync')} variant="secondary" onPress={() => void setRaceStartAt(Date.now())} testID="race.countdown.sync" />
        <Button label={t('race.countdownClear')} variant="secondary" onPress={() => void setRaceStartAt(null)} testID="race.countdown.clearSheet" />
      </ButtonStack>
    </View>
  );
}

const styles = StyleSheet.create({
  groupLabel: { fontSize: 13, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  body: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
