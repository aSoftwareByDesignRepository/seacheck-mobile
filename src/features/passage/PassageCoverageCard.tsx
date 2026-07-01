import { StyleSheet, Text, View } from 'react-native';

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
import { ButtonStack } from '../../ui/Screen';
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

export function PassageCoverageCard({ detail, onOpenDownloads }: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const report = usePassagePackSuggestions(detail.waypoints);
  const { packBusy, handleDownload, handleDownloadAll, handleCancel, activeDownloadRegionId } = usePackDownloadActions();
  const showInfo = useFeedbackStore((s) => s.showInfo);
  const showError = useFeedbackStore((s) => s.showError);

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

  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: spacing.lg }]}
      testID="passage.coverage"
    >
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
        {t('passage.offlineCheckTitle')}
      </Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>{t('passage.offlineCheckBody')}</Text>

      {report.readyPackCount === 0 ? (
        <StatusBadge label={t('passage.offlineNoPacks')} variant="danger" />
      ) : report.fullyCovered ? (
        <StatusBadge label={t('passage.offlineReady')} variant="success" />
      ) : (
        <StatusBadge label={t('passage.offlineGaps', { count: report.uncoveredLegCount })} variant="warning" />
      )}

      {showSuggestions ? (
        <View style={[styles.section, { borderColor: colors.border }]} accessibilityRole="summary">
          <Text style={[styles.sectionTitle, { color: colors.text }]} accessibilityRole="header">
            {t('passage.recommendedPacksTitle')}
          </Text>
          <Text style={[styles.sectionBody, { color: colors.textMuted }]}>{t('passage.recommendedPacksBody')}</Text>
          {anyLargePending ? (
            <Text style={[styles.hint, { color: colors.warningText }]}>{t('downloads.largePackHint')}</Text>
          ) : null}
          <View style={styles.suggestionList}>
            {report.suggestionDetails.map((suggestion) => {
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
              />
            );
            })}
          </View>
          {pendingPackIds.length > 1 ? (
            <Button
              label={t('passage.downloadAllRecommended', { count: pendingPackIds.length })}
              onPress={() => void downloadAllRecommended()}
              disabled={pendingPackIds.some((id) => packBusy(id))}
              testID="passage.downloadAllRecommended"
            />
          ) : null}
          {report.needsCustomArea && report.uncoveredLegCountAfterSuggestions > 0 ? (
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              {t('passage.remainingLegsAfterPacks', { count: report.uncoveredLegCountAfterSuggestions })}
            </Text>
          ) : null}
          {report.needsCustomArea ? (
            <>
              <Text style={[styles.hint, { color: colors.textMuted }]}>{t('passage.recommendedPacksCustomHint')}</Text>
              <Button
                label={t('passage.openCustomDownload')}
                variant="secondary"
                onPress={openCustomForPassage}
                testID="passage.openCustomDownload"
              />
            </>
          ) : null}
        </View>
      ) : null}

      {showCustomOnly ? (
        <>
          <Text style={[styles.hint, { color: colors.warningText }]}>{t('passage.offlineNeedsCustom')}</Text>
          <Button
            label={t('passage.openCustomDownload')}
            variant="secondary"
            onPress={openCustomForPassage}
            testID="passage.openCustomDownloadOnly"
          />
        </>
      ) : null}

      <View style={[styles.legSection, { borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]} accessibilityRole="header">
          {t('passage.offlineLegStatusTitle')}
        </Text>
        {report.legs.map((leg) => (
          <View key={leg.legIndex} style={[styles.legRow, { borderColor: colors.border, minHeight: minTouch }]}>
            <View style={styles.legMain}>
              <Text style={[styles.legTitle, { color: colors.text }]}>
                {leg.fromName} → {leg.toName}
              </Text>
              {leg.covered && leg.coveringPackLabels.length ? (
                <Text style={[styles.legMeta, { color: colors.textMuted }]} numberOfLines={2}>
                  {t('passage.offlineCoveredBy', { packs: leg.coveringPackLabels.join(', ') })}
                </Text>
              ) : null}
            </View>
            <StatusBadge
              label={leg.covered ? t('passage.offlineLegOk') : t('passage.offlineLegGap')}
              variant={leg.covered ? 'success' : 'warning'}
            />
          </View>
        ))}
      </View>

      {!report.fullyCovered ? (
        <ButtonStack>
          <Button
            label={t('passage.openDownloads')}
            variant="secondary"
            onPress={() =>
              onOpenDownloads(report.focusPackIds.length > 0 ? { focusPackIds: report.focusPackIds } : undefined)
            }
            testID="passage.openDownloads"
          />
        </ButtonStack>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  title: { fontSize: 17, fontWeight: '800' },
  body: { fontSize: 14, lineHeight: 20 },
  section: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 10 },
  legSection: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  sectionBody: { fontSize: 14, lineHeight: 20 },
  hint: { fontSize: 13, lineHeight: 18 },
  suggestionList: { gap: 10 },
  legRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  legMain: { flex: 1 },
  legTitle: { fontSize: 15, fontWeight: '600' },
  legMeta: { fontSize: 13, marginTop: 4, lineHeight: 18 },
});
