import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { formatDistanceNm, distanceUnitLabel } from '../../lib/geo/units';
import { stopPassageMapPlanning, unlockActivePassageRouteEdits } from '../../lib/passage/passageMapPlanning';
import { t } from '../../i18n';
import type { RootTabParamList } from '../../navigation/types';
import { requestConfirm } from '../../store/confirmStore';
import { useFeedbackStore } from '../../store/feedbackStore';
import { usePassageMapPlanningStore } from '../../store/passageMapPlanningStore';
import { usePassageStore, type PassageWithLegs } from '../../store/passageStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';
import { MapBottomPanelFrame } from '../map/MapBottomPanelFrame';
import { PASSAGE_PLANNING_PANEL_CONTENT_MAX } from '../map/mapChromeLayout';

/**
 * Passage planning bar on the map — flush on the tab bar.
 */
export function PassageMapPlanningPanel() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const { colors, spacing, minTouch } = useTheme();
  const passageId = usePassageMapPlanningStore((s) => s.passageId);
  const planningRevision = usePassageMapPlanningStore((s) => s.revision);
  const allowRouteEdits = usePassageMapPlanningStore((s) => s.allowRouteEdits);
  const passages = usePassageStore((s) => s.passages);
  const activePassageId = usePassageStore((s) => s.activePassageId);
  const routeRevision = usePassageStore((s) => s.routeRevision);
  const getPassageDetail = usePassageStore((s) => s.getPassageDetail);
  const deletePassage = usePassageStore((s) => s.deletePassage);
  const activatePassage = usePassageStore((s) => s.activatePassage);
  const distanceUnit = useSettingsStore((s) => s.distanceUnit);
  const showError = useFeedbackStore((s) => s.showError);
  const [detail, setDetail] = useState<PassageWithLegs | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!passageId) {
      setDetail(null);
      return;
    }
    setDetail(await getPassageDetail(passageId));
  }, [passageId, getPassageDetail]);

  useEffect(() => {
    void refresh();
  }, [refresh, passages, planningRevision, routeRevision]);

  if (!passageId) return null;

  const passage = passages.find((p) => p.id === passageId);
  const wpCount = detail?.waypoints.length ?? 0;
  const isActivePassage = passageId === activePassageId;
  const canActivate = wpCount >= 2 && !isActivePassage;
  const readOnlyPlanning = isActivePassage && !allowRouteEdits;
  const unitLabel = distanceUnitLabel(distanceUnit);
  const totalNm = detail?.totalNm ?? 0;
  const metaA11y = t('passage.mapPlanningMeta', {
    count: wpCount,
    distance: formatDistanceNm(totalNm, distanceUnit),
    unit: unitLabel,
  });

  const stepHint =
    wpCount === 0
      ? t('passage.mapPlanningEmpty')
      : wpCount === 1
        ? t('passage.mapPlanningNeedSecond')
        : t('passage.mapPlanningTapHint');

  const hintText = readOnlyPlanning
    ? t('passage.mapPlanningViewHint')
    : isActivePassage && allowRouteEdits
      ? t('passage.mapPlanningActiveEditHint')
      : stepHint;

  function handleOpenPassageScreen() {
    if (passageId) {
      navigation.navigate('Passage', { screen: 'PassageDetail', params: { passageId } });
      return;
    }
    navigation.navigate('Passage');
  }

  async function handleDone() {
    stopPassageMapPlanning();
    if (passageId) {
      navigation.navigate('Passage', { screen: 'PassageDetail', params: { passageId } });
      return;
    }
    navigation.navigate('Passage');
  }

  async function handleStopPlanning() {
    if (wpCount === 0) {
      const ok = await requestConfirm({
        title: t('passage.mapPlanningDiscardTitle'),
        message: t('passage.mapPlanningDiscardEmpty'),
        confirmLabel: t('passage.mapPlanningDiscardConfirm'),
        destructive: true,
      });
      if (!ok) return;
      try {
        await deletePassage(passageId!);
      } catch {
        showError(t('passage.deleteFailed'));
        return;
      }
    }
    stopPassageMapPlanning();
  }

  async function handleActivate() {
    if (!canActivate) {
      showError(t('passage.needTwoWaypoints'));
      return;
    }
    setBusy(true);
    try {
      await activatePassage(passageId!);
      stopPassageMapPlanning();
    } catch {
      showError(t('passage.activateFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlockRouteEdits() {
    await unlockActivePassageRouteEdits();
  }

  return (
    <MapBottomPanelFrame
      maxContentHeight={PASSAGE_PLANNING_PANEL_CONTENT_MAX}
      accentTop
      testID="passage.mapPlanning.panel"
    >
      <View style={styles.headerText}>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header" numberOfLines={1}>
          {passage?.name ?? t('passage.defaultName')}
        </Text>
        <Text
          style={[styles.meta, { color: colors.textMuted }]}
          accessibilityLiveRegion="polite"
          accessibilityLabel={metaA11y}
          numberOfLines={1}
        >
          {metaA11y}
        </Text>
      </View>

      <Text style={[styles.hint, { color: colors.textMuted }]} numberOfLines={3}>
        {hintText}
      </Text>

      {readOnlyPlanning ? (
        <Button
          label={t('passage.mapPlanningUnlock')}
          variant="secondary"
          onPress={() => void handleUnlockRouteEdits()}
          testID="passage.mapPlanning.unlock"
          style={{ minHeight: minTouch }}
        />
      ) : null}

      <View style={styles.primaryRow}>
        {wpCount === 0 ? (
          <Button
            label={t('passage.mapPlanningStop')}
            variant="secondary"
            onPress={() => void handleStopPlanning()}
            testID="passage.mapPlanning.stop"
            fullWidth={false}
            style={styles.actionBtn}
          />
        ) : (
          <Button
            label={t('passage.mapPlanningDone')}
            onPress={() => void handleDone()}
            testID="passage.mapPlanning.done"
            fullWidth={false}
            style={styles.actionBtn}
          />
        )}
        {canActivate ? (
          <Button
            label={t('passage.activate')}
            variant="secondary"
            onPress={() => void handleActivate()}
            loading={busy}
            testID="passage.mapPlanning.activate"
            fullWidth={false}
            style={styles.actionBtn}
          />
        ) : null}
      </View>

      <Button
        label={t('passage.manageOnPassageScreen')}
        variant="ghost"
        onPress={handleOpenPassageScreen}
        accessibilityHint={t('passage.manageOnPassageScreenHint')}
        testID="passage.mapPlanning.openPassage"
        style={{ minHeight: minTouch, marginBottom: spacing.xs }}
      />
    </MapBottomPanelFrame>
  );
}

const styles = StyleSheet.create({
  headerText: { gap: 2 },
  title: { fontSize: 17, fontWeight: '800', lineHeight: 22 },
  meta: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'], lineHeight: 20 },
  hint: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  primaryRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  actionBtn: { flex: 1, flexBasis: 0, minWidth: 0 },
});
