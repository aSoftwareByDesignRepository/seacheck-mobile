import { useMemo, useState } from 'react';
import { Text } from 'react-native';

import { REGION_PACKS } from '../map/regionPacks';
import { t } from '../i18n';
import { useOfflinePackStore } from '../store/offlinePackStore';
import { useTheme } from '../theme/ThemeContext';
import { CustomDownloadSection } from '../features/downloads/CustomDownloadSection';
import { CustomPackCard } from '../features/downloads/CustomPackCard';
import { RegionPackCard } from '../features/downloads/RegionPackCard';
import { Card, Screen } from '../ui/Screen';
import { SectionHeader } from '../ui/SectionHeader';

export function DownloadsScreen() {
  const { colors, minTouch } = useTheme();
  const regions = useOfflinePackStore((s) => s.regions);
  const startDownload = useOfflinePackStore((s) => s.startDownload);
  const deleteRegion = useOfflinePackStore((s) => s.deleteRegion);
  const [busyId, setBusyId] = useState<string | null>(null);

  const customPacks = useMemo(
    () => Object.values(regions).filter((r) => r.custom),
    [regions],
  );

  async function handleDownload(regionId: string) {
    setBusyId(regionId);
    try {
      await startDownload(regionId);
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

  const p0 = REGION_PACKS.filter((p) => p.priority === 'P0');

  return (
    <Screen testID="screen.downloads" title={t('downloads.title')} subtitle={t('downloads.subtitle')}>
      <Card style={{ minHeight: minTouch }}>
        <Text style={{ color: colors.textMuted, lineHeight: 20 }}>{t('downloads.wifiNote')}</Text>
      </Card>

      <SectionHeader title={t('downloads.regionPacksTitle')} />
      {p0.map((pack) => (
        <RegionPackCard
          key={pack.id}
          pack={pack}
          status={regions[pack.id] ?? { regionId: pack.id, state: 'idle', percentage: 0, packId: null, error: null }}
          onDownload={() => void handleDownload(pack.id)}
          onDelete={() => void handleDelete(pack.id)}
          busy={busyId != null && busyId !== pack.id}
        />
      ))}

      <CustomDownloadSection />

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
    </Screen>
  );
}
