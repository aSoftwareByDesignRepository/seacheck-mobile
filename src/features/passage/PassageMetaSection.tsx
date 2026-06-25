import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { UtcDeparturePickerModal } from './UtcDeparturePickerModal';
import { t } from '../../i18n';
import type { PassageWithLegs } from '../../store/passageStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';
import { FieldInput } from '../../ui/Screen';

type Props = {
  detail: PassageWithLegs;
  onNameChange: (name: string) => void;
  onDefaultSogChange: (sogKn: number) => void;
  onDepartureChange: (utcMs: number | null) => void;
  onDepartureNow: () => void;
  onClearDeparture: () => void;
};

export function PassageMetaSection({
  detail,
  onNameChange,
  onDefaultSogChange,
  onDepartureChange,
  onDepartureNow,
  onClearDeparture,
}: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const [name, setName] = useState(detail.name);
  const [defaultSog, setDefaultSog] = useState(String(detail.default_sog_kn));
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    setName(detail.name);
    setDefaultSog(String(detail.default_sog_kn));
  }, [detail.id, detail.name, detail.default_sog_kn]);

  const departureLabel =
    detail.planned_departure != null
      ? new Date(detail.planned_departure).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
      : t('passage.departureUnset');

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: spacing.lg, minHeight: minTouch }]} testID="passage.meta">
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
        {t('passage.metaTitle')}
      </Text>
      <Text style={[styles.label, { color: colors.textMuted }]}>{t('passage.nameLabel')}</Text>
      <FieldInput
        value={name}
        onChangeText={setName}
        onEndEditing={() => {
          if (name.trim() && name.trim() !== detail.name) onNameChange(name.trim());
        }}
        accessibilityLabel={t('passage.nameLabel')}
        placeholder={t('passage.defaultName')}
      />
      <Text style={[styles.label, { color: colors.textMuted, marginTop: spacing.sm }]}>{t('passage.defaultSogLabel')}</Text>
      <FieldInput
        value={defaultSog}
        onChangeText={setDefaultSog}
        onEndEditing={() => {
          const parsed = Number.parseFloat(defaultSog.replace(',', '.'));
          if (Number.isFinite(parsed)) onDefaultSogChange(parsed);
        }}
        accessibilityLabel={t('passage.defaultSogLabel')}
        keyboardType="number-pad"
        placeholder={t('passage.defaultSogPlaceholder')}
      />
      <Text style={[styles.label, { color: colors.textMuted, marginTop: spacing.sm }]}>{t('passage.departureLabel')}</Text>
      <Text style={[styles.departure, { color: colors.text }]} accessibilityLiveRegion="polite">
        {departureLabel}
      </Text>
      <View style={[styles.row, { marginTop: spacing.sm }]}>
        <Button label={t('passage.departurePick')} variant="secondary" onPress={() => setPickerOpen(true)} testID="passage.departurePick" />
        <Button label={t('passage.departureNow')} variant="secondary" onPress={onDepartureNow} testID="passage.departureNow" />
        <Button label={t('passage.departureClear')} variant="secondary" onPress={onClearDeparture} testID="passage.departureClear" />
      </View>
      <Text style={[styles.hint, { color: colors.textMuted }]}>{t('passage.departureHint')}</Text>

      <UtcDeparturePickerModal
        visible={pickerOpen}
        utcMs={detail.planned_departure}
        onClose={() => setPickerOpen(false)}
        onConfirm={(ms) => onDepartureChange(ms)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 6 },
  title: { fontSize: 17, fontWeight: '800', marginBottom: 4 },
  label: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  departure: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { fontSize: 13, lineHeight: 18, marginTop: 4 },
});
