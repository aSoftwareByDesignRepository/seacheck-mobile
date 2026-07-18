import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { onLayoutHeight } from '../../lib/ui/safeLayout';
import { useFormFactor } from '../../hooks/useFormFactor';
import { useNavigationInstrumentData } from '../../hooks/useNavigationInstrumentData';
import { nextCoordFormat, coordFormatTitleKey } from '../../lib/settings/coordFormats';
import { pulseUiAcknowledgement } from '../../services/alarmFeedbackService';
import { isLowSog, type LocationFix } from '../../services/locationService';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useSettingsStore } from '../../store/settingsStore';
import { t } from '../../i18n';
import { useTheme } from '../../theme/ThemeContext';
import { InstrumentChip } from '../../ui/InstrumentChip';
import { StatusBadgeRow, compactBadgeItems } from '../../ui/StatusBadgeRow';
import { InstrumentCoordsLine } from './InstrumentCoordsLine';
import { InstrumentMetricGrid } from './InstrumentMetricGrid';
import { buildInstrumentDetailMetrics } from './instrumentDetailMetrics';
import { PassageInstrumentBlock } from './PassageInstrumentBlock';

type Props = {
  fix: LocationFix | null;
  onOpenPassage: () => void;
};

/** Full-screen navigation dashboard — instruments-only layout. */
export function MapInstruments({ fix, onOpenPassage }: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const { instrumentFullScreenHeroSize, width } = useFormFactor();
  const coordFormat = useSettingsStore((s) => s.coordFormat);
  const patchSettings = useSettingsStore((s) => s.patchSettings);
  const sogUnit = useSettingsStore((s) => s.sogUnit);
  const showInfo = useFeedbackStore((s) => s.showInfo);

  const viewportRef = useRef(0);
  const contentRef = useRef(0);
  const [scrollEnabled, setScrollEnabled] = useState(false);

  const updateScrollMetrics = useCallback((viewport?: number, content?: number) => {
    if (viewport != null) viewportRef.current = viewport;
    if (content != null) contentRef.current = content;
    const v = viewportRef.current;
    const c = contentRef.current;
    setScrollEnabled(v > 0 && c > v + 1);
  }, []);

  const data = useNavigationInstrumentData(fix);
  const cogParts = data.cogText.split(' ');
  const detailMetrics = buildInstrumentDetailMetrics(data);
  const compactHero = Math.min(instrumentFullScreenHeroSize, Math.round(width * 0.14));

  const badgeItems = compactBadgeItems([
    data.anchorAlarm?.active
      ? {
          key: 'anchor',
          label: data.anchorAlarm.triggered ? t('map.anchorTriggered') : t('map.anchorActive'),
          variant: data.anchorAlarm.triggered ? 'danger' : 'success',
        }
      : null,
    isLowSog(fix) && !data.stale ? { key: 'lowSog', label: t('map.lowSog'), variant: 'warning' } : null,
    data.stale && fix ? { key: 'stale', label: t('map.staleGps'), variant: 'danger' } : null,
  ]);

  async function cycleCoordFormat() {
    const next = nextCoordFormat(coordFormat);
    await patchSettings({ coordFormat: next });
    void pulseUiAcknowledgement();
    showInfo(t('map.coordFormatCycled', { format: t(coordFormatTitleKey(next)) }));
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]} testID="map.instruments">
      <ScrollView
        scrollEnabled={scrollEnabled}
        bounces={scrollEnabled}
        alwaysBounceVertical={false}
        onLayout={onLayoutHeight((height) => updateScrollMetrics(height, undefined))}
        onContentSizeChange={(_, h) => updateScrollMetrics(undefined, h)}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: spacing.xl,
            flexGrow: scrollEnabled ? undefined : 1,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={scrollEnabled}
      >
        <View style={[styles.sections, { gap: spacing.md }]}>
          {badgeItems.length > 0 ? <StatusBadgeRow items={badgeItems} testID="map.instruments.badges" /> : null}

          <PassageInstrumentBlock fix={fix} density="full" onOpenPassage={onOpenPassage} />

          <View style={[styles.primaryGrid, { gap: spacing.sm }]}>
            <View style={[styles.heroRow, { gap: spacing.sm }]}>
              <InstrumentChip
                label={t('map.sog')}
                value={data.sogText}
                unit={sogUnit}
                hero
                heroSize={compactHero}
              />
              <InstrumentChip
                label={data.courseLabel}
                value={cogParts[0] ?? '—'}
                unit={cogParts.length > 1 ? cogParts.slice(1).join(' ') : undefined}
                hero
                heroSize={compactHero}
              />
            </View>
            <InstrumentChip
              label={t('map.accuracy')}
              value={data.accuracyText}
              unit="m"
              hero
              heroSize={Math.round(compactHero * 0.72)}
            />
          </View>

          {data.coordFix ? (
            <InstrumentCoordsLine
              latitude={data.coordFix.latitude}
              longitude={data.coordFix.longitude}
              format={coordFormat}
              stale={data.coordsMuted}
              onCopied={() => showInfo(t('map.coordsCopied'))}
              onCycleFormat={() => void cycleCoordFormat()}
            />
          ) : (
            <View style={[styles.awaiting, { borderColor: colors.border, minHeight: minTouch }]}>
              <Text style={{ color: colors.textMuted, fontWeight: '600', fontSize: 15 }}>{t('map.awaitingGps')}</Text>
            </View>
          )}

          {detailMetrics.length > 0 ? <InstrumentMetricGrid metrics={detailMetrics} layout="grid" /> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  scroll: {},
  sections: { alignSelf: 'stretch', minWidth: 0, width: '100%' },
  primaryGrid: {},
  heroRow: { flexDirection: 'row', alignItems: 'stretch' },
  awaiting: {
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
});
