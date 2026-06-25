import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { ensureDownloadAllowed } from '../lib/network/downloadPolicy';
import { useFormFactor } from '../hooks/useFormFactor';
import { REGION_PACKS, type RegionPackDefinition } from '../map/regionPacks';
import { t } from '../i18n';
import { requestConfirm } from '../store/confirmStore';
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
  const activeDownloadRegionId = useOfflinePackStore((s) => s.activeDownloadRegionId);
  const startDownload = useOfflinePackStore((s) => s.startDownload);
  const retryDownload = useOfflinePackStore((s) => s.retryDownload);
  const cancelDownload = useOfflinePackStore((s) => s.cancelDownload);
  const deleteRegion = useOfflinePackStore((s) => s.deleteRegion);
  const retryPendingSeamarkIndexing = useOfflinePackStore((s) => s.retryPendingSeamarkIndexing);
  const downloadWifiOnly = useSettingsStore((s) => s.downloadWifiOnly);
  const patchSettings = useSettingsStore((s) => s.patchSettings);
  const showInfo = useFeedbackStore((s) => s.showInfo);
  const showError = useFeedbackStore((s) => s.showError);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(REGION_PACKS[0]?.id ?? null);

  const downloadLocksOtherPacks = activeDownloadRegionId != null;

  useEffect(() => {
    void retryPendingSeamarkIndexing();
  }, [retryPendingSeamarkIndexing]);

  const customPacks = useMemo(
    () => Object.values(regions).filter((r) => r.custom),
    [regions],
  );

  const selectedPack = REGION_PACKS.find((p) => p.id === selectedPackId) ?? null;

  async function handleDownload(regionId: string) {
    if (activeDownloadRegionId != null && activeDownloadRegionId !== regionId) {
      showError(t('downloads.errorDownloadBusy'));
      return;
    }
    const allowed = await ensureDownloadAllowed();
    if (!allowed) {
      showInfo(t('downloads.cellularCancelledBody'));
      return;
    }
    setActionBusyId(regionId);
    try {
      const status = regions[regionId];
      if (status?.custom || status?.state === 'error') {
        await retryDownload(regionId);
      } else {
        await startDownload(regionId);
      }
      const next = useOfflinePackStore.getState().regions[regionId];
      if (next?.state === 'ready') {
        showInfo(t('downloads.downloadSuccess'));
      } else if (next?.state === 'error') {
        showError(next.error ?? t('downloads.downloadFailed'));
      }
      if (!status?.custom) setSelectedPackId(regionId);
    } catch (err) {
      const next = useOfflinePackStore.getState().regions[regionId];
      showError(next?.error ?? (err instanceof Error ? err.message : t('downloads.downloadFailed')));
    } finally {
      const stillDownloading = useOfflinePackStore.getState().regions[regionId]?.state === 'downloading';
      if (!stillDownloading) setActionBusyId(null);
    }
  }

  async function handleCancel(regionId: string) {
    setActionBusyId(regionId);
    try {
      await cancelDownload(regionId);
      showInfo(t('downloads.downloadCancelled'));
    } finally {
      setActionBusyId(null);
    }
  }

  async function confirmDelete(regionId: string, name: string) {
    const ok = await requestConfirm({
      title: t('downloads.deleteConfirmTitle'),
      message: t('downloads.deleteConfirmBody', { name }),
      confirmLabel: t('downloads.delete'),
      destructive: true,
    });
    if (!ok) return;
    setActionBusyId(regionId);
    try {
      await deleteRegion(regionId);
      showInfo(t('downloads.deleteSuccess'));
    } finally {
      setActionBusyId(null);
    }
  }

  function packBusy(packId: string) {
    if (activeDownloadRegionId === packId) return false;
    return downloadLocksOtherPacks || (actionBusyId != null && actionBusyId !== packId);
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
                onDelete={() =>
                  void confirmDelete(pack.id, t(pack.nameKey as 'downloads.packs.kielBay.name'))
                }
                onCancel={regions[pack.id]?.state === 'downloading' ? () => void handleCancel(pack.id) : undefined}
                busy={packBusy(pack.id)}
                onSelect={() => setSelectedPackId(pack.id)}
                selected={selectedPackId === pack.id}
              />
            ))}
          </View>
        );
      })}
      <CustomDownloadSection
        downloadLocked={downloadLocksOtherPacks}
        actionBusyId={actionBusyId}
        onActionBusyChange={setActionBusyId}
      />
      {customPacks.length > 0 ? (
        <>
          <SectionHeader title={t('downloads.customSavedTitle')} />
          {customPacks.map((pack) => (
            <CustomPackCard
              key={pack.regionId}
              status={pack}
              onDownload={() => void handleDownload(pack.regionId)}
              onDelete={() => void confirmDelete(pack.regionId, pack.displayName ?? pack.regionId)}
              onCancel={pack.state === 'downloading' ? () => void handleCancel(pack.regionId) : undefined}
              busy={packBusy(pack.regionId)}
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
