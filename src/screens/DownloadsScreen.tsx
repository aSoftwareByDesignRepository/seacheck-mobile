import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { ensureDownloadAllowed } from '../lib/network/downloadPolicy';
import { useFormFactor } from '../hooks/useFormFactor';
import { REGION_PACKS, type RegionPackDefinition } from '../map/regionPacks';
import { t } from '../i18n';
import { useFeedbackStore } from '../store/feedbackStore';
import { useOfflinePackStore } from '../store/offlinePackStore';
import { useSettingsStore } from '../store/settingsStore';
import { useTheme } from '../theme/ThemeContext';
import { CustomDownloadSection } from '../features/downloads/CustomDownloadSection';
import { CustomPackCard } from '../features/downloads/CustomPackCard';
import { RegionPackCard } from '../features/downloads/RegionPackCard';
import { RegionPackMapPreview } from '../features/downloads/RegionPackMapPreview';
import { MasterDetailLayout } from '../features/responsive/MasterDetailLayout';
import { Card, Screen } from '../ui/Screen';
import { SectionHeader } from '../ui/SectionHeader';
import { ToggleRow } from '../ui/ToggleRow';

const PRIORITY_ORDER = ['P0', 'P1', 'P2'] as const;

function packsByPriority(priority: RegionPackDefinition['priority']) {
  return REGION_PACKS.filter((p) => p.priority === priority);
}

export function DownloadsScreen() {
  const { colors, minTouch } = useTheme();
  const { formFactor } = useFormFactor();
  const regions = useOfflinePackStore((s) => s.regions);
  const startDownload = useOfflinePackStore((s) => s.startDownload);
  const deleteRegion = useOfflinePackStore((s) => s.deleteRegion);
  const downloadWifiOnly = useSettingsStore((s) => s.downloadWifiOnly);
  const patchSettings = useSettingsStore((s) => s.patchSettings);
  const showInfo = useFeedbackStore((s) => s.showInfo);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(REGION_PACKS[0]?.id ?? null);

  const customPacks = useMemo(
    () => Object.values(regions).filter((r) => r.custom),
    [regions],
  );

  const selectedPack = REGION_PACKS.find((p) => p.id === selectedPackId) ?? null;

  async function handleDownload(regionId: string) {
    const allowed = await ensureDownloadAllowed();
    if (!allowed) {
      showInfo(t('downloads.cellularCancelledBody'));
      return;
    }
    setBusyId(regionId);
    try {
      await startDownload(regionId);
      setSelectedPackId(regionId);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(regionId: string) {
    setBusyId(regionId);
    try {
      await deleteRegion(regionId);
    } finally {
      setBusyId(null);
    }
  }

  const listPane = (
    <View>
      <Card style={{ minHeight: minTouch, marginBottom: 8, gap: 8 }}>
        <Text style={{ color: colors.textMuted, lineHeight: 20 }}>{t('downloads.wifiNote')}</Text>
        <ToggleRow
          label={t('downloads.wifiOnly')}
          hint={t('downloads.wifiOnlyHint')}
          value={downloadWifiOnly}
          onChange={(v) => void patchSettings({ downloadWifiOnly: v })}
          testID="downloads.wifiOnly"
          colors={colors}
          minTouch={minTouch}
        />
      </Card>
      {PRIORITY_ORDER.map((priority) => {
        const packs = packsByPriority(priority);
        if (packs.length === 0) return null;
        const titleKey =
          priority === 'P0'
            ? 'downloads.regionPacksTitle'
            : priority === 'P1'
              ? 'downloads.regionPacksP1'
              : 'downloads.regionPacksP2';
        return (
          <View key={priority}>
            <SectionHeader title={t(titleKey)} />
            {packs.map((pack) => (
              <RegionPackCard
                key={pack.id}
                pack={pack}
                status={regions[pack.id] ?? { regionId: pack.id, state: 'idle', percentage: 0, packId: null, error: null }}
                onDownload={() => void handleDownload(pack.id)}
                onDelete={() => void handleDelete(pack.id)}
                busy={busyId != null && busyId !== pack.id}
                onSelect={() => setSelectedPackId(pack.id)}
                selected={selectedPackId === pack.id}
              />
            ))}
          </View>
        );
      })}
      <CustomDownloadSection busyId={busyId} onBusyChange={setBusyId} />
      {customPacks.length > 0 ? (
        <>
          <SectionHeader title={t('downloads.customSavedTitle')} />
          {customPacks.map((pack) => (
            <CustomPackCard
              key={pack.regionId}
              status={pack}
              onDelete={() => void handleDelete(pack.regionId)}
              busy={busyId != null && busyId !== pack.regionId}
            />
          ))}
        </>
      ) : null}
    </View>
  );

  const detailPane = selectedPack ? (
    <View>
      <SectionHeader title={t('downloads.previewTitle')} />
      <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 4 }}>{t(selectedPack.nameKey as 'downloads.packs.kielBay.name')}</Text>
      <Text style={{ color: colors.textMuted, marginBottom: 8, lineHeight: 20 }}>{t(selectedPack.descriptionKey as 'downloads.packs.kielBay.description')}</Text>
      <RegionPackMapPreview pack={selectedPack} />
    </View>
  ) : null;

  return (
    <Screen testID="screen.downloads" title={t('downloads.title')} subtitle={t('downloads.subtitle')}>
      {formFactor === 'compact' && selectedPack ? (
        <Card>
          <SectionHeader title={t('downloads.previewTitle')} />
          <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 4 }}>{t(selectedPack.nameKey as 'downloads.packs.kielBay.name')}</Text>
          <Text style={{ color: colors.textMuted, marginBottom: 8, lineHeight: 20 }}>{t(selectedPack.descriptionKey as 'downloads.packs.kielBay.description')}</Text>
          <RegionPackMapPreview pack={selectedPack} />
        </Card>
      ) : null}
      <MasterDetailLayout master={listPane} detail={formFactor === 'compact' ? null : detailPane} requireDetail={formFactor !== 'compact'} />
    </Screen>
  );
}
