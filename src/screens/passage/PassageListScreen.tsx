import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';

import { PassageListCard } from '../../features/passage/PassageListCard';
import { usePassageDeactivate } from '../../hooks/usePassageDeactivate';
import { resolvePassageListColumns } from '../../lib/responsive/splitLayout';
import { useFormFactor } from '../../hooks/useFormFactor';
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

type Nav = NativeStackNavigationProp<PassageStackParamList, 'PassageList'>;

export function PassageListScreen() {
  const navigation = useNavigation<Nav>();
  const { spacing } = useTheme();
  const { formFactor, isLandscape } = useFormFactor();
  const listColumns = resolvePassageListColumns(formFactor, isLandscape);
  const passages = usePassageStore((s) => s.passages);
  const activePassageId = usePassageStore((s) => s.activePassageId);
  const routeRevision = usePassageStore((s) => s.routeRevision);
  const createPassage = usePassageStore((s) => s.createPassage);
  const activatePassage = usePassageStore((s) => s.activatePassage);
  const deletePassage = usePassageStore((s) => s.deletePassage);
  const reversePassageWaypoints = usePassageStore((s) => s.reversePassageWaypoints);
  const getPassageDetail = usePassageStore((s) => s.getPassageDetail);
  const { deactivate, deactivating } = usePassageDeactivate();
  const showInfo = useFeedbackStore((s) => s.showInfo);
  const showError = useFeedbackStore((s) => s.showError);
  const distanceUnit = useSettingsStore((s) => s.distanceUnit);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Record<string, { legs: number; nm: number; waypoints: number }>>({});

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      passages.map(async (p) => {
        const d = await getPassageDetail(p.id);
        return { id: p.id, legs: d?.legs.length ?? 0, nm: d?.totalNm ?? 0, waypoints: d?.waypoints.length ?? 0 };
      }),
    ).then((rows) => {
      if (cancelled) return;
      const map: Record<string, { legs: number; nm: number; waypoints: number }> = {};
      for (const r of rows) map[r.id] = { legs: r.legs, nm: r.nm, waypoints: r.waypoints };
      setSummaries(map);
    });
    return () => {
      cancelled = true;
    };
  }, [passages, getPassageDetail, routeRevision]);

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

  async function handleActivate(passageId: string) {
    if (activatingId || deactivating || deletingId || reversingId) return;
    setActivatingId(passageId);
    try {
      await activatePassage(passageId);
      showInfo(t('passage.activated'));
    } catch {
      showError(t('passage.activateFailed'));
    } finally {
      setActivatingId(null);
    }
  }

  async function handleDeactivate(passageId: string) {
    if (activatingId || deactivating || deletingId || reversingId) return;
    if (passageId !== activePassageId) return;
    await deactivate();
  }

  async function handleReverse(passageId: string) {
    if (activatingId || deactivating || deletingId || reversingId) return;
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
    if (activatingId || deactivating || deletingId || reversingId) return;
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

  const listBusy = activatingId != null || deactivating || deletingId != null || reversingId != null;

  return (
    <Screen testID="screen.passage" title={t('tabs.passage')} subtitle={t('passage.listSubtitle')} scroll={false}>
      <FlatList
        data={passages}
        key={`passage-list-${listColumns}`}
        numColumns={listColumns}
        keyExtractor={(p) => p.id}
        style={styles.list}
        contentContainerStyle={{ paddingBottom: spacing.xl, gap: spacing.md }}
        columnWrapperStyle={listColumns > 1 ? [styles.gridRow, { gap: spacing.md }] : undefined}
        ListHeaderComponent={
          <Button
            label={t('passage.create')}
            onPress={() => void handleCreate()}
            testID="passage.create"
            style={{ marginBottom: spacing.lg }}
          />
        }
        renderItem={({ item }) => {
          const meta = summaries[item.id];
          const isActive = item.id === activePassageId;
          const busy = listBusy;
          return (
            <PassageListCard
              passage={item}
              meta={meta}
              isActive={isActive}
              distanceUnit={distanceUnit}
              busy={busy}
              activating={activatingId === item.id}
              deactivating={deactivating && isActive}
              reversing={reversingId === item.id}
              deleting={deletingId === item.id}
              style={listColumns > 1 ? styles.gridCard : undefined}
              onOpen={() => openDetail(item.id)}
              onActivate={() => void handleActivate(item.id)}
              onDeactivate={() => void handleDeactivate(item.id)}
              onReverse={() => void handleReverse(item.id)}
              onDelete={() => void confirmDelete(item.id, item.name)}
            />
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, alignSelf: 'stretch', minHeight: 0 },
  gridRow: { alignItems: 'flex-start' },
  gridCard: { flex: 1, minWidth: 0 },
});
