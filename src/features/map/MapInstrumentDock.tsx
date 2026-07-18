import { StyleSheet, Text, View } from 'react-native';

import { useFormFactor } from '../../hooks/useFormFactor';
import { useNavigationInstrumentData } from '../../hooks/useNavigationInstrumentData';
import { nextCoordFormat, coordFormatTitleKey } from '../../lib/settings/coordFormats';
import { pulseUiAcknowledgement } from '../../services/alarmFeedbackService';
import type { LocationFix } from '../../services/locationService';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useSettingsStore } from '../../store/settingsStore';
import { t } from '../../i18n';
import { useTheme } from '../../theme/ThemeContext';
import { InstrumentChip } from '../../ui/InstrumentChip';
import { StatusBadgeRow, compactBadgeItems } from '../../ui/StatusBadgeRow';
import { InstrumentCoordsLine } from './InstrumentCoordsLine';
import { InstrumentDockFrame } from './InstrumentDockFrame';
import { InstrumentMetricGrid } from './InstrumentMetricGrid';
import { buildInstrumentDetailMetrics } from './instrumentDetailMetrics';
import { PassageInstrumentBlock } from './PassageInstrumentBlock';

type Props = {
  fix: LocationFix | null;
  onOpenPassage: () => void;
  /** Side panel in split tablet layout — scrollable, wraps chips for narrow width. */
  embedded?: boolean;
};

/** Map-forward bottom dock — primary readouts use full width; safety actions on map edge. */
export function MapInstrumentDock({ fix, onOpenPassage, embedded = false }: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const { instrumentHeroSize } = useFormFactor();
  const coordFormat = useSettingsStore((s) => s.coordFormat);
  const patchSettings = useSettingsStore((s) => s.patchSettings);
  const sogUnit = useSettingsStore((s) => s.sogUnit);
  const showInfo = useFeedbackStore((s) => s.showInfo);

  const data = useNavigationInstrumentData(fix);
  const cogParts = data.cogText.split(' ');
  const detailMetrics = buildInstrumentDetailMetrics(data);

  async function cycleCoordFormat() {
    const next = nextCoordFormat(coordFormat);
    await patchSettings({ coordFormat: next });
    void pulseUiAcknowledgement();
    showInfo(t('map.coordFormatCycled', { format: t(coordFormatTitleKey(next)) }));
  }

  const badgeItems = compactBadgeItems([
    data.anchorAlarm?.active
      ? {
          key: 'anchor',
          label: data.anchorAlarm.triggered ? t('map.anchorTriggered') : t('map.anchorActive'),
          variant: data.anchorAlarm.triggered ? 'danger' : 'success',
        }
      : null,
    data.stale && fix ? { key: 'stale', label: t('map.staleGps'), variant: 'danger' } : null,
  ]);

  return (
    <InstrumentDockFrame testID="map.instrumentDock" mode={embedded ? 'embedded' : 'overlay'}>
      <PassageInstrumentBlock fix={fix} density="dock" onOpenPassage={onOpenPassage} />

      <View style={[styles.section, { gap: spacing.sm }]}>
        <View style={[styles.heroRow, { gap: spacing.sm, flexWrap: embedded ? 'wrap' : 'nowrap' }]}>
          <InstrumentChip label={t('map.sog')} value={data.sogText} unit={sogUnit} hero heroSize={instrumentHeroSize} flex={embedded ? undefined : 1} />
          <InstrumentChip
            label={data.courseLabel}
            value={cogParts[0] ?? '—'}
            unit={cogParts.length > 1 ? cogParts.slice(1).join(' ') : undefined}
            hero
            heroSize={instrumentHeroSize}
            flex={embedded ? undefined : 1}
          />
          <InstrumentChip label={t('map.accuracy')} value={data.accuracyText} unit="m" flex={embedded ? undefined : 1} />
        </View>
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
          <Text style={{ color: colors.textMuted, fontWeight: '600' }}>{t('map.awaitingGps')}</Text>
        </View>
      )}

      {badgeItems.length > 0 ? <StatusBadgeRow items={badgeItems} testID="map.instrumentDock.badges" /> : null}

      {detailMetrics.length > 0 ? (
        <InstrumentMetricGrid
          metrics={detailMetrics}
          layout={embedded ? 'grid' : 'row'}
          gridColumns={embedded ? 2 : undefined}
        />
      ) : null}
    </InstrumentDockFrame>
  );
}

const styles = StyleSheet.create({
  section: {},
  heroRow: { flexDirection: 'row', alignItems: 'stretch' },
  awaiting: {
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
});
