import type { NavigationInstrumentData } from '../../hooks/useNavigationInstrumentData';
import { t } from '../../i18n';

export type InstrumentDetailMetric = {
  key: string;
  label: string;
  value: string;
  unit?: string;
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

  if (data.leeway) {
    metrics.push({
      key: 'leeway',
      label: t('map.leeway'),
      value: Math.abs(data.leeway.angleDeg).toFixed(0),
      unit:
        data.leeway.side === 'none'
          ? '°'
          : `° ${data.leeway.side === 'port' ? t('map.leewayPort') : t('map.leewayStarboard')}`,
    });
  }

  if (data.anchorDriftText && data.anchorLimitText) {
    metrics.push({
      key: 'drift',
      label: t('map.anchorDrift'),
      value: data.anchorDriftText,
      unit: `/ ${data.anchorLimitText}`,
    });
  }

  if (data.showBarometer && data.barometer.trend.currentHpa != null) {
    metrics.push({
      key: 'baro',
      label: t('barometer.label'),
      value: data.barometer.trend.currentHpa.toFixed(0),
      unit: 'hPa',
    });
  }

  return metrics;
}
