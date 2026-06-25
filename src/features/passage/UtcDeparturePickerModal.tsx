import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

import { t } from '../../i18n';
import { useTheme } from '../../theme/ThemeContext';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';

type Props = {
  visible: boolean;
  utcMs: number | null;
  onClose: () => void;
  onConfirm: (utcMs: number) => void;
};

/** Build a Date whose local components represent UTC wall time (picker displays UTC values). */
function dateFromUtcMs(utcMs: number): Date {
  const d = new Date(utcMs);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), 0, 0);
}

function utcMsFromPickerDate(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), 0, 0);
}

export function UtcDeparturePickerModal({ visible, utcMs, onClose, onConfirm }: Props) {
  const { spacing, minTouch } = useTheme();
  const [draft, setDraft] = useState(() => dateFromUtcMs(utcMs ?? Date.now()));

  useEffect(() => {
    if (visible) setDraft(dateFromUtcMs(utcMs ?? Date.now()));
  }, [visible, utcMs]);

  function handleChange(_event: DateTimePickerEvent, date?: Date) {
    if (date) setDraft(date);
    if (Platform.OS === 'android' && _event.type === 'set' && date) {
      onConfirm(utcMsFromPickerDate(date));
      onClose();
    }
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('passage.departurePickerTitle')}
      subtitle={t('passage.departureUtcHint')}
      testID="passage.departurePicker"
    >
      <DateTimePicker
        value={draft}
        mode="datetime"
        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
        onChange={handleChange}
        accessibilityLabel={t('passage.departurePickerTitle')}
        testID="passage.departurePicker.control"
      />
      {Platform.OS === 'ios' ? (
        <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
          <Button
            label={t('passage.departureSet')}
            onPress={() => {
              onConfirm(utcMsFromPickerDate(draft));
              onClose();
            }}
            testID="passage.departureSet"
          />
          <Button label={t('common.close')} variant="ghost" onPress={onClose} style={{ minHeight: minTouch }} testID="passage.departureCancel" />
        </View>
      ) : (
        <View style={{ marginTop: spacing.lg }}>
          <Button label={t('common.close')} variant="ghost" onPress={onClose} style={{ minHeight: minTouch }} testID="passage.departureCancel" />
        </View>
      )}
    </BottomSheet>
  );
}
