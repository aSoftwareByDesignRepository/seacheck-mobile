import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PassageRouteSummary } from './PassageRouteSummary';
import { t } from '../../i18n';
import type { PassageWithLegs } from '../../store/passageStore';
import { useTheme } from '../../theme/ThemeContext';
import { FieldInput } from '../../ui/Screen';

type Props = {
  detail: PassageWithLegs;
  onNameChange: (name: string) => void;
  onDefaultSogChange: (sogKn: number) => void;
};

export function PassageMetaSection({
  detail,
  onNameChange,
  onDefaultSogChange,
}: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const [name, setName] = useState(detail.name);
  const [defaultSog, setDefaultSog] = useState(String(detail.default_sog_kn));
  const nameDirty = name.trim() !== detail.name && name.trim().length > 0;

  useEffect(() => {
    setName(detail.name);
    setDefaultSog(String(detail.default_sog_kn));
  }, [detail.id, detail.name, detail.default_sog_kn]);

  function saveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === detail.name) return;
    onNameChange(trimmed);
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="passage.meta">
      <Text style={[styles.label, { color: colors.textMuted }]}>{t('passage.nameLabel')}</Text>
      <FieldInput
        value={name}
        onChangeText={setName}
        onEndEditing={saveName}
        accessibilityLabel={t('passage.nameLabel')}
        placeholder={t('passage.defaultName')}
      />
      {nameDirty ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('passage.saveName')}
          onPress={saveName}
          style={[styles.saveBtn, { backgroundColor: colors.primary, minHeight: minTouch }]}
          testID="passage.saveName"
        >
          <Text style={[styles.saveBtnText, { color: colors.primaryText }]}>{t('passage.saveName')}</Text>
        </Pressable>
      ) : (
        <Text style={[styles.hint, { color: colors.textMuted }]}>{t('passage.nameHint')}</Text>
      )}

      <PassageRouteSummary detail={detail} />

      <Text style={[styles.label, { color: colors.textMuted, marginTop: spacing.md }]}>{t('passage.defaultSogLabel')}</Text>
      <FieldInput
        value={defaultSog}
        onChangeText={setDefaultSog}
        onEndEditing={() => {
          const parsed = Number.parseFloat(defaultSog.replace(',', '.'));
          if (Number.isFinite(parsed) && parsed > 0) onDefaultSogChange(parsed);
          else setDefaultSog(String(detail.default_sog_kn));
        }}
        accessibilityLabel={t('passage.defaultSogLabel')}
        keyboardType="number-pad"
        placeholder={t('passage.defaultSogPlaceholder')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 6, minHeight: 48 },
  label: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  hint: { fontSize: 13, lineHeight: 18 },
  saveBtn: { borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginTop: 4 },
  saveBtnText: { fontSize: 14, fontWeight: '800' },
});
