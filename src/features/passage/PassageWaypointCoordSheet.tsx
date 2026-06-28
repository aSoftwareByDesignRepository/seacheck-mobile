import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { parseCoordField } from '../../lib/map/coordInput';
import { t } from '../../i18n';
import type { WaypointRow } from '../../lib/db/database';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';
import { BottomSheet } from '../../ui/BottomSheet';
import { FieldInput, FieldLabel } from '../../ui/Screen';

type Props = {
  visible: boolean;
  mode: 'add' | 'edit';
  waypoint?: WaypointRow;
  onClose: () => void;
  onSubmit: (input: { name: string; latitude: number; longitude: number }) => Promise<void>;
};

export function PassageWaypointCoordSheet({ visible, mode, waypoint, onClose, onSubmit }: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [latDraft, setLatDraft] = useState('');
  const [lonDraft, setLonDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setError(null);
    if (mode === 'edit' && waypoint) {
      setName(waypoint.name);
      setLatDraft(String(waypoint.latitude));
      setLonDraft(String(waypoint.longitude));
    } else {
      setName('');
      setLatDraft('');
      setLonDraft('');
    }
  }, [visible, mode, waypoint?.id, waypoint?.latitude, waypoint?.longitude, waypoint?.name]);

  async function handleSave() {
    const latitude = parseCoordField(latDraft);
    const longitude = parseCoordField(lonDraft);
    if (latitude == null || longitude == null) {
      setError(t('passage.coordsInvalid'));
      return;
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      setError(t('passage.coordsOutOfRange'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim() || (mode === 'edit' && waypoint ? waypoint.name : t('waypoints.defaultName')),
        latitude,
        longitude,
      });
      onClose();
    } catch {
      setError(t('passage.coordsSaveFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={mode === 'add' ? t('passage.addByCoordsTitle') : t('passage.editWaypointTitle')}
      subtitle={t('passage.coordsHint')}
      testID="passage.waypointCoordSheet"
    >
      <View style={[styles.body, { paddingBottom: Math.max(insets.bottom, spacing.sm), gap: spacing.sm }]}>
        <FieldLabel>{t('passage.waypointNameLabel')}</FieldLabel>
        <FieldInput
          value={name}
          onChangeText={setName}
          accessibilityLabel={t('passage.waypointNameLabel')}
        />
        <FieldLabel>{t('passage.latitudeLabel')}</FieldLabel>
        <FieldInput
          value={latDraft}
          onChangeText={setLatDraft}
          keyboardType="number-pad"
          accessibilityLabel={t('passage.latitudeLabel')}
        />
        <FieldLabel>{t('passage.longitudeLabel')}</FieldLabel>
        <FieldInput
          value={lonDraft}
          onChangeText={setLonDraft}
          keyboardType="number-pad"
          accessibilityLabel={t('passage.longitudeLabel')}
        />
        {error ? (
          <Text style={[styles.error, { color: colors.danger }]} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <Button
            label={mode === 'add' ? t('passage.addWaypointConfirm') : t('common.save')}
            onPress={() => void handleSave()}
            loading={busy}
            testID="passage.waypointCoord.save"
            style={{ minHeight: minTouch }}
          />
          <Button label={t('common.dismiss')} variant="secondary" onPress={onClose} testID="passage.waypointCoord.cancel" style={{ minHeight: minTouch }} />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: 8 },
  error: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  actions: { gap: 10, marginTop: 8 },
});
