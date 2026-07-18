import type { NavigationInstrumentData } from '../../hooks/useNavigationInstrumentData';
import { t } from '../../i18n';

export type InstrumentDetailMetric = {
  key: string;
  label: string;
  value: string;
  unit?: string;
  /** Screen reader label — defaults to label + value + unit when omitted. */
  a11yLabel?: string;
};

/** Contextual secondary readouts — passage, anchor, leeway, etc. Session distance is omitted (Tracks screen). */
export function buildInstrumentDetailMetrics(data: NavigationInstrumentData): InstrumentDetailMetric[] {
  const metrics: InstrumentDetailMetric[] = [];

  if (data.showXte && !data.showNavHero) {
    metrics.push({
      key: 'xte',
      label: t('map.xte'),
      value: data.xteDisplay.value,
      unit: data.xteDisplay.unitLabel || undefined,
    });
    if (data.nav.activeLegLabel) {
      metrics.push({ key: 'leg', label: t('map.leg'), value: data.nav.activeLegLabel });
    }
  }

  if (data.showPassageMeta && data.remainingDistText && !data.showNavHero) {
    metrics.push({
      key: 'remaining',
      label: t('map.remainingNm'),
      value: data.remainingDistText,
      unit: data.distanceLabel,
    });
    metrics.push({
      key: 'eta',
      label: t('map.etaDest'),
      value: data.nav.etaDestLocal ?? data.nav.plannedEtaDestLocal ?? '—',
    });
  }

  if (data.showLeeway && data.leeway) {
    const sideLabel =
      data.leeway.side === 'none'
        ? ''
        : data.leeway.side === 'port'
          ? t('map.leewayPort')
          : t('map.leewayStarboard');
    metrics.push({
      key: 'leeway',
      label: t('map.leeway'),
      value: Math.abs(data.leeway.angleDeg).toFixed(0),
      unit: sideLabel ? `° ${sideLabel}` : '°',
      a11yLabel: t('map.leewayA11y', {
        deg: Math.abs(data.leeway.angleDeg).toFixed(0),
        side: sideLabel || t('map.leewayNone'),
      }),
    });
  }

  if (data.anchorDriftText && data.anchorLimitText) {
    metrics.push({
      key: 'drift',
      label: t('map.anchorDrift'),
      value: data.anchorDriftText,
      unit: `/ ${data.anchorLimitText}`,
      a11yLabel: t('map.anchorDriftA11y', {
        drift: data.anchorDriftText,
        limit: data.anchorLimitText,
      }),
    });
  }

  return metrics;
}
