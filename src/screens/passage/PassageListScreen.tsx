import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useFormFactor } from '../../hooks/useFormFactor';
import { formatDistanceNm, distanceUnitLabel } from '../../lib/geo/units';
import { t } from '../../i18n';
import type { PassageStackParamList } from '../../navigation/PassageStack';
import { usePassageStore } from '../../store/passageStore';
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
  const getPassageDetail = usePassageStore((s) => s.getPassageDetail);
  const distanceUnit = useSettingsStore((s) => s.distanceUnit);
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
  cardActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' },
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
