import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { usePackDownloadActions } from '../../hooks/usePackDownloadActions';
import { usePassagePackSuggestions } from '../../hooks/usePassagePackSuggestions';
import { isPackDownloadActive } from '../downloads/packDownloadPresentation';
import { boundsFromWaypoints } from '../../lib/map/passageBounds';
import { isLargeRegionPack } from '../../map/regionPackValidation';
import { t } from '../../i18n';
import type { PassageWithLegs } from '../../store/passageStore';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';
import { StatusBadge } from '../../ui/StatusBadge';
import { PassagePackSuggestionRow } from './PassagePackSuggestionRow';

export type PassageDownloadsNavOptions = {
  focusPackIds?: string[];
  scrollToCustom?: boolean;
  passageBounds?: [number, number, number, number];
  passageName?: string;
};

type Props = {
  detail: PassageWithLegs;
  onOpenDownloads: (opts?: PassageDownloadsNavOptions) => void;
};

function coverageStatusLabel(report: ReturnType<typeof usePassagePackSuggestions>): string {
  if (report.readyPackCount === 0) return t('passage.offlineNoPacks');
  if (report.fullyCovered) return t('passage.offlineReady');
  return t('passage.offlineGaps', { count: report.uncoveredLegCount });
}

function coverageStatusVariant(report: ReturnType<typeof usePassagePackSuggestions>): 'success' | 'warning' | 'danger' {
  if (report.readyPackCount === 0) return 'danger';
  if (report.fullyCovered) return 'success';
  return 'warning';
}

export function PassageCoverageCard({ detail, onOpenDownloads }: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const report = usePassagePackSuggestions(detail.waypoints);
  const { packBusy, handleDownload, handleDownloadAll, handleCancel, activeDownloadRegionId } = usePackDownloadActions();
  const showInfo = useFeedbackStore((s) => s.showInfo);
  const showError = useFeedbackStore((s) => s.showError);
  const [legsExpanded, setLegsExpanded] = useState(false);

  if (detail.waypoints.length < 2) return null;

  const showSuggestions = !report.fullyCovered && report.suggestionDetails.length > 0;
  const showCustomOnly =
    !report.fullyCovered && report.suggestionDetails.length === 0 && report.needsCustomArea;
  const pendingPackIds = report.suggestionDetails
    .filter((s) => s.status.state !== 'ready' && s.status.state !== 'downloading')
    .map((s) => s.packId);
  const anyLargePending = report.suggestionDetails.some(
    (s) => pendingPackIds.includes(s.packId) && isLargeRegionPack(s.pack),
  );
  const passageBounds = boundsFromWaypoints(detail.waypoints);
  const coveredLegCount = report.legs.filter((leg) => leg.covered).length;
  const totalLegCount = report.legs.length;
  const showLegDetails = !report.fullyCovered && totalLegCount > 0;
  const statusLabel = coverageStatusLabel(report);
  const statusVariant = coverageStatusVariant(report);

  async function downloadAllRecommended() {
    const result = await handleDownloadAll(report.focusPackIds);
    if (result.ready > 0) showInfo(t('passage.downloadAllProgress', { count: result.ready }));
    if (result.failed > 0) showError(t('passage.downloadAllPartialFail'));
  }

  function openCustomForPassage() {
    if (!passageBounds) return;
    onOpenDownloads({
      scrollToCustom: true,
      passageBounds,
      passageName: detail.name,
      focusPackIds: report.focusPackIds.length > 0 ? report.focusPackIds : undefined,
    });
  }

  function openDownloadsTab() {
    onOpenDownloads(report.focusPackIds.length > 0 ? { focusPackIds: report.focusPackIds } : undefined);
  }

  const legToggleLabel = legsExpanded ? t('passage.offlineLegStatusCollapse') : t('passage.offlineLegStatusExpand');

  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: spacing.lg }]}
      testID="passage.coverage"
      accessibilityLabel={`${t('passage.offlineCheckTitle')}. ${statusLabel}`}
      accessibilityHint={t('passage.offlineCheckBody')}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          {t('passage.offlineCheckTitle')}
        </Text>
        <StatusBadge label={statusLabel} variant={statusVariant} />
      </View>

      {showSuggestions ? (
        <View style={[styles.block, { borderColor: colors.border }]} accessibilityRole="summary">
          {anyLargePending ? (
            <Text style={[styles.hint, { color: colors.warningText }]}>{t('downloads.largePackHint')}</Text>
          ) : null}
          {report.suggestionDetails.map((suggestion, index) => {
            const downloadActive = isPackDownloadActive(
              suggestion.packId,
              suggestion.status,
              activeDownloadRegionId,
            );
            return (
              <PassagePackSuggestionRow
                key={suggestion.packId}
                suggestion={suggestion}
                activeDownloadRegionId={activeDownloadRegionId}
                busy={packBusy(suggestion.packId)}
                onDownload={() => void handleDownload(suggestion.packId)}
                onCancel={downloadActive ? () => void handleCancel(suggestion.packId) : undefined}
                onBrowsePack={() => onOpenDownloads({ focusPackIds: [suggestion.packId] })}
                showDivider={index > 0}
                suppressActiveProgress
              />
            );
          })}
          <View style={[styles.actionRow, { minHeight: minTouch }]}>
            {pendingPackIds.length > 1 ? (
              <Button
                label={t('passage.downloadAllRecommended', { count: pendingPackIds.length })}
                onPress={() => void downloadAllRecommended()}
                disabled={pendingPackIds.some((id) => packBusy(id))}
                fullWidth={false}
                style={styles.actionBtn}
                testID="passage.downloadAllRecommended"
              />
            ) : null}
            {report.needsCustomArea ? (
              <Button
                label={t('passage.openCustomDownloadShort')}
                variant="secondary"
                onPress={openCustomForPassage}
                fullWidth={false}
                style={styles.actionBtn}
                testID="passage.openCustomDownload"
              />
            ) : null}
            <Button
              label={t('passage.openDownloadsShort')}
              variant="ghost"
              onPress={openDownloadsTab}
              fullWidth={false}
              style={styles.actionBtn}
              testID="passage.openDownloads"
            />
          </View>
        </View>
      ) : null}

      {showCustomOnly ? (
        <View style={[styles.block, { borderColor: colors.border, gap: spacing.sm }]}>
          <Text style={[styles.hint, { color: colors.warningText }]}>{t('passage.offlineNeedsCustomShort')}</Text>
          <View style={[styles.actionRow, { minHeight: minTouch }]}>
            <Button
              label={t('passage.openCustomDownloadShort')}
              variant="secondary"
              onPress={openCustomForPassage}
              fullWidth={false}
              style={styles.actionBtn}
              testID="passage.openCustomDownloadOnly"
            />
            <Button
              label={t('passage.openDownloadsShort')}
              variant="ghost"
              onPress={openDownloadsTab}
              fullWidth={false}
              style={styles.actionBtn}
              testID="passage.openDownloads"
            />
          </View>
        </View>
      ) : null}

      {showLegDetails ? (
        <View style={[styles.block, { borderColor: colors.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: legsExpanded }}
            accessibilityLabel={legToggleLabel}
            accessibilityHint={t('passage.offlineLegStatusSummary', {
              covered: coveredLegCount,
              total: totalLegCount,
              gaps: report.uncoveredLegCount,
            })}
            onPress={() => setLegsExpanded((value) => !value)}
            testID="passage.legStatus.toggle"
            style={({ pressed }) => [
              styles.legToggle,
              { minHeight: minTouch, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <View style={styles.legToggleText}>
              <Text style={[styles.legSummary, { color: colors.text }]}>
                {t('passage.offlineLegStatusSummary', {
                  covered: coveredLegCount,
                  total: totalLegCount,
                  gaps: report.uncoveredLegCount,
                })}
              </Text>
              <Text style={[styles.legToggleHint, { color: colors.textMuted }]}>{legToggleLabel}</Text>
            </View>
            <MaterialIcons
              name={legsExpanded ? 'expand-less' : 'expand-more'}
              size={22}
              color={colors.textMuted}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
          </Pressable>
          {legsExpanded
            ? report.legs.map((leg, index) => (
                <View
                  key={leg.legIndex}
                  style={[
                    styles.legRow,
                    index > 0 ? [styles.legRowDivider, { borderTopColor: colors.border }] : null,
                  ]}
                >
                  <View style={styles.legMain}>
                    <Text style={[styles.legTitle, { color: colors.text }]}>
                      {leg.fromName} → {leg.toName}
                    </Text>
                    {leg.covered && leg.coveringPackLabels.length ? (
                      <Text style={[styles.legMeta, { color: colors.textMuted }]} numberOfLines={1}>
                        {t('passage.offlineCoveredBy', { packs: leg.coveringPackLabels.join(', ') })}
                      </Text>
                    ) : null}
                  </View>
                  <StatusBadge
                    label={leg.covered ? t('passage.offlineLegOk') : t('passage.offlineLegGap')}
                    variant={leg.covered ? 'success' : 'warning'}
                  />
                </View>
              ))
            : null}
        </View>
      ) : null}

      {!report.fullyCovered && !showSuggestions && !showCustomOnly ? (
        <Button
          label={t('passage.openDownloadsShort')}
          variant="ghost"
          onPress={openDownloadsTab}
          testID="passage.openDownloads"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { fontSize: 16, fontWeight: '800', flex: 1, lineHeight: 22 },
  block: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 8 },
  hint: { fontSize: 13, lineHeight: 18 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  actionBtn: { flexGrow: 1, flexBasis: '48%', minWidth: 120 },
  legToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legToggleText: { flex: 1, gap: 2 },
  legSummary: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  legToggleHint: { fontSize: 13, lineHeight: 18 },
  legRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  legRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 2 },
  legMain: { flex: 1, minWidth: 0 },
  legTitle: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  legMeta: { fontSize: 12, lineHeight: 16, marginTop: 2 },
});
