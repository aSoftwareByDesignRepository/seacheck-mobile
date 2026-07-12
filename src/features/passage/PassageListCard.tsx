import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { formatDistanceNm, distanceUnitLabel } from '../../lib/geo/units';
import { t } from '../../i18n';
import type { PassageRow } from '../../lib/db/database';
import type { DistanceUnit } from '../../settings/defaults';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';
import { StatusBadge } from '../../ui/StatusBadge';
import { radius, typography } from '../../theme/tokens';

export type PassageListCardMeta = {
  legs: number;
  nm: number;
  waypoints: number;
};

type Props = {
  passage: PassageRow;
  meta: PassageListCardMeta | undefined;
  isActive: boolean;
  distanceUnit: DistanceUnit;
  busy: boolean;
  activating: boolean;
  deactivating: boolean;
  reversing: boolean;
  deleting: boolean;
  style?: StyleProp<ViewStyle>;
  onOpen: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
  onReverse: () => void;
  onDelete: () => void;
};

export function PassageListCard({
  passage,
  meta,
  isActive,
  distanceUnit,
  busy,
  activating,
  deactivating,
  reversing,
  deleting,
  style,
  onOpen,
  onActivate,
  onDeactivate,
  onReverse,
  onDelete,
}: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const canRoute = (meta?.waypoints ?? 0) >= 2;
  const primaryBusy = activating || deactivating;

  const a11yState = [
    passage.name,
    isActive ? t('passage.active') : null,
    meta
      ? t('passage.listMeta', {
          legs: meta.legs,
          distance: formatDistanceNm(meta.nm, distanceUnit),
          unit: distanceUnitLabel(distanceUnit),
        })
      : null,
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isActive ? colors.successBg : colors.surface,
          borderColor: isActive ? colors.success : colors.border,
        },
        isActive ? styles.cardActive : null,
        style,
      ]}
      testID={`passage.card.${passage.id}`}
    >
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={a11yState}
        accessibilityHint={t('passage.openDetailHint')}
        style={({ pressed }) => [
          styles.body,
          { opacity: pressed ? 0.92 : 1 },
        ]}
        testID={`passage.card.open.${passage.id}`}
      >
        <View style={styles.header}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
            {passage.name}
          </Text>
          {isActive ? <StatusBadge label={t('passage.active')} variant="success" /> : null}
        </View>
        {meta ? (
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {t('passage.listMeta', {
              legs: meta.legs,
              distance: formatDistanceNm(meta.nm, distanceUnit),
              unit: distanceUnitLabel(distanceUnit),
            })}
          </Text>
        ) : null}
        <Text style={[styles.tapHint, { color: colors.textMuted }]}>{t('passage.tapToEdit')}</Text>
      </Pressable>

      <View style={[styles.actions, { gap: spacing.sm, padding: spacing.md, paddingTop: 0 }]}>
        {isActive ? (
          <Button
            label={t('passage.deactivate')}
            variant="secondary"
            loading={deactivating}
            disabled={busy && !deactivating}
            accessibilityHint={t('passage.deactivateFromListHint')}
            onPress={onDeactivate}
            testID={`passage.deactivate.${passage.id}`}
          />
        ) : canRoute ? (
          <Button
            label={t('passage.activate')}
            loading={activating}
            disabled={busy && !activating}
            accessibilityHint={t('passage.activateFromListHint')}
            onPress={onActivate}
            testID={`passage.activate.${passage.id}`}
          />
        ) : (
          <View
            style={[
              styles.needTwoBox,
              {
                borderColor: colors.border,
                backgroundColor: colors.background,
                minHeight: minTouch,
              },
            ]}
            accessibilityRole="text"
            accessibilityLabel={t('passage.activateNeedTwo')}
          >
            <Text style={[styles.needTwoText, { color: colors.textMuted }]}>{t('passage.activateNeedTwo')}</Text>
          </View>
        )}

        <View style={[styles.secondaryRow, { gap: spacing.sm }]}>
          {canRoute ? (
            <Button
              label={reversing ? t('common.loading') : t('passage.reverseShort')}
              variant="secondary"
              fullWidth={false}
              loading={reversing}
              disabled={busy && !reversing}
              accessibilityLabel={t('passage.reverse')}
              accessibilityHint={t('passage.reverseFromListHint')}
              onPress={onReverse}
              style={styles.secondaryBtn}
              testID={`passage.reverse.${passage.id}`}
            />
          ) : null}
          <Button
            label={deleting ? t('common.loading') : t('passage.delete')}
            variant="danger"
            fullWidth={false}
            loading={deleting}
            disabled={busy && !deleting}
            accessibilityHint={t('passage.deleteFromListHint')}
            onPress={onDelete}
            style={canRoute ? styles.secondaryBtn : styles.secondaryBtnSolo}
            testID={`passage.delete.${passage.id}`}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  cardActive: {
    borderWidth: 2,
  },
  body: {
    padding: 16,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  meta: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  tapHint: {
    ...typography.caption,
    marginTop: 2,
  },
  actions: { width: '100%' },
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  secondaryBtn: {
    flex: 1,
    minWidth: 0,
  },
  secondaryBtnSolo: {
    alignSelf: 'stretch',
  },
  needTwoBox: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  needTwoText: {
    ...typography.caption,
    textAlign: 'center',
  },
});
