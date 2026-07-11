import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useFormFactor } from '../../hooks/useFormFactor';
import { formatDistanceNm, distanceUnitLabel } from '../../lib/geo/units';
import { confirmReverseActivePassage } from '../../lib/passage/confirmReversePassage';
import { t } from '../../i18n';
import type { PassageStackParamList } from '../../navigation/PassageStack';
import { usePassageStore } from '../../store/passageStore';
import { requestConfirm } from '../../store/confirmStore';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Screen } from '../../ui/Screen';
import { StatusBadge } from '../../ui/StatusBadge';

type Nav = NativeStackNavigationProp<PassageStackParamList, 'PassageList'>;

export function PassageListScreen() {
  const navigation = useNavigation<Nav>();
  const { colors, spacing, minTouch } = useTheme();
  const { formFactor, width } = useFormFactor();
  const listColumns = formFactor !== 'compact' ? 2 : 1;
  const passages = usePassageStore((s) => s.passages);
  const activePassageId = usePassageStore((s) => s.activePassageId);
  const createPassage = usePassageStore((s) => s.createPassage);
  const activatePassage = usePassageStore((s) => s.activatePassage);
  const deletePassage = usePassageStore((s) => s.deletePassage);
  const reversePassageWaypoints = usePassageStore((s) => s.reversePassageWaypoints);
  const getPassageDetail = usePassageStore((s) => s.getPassageDetail);
  const showInfo = useFeedbackStore((s) => s.showInfo);
  const showError = useFeedbackStore((s) => s.showError);
  const distanceUnit = useSettingsStore((s) => s.distanceUnit);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Record<string, { legs: number; nm: number; waypoints: number }>>({});

  useEffect(() => {
    void Promise.all(
      passages.map(async (p) => {
        const d = await getPassageDetail(p.id);
        return { id: p.id, legs: d?.legs.length ?? 0, nm: d?.totalNm ?? 0, waypoints: d?.waypoints.length ?? 0 };
      }),
    ).then((rows) => {
      const map: Record<string, { legs: number; nm: number; waypoints: number }> = {};
      for (const r of rows) map[r.id] = { legs: r.legs, nm: r.nm, waypoints: r.waypoints };
      setSummaries(map);
    });
  }, [passages, getPassageDetail]);

  const openDetail = useCallback(
    (passageId: string) => {
      navigation.navigate('PassageDetail', { passageId });
    },
    [navigation],
  );

  async function handleCreate() {
    const p = await createPassage(t('passage.defaultName'));
    openDetail(p.id);
  }

  async function handleActivate(passageId: string, waypoints: number) {
    if (waypoints < 2) return;
    await activatePassage(passageId);
  }

  async function handleReverse(passageId: string) {
    const meta = summaries[passageId];
    if ((meta?.waypoints ?? 0) < 2) {
      showError(t('passage.reverseNeedTwo'));
      return;
    }
    if (passageId === activePassageId) {
      const ok = await confirmReverseActivePassage();
      if (!ok) return;
    }
    setReversingId(passageId);
    try {
      await reversePassageWaypoints(passageId);
      showInfo(t('passage.reverseSuccess'));
    } catch {
      showError(t('passage.reverseFailed'));
    } finally {
      setReversingId(null);
    }
  }

  async function confirmDelete(passageId: string, name: string) {
    const ok = await requestConfirm({
      title: t('passage.deleteTitle'),
      message: name,
      confirmLabel: t('passage.delete'),
      destructive: true,
    });
    if (!ok) return;
    setDeletingId(passageId);
    try {
      await deletePassage(passageId);
      showInfo(t('passage.deleteSuccess'));
    } catch {
      showError(t('passage.deleteFailed'));
    } finally {
      setDeletingId(null);
    }
  }

  if (passages.length === 0) {
    return (
      <Screen testID="screen.passage" title={t('tabs.passage')} subtitle={t('passage.listSubtitle')}>
        <EmptyState
          testID="passage.empty"
          icon="route"
          title={t('passage.emptyTitle')}
          body={t('passage.emptyBody')}
          actionLabel={t('passage.create')}
          onAction={() => void handleCreate()}
        />
      </Screen>
    );
  }

  return (
    <Screen testID="screen.passage" title={t('tabs.passage')} subtitle={t('passage.listSubtitle')}>
      <Button label={t('passage.create')} onPress={() => void handleCreate()} testID="passage.create" />
      <FlatList
        data={passages}
        key={listColumns}
        numColumns={listColumns}
        keyExtractor={(p) => p.id}
        style={{ marginTop: spacing.lg }}
        contentContainerStyle={{ paddingBottom: spacing.xl, gap: spacing.md }}
        columnWrapperStyle={listColumns > 1 ? styles.gridRow : undefined}
        renderItem={({ item }) => {
          const meta = summaries[item.id];
          const isActive = item.id === activePassageId;
          const canActivate = (meta?.waypoints ?? 0) >= 2;
          const canReverse = canActivate;
          const busy = deletingId === item.id || reversingId === item.id;
          return (
            <Pressable
              onPress={() => openDetail(item.id)}
              accessibilityRole="button"
              accessibilityLabel={item.name}
              accessibilityHint={t('passage.openDetailHint')}
              style={[
                styles.card,
                listColumns > 1 ? [styles.gridCard, { maxWidth: (width - spacing.lg * 2 - 12) / 2 }] : null,
                {
                  backgroundColor: isActive ? colors.successBg : colors.surface,
                  borderColor: isActive ? colors.success : colors.border,
                },
              ]}
              testID={`passage.card.${item.id}`}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
                  {item.name}
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
              <View style={[styles.cardActions, { gap: spacing.sm, marginTop: spacing.sm }]}>
                <View style={[styles.cardActionsPrimary, { gap: spacing.sm }]}>
                  {!isActive && canActivate ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('passage.activate')}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        void handleActivate(item.id, meta?.waypoints ?? 0);
                      }}
                      style={[styles.inlineBtn, { borderColor: colors.primary, minHeight: minTouch }]}
                      testID={`passage.activate.${item.id}`}
                    >
                      <Text style={[styles.inlineBtnText, { color: colors.primary }]}>{t('passage.activate')}</Text>
                    </Pressable>
                  ) : null}
                  <Text style={[styles.openHint, { color: colors.primary }]}>{t('passage.openDetail')}</Text>
                </View>
                <View style={[styles.cardActionsSecondary, { gap: spacing.sm }]}>
                  {canReverse ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('passage.reverse')}
                      accessibilityHint={t('passage.reverseFromListHint')}
                      disabled={busy}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        void handleReverse(item.id);
                      }}
                      style={[
                        styles.inlineBtn,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.surface,
                          minHeight: minTouch,
                          opacity: reversingId === item.id ? 0.6 : 1,
                        },
                      ]}
                      testID={`passage.reverse.${item.id}`}
                    >
                      <Text style={[styles.inlineBtnText, { color: colors.text }]}>
                        {reversingId === item.id ? t('common.loading') : t('passage.reverse')}
                      </Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('passage.delete')}
                  accessibilityHint={t('passage.deleteFromListHint')}
                  disabled={busy}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    void confirmDelete(item.id, item.name);
                  }}
                  style={[
                    styles.inlineBtn,
                    {
                      borderColor: colors.dangerBorder,
                      backgroundColor: colors.dangerBg,
                      minHeight: minTouch,
                      opacity: deletingId === item.id ? 0.6 : 1,
                    },
                  ]}
                  testID={`passage.delete.${item.id}`}
                >
                  <Text style={[styles.inlineBtnText, { color: colors.danger }]}>
                    {deletingId === item.id ? t('common.loading') : t('passage.delete')}
                  </Text>
                </Pressable>
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 16, minHeight: 48 },
  gridRow: { gap: 12 },
  gridCard: { flex: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, fontSize: 18, fontWeight: '700', lineHeight: 24 },
  meta: { fontSize: 14, lineHeight: 20, marginTop: 8 },
  cardActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  cardActionsPrimary: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', flex: 1, minWidth: 0 },
  cardActionsSecondary: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 },
  inlineBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlineBtnText: { fontSize: 14, fontWeight: '800' },
  openHint: { fontSize: 13, fontWeight: '700' },
});
