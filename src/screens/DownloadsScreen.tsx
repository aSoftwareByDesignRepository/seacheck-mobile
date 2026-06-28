import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { useFormFactor } from '../hooks/useFormFactor';
import { usePackDownloadActions } from '../hooks/usePackDownloadActions';
import { stopPassageMapPlanning, isPassageMapPlanningActive } from '../lib/passage/passageMapPlanning';
import { REGION_PACKS, resolveRegionPack, type RegionPackDefinition } from '../map/regionPacks';
import { t } from '../i18n';
import type { RootTabParamList } from '../navigation/types';
import { requestConfirm } from '../store/confirmStore';
import { useCustomDownloadStore } from '../store/customDownloadStore';
import { useFeedbackStore } from '../store/feedbackStore';
import { useOfflinePackStore } from '../store/offlinePackStore';
import { useSettingsStore } from '../store/settingsStore';
import { useTheme } from '../theme/ThemeContext';
import { CustomDownloadSection } from '../features/downloads/CustomDownloadSection';
import { CustomPackCard } from '../features/downloads/CustomPackCard';
import { LegacyPackCard } from '../features/downloads/LegacyPackCard';
import { RegionPackCard } from '../features/downloads/RegionPackCard';
import { RegionPackMapPreview } from '../features/downloads/RegionPackMapPreview';
import { MasterDetailLayout } from '../features/responsive/MasterDetailLayout';
import { Card, Screen } from '../ui/Screen';
import { Button } from '../ui/Button';
import { SectionHeader } from '../ui/SectionHeader';
import { ToggleRow } from '../ui/ToggleRow';

const PRIORITY_ORDER = ['P0', 'P1', 'P2'] as const;

type DownloadsRoute = RouteProp<RootTabParamList, 'Downloads'>;

function packsByPriority(priority: RegionPackDefinition['priority']) {
  return REGION_PACKS.filter((p) => p.priority === priority);
}

function PackPreviewPanel({ pack }: { pack: RegionPackDefinition }) {
  const { colors } = useTheme();

  return (
    <View testID="downloads.previewPanel">
      <SectionHeader title={t('downloads.previewTitle')} />
      <Text style={[styles.previewName, { color: colors.text }]} accessibilityRole="header">
        {t(pack.nameKey as 'downloads.packs.kielBay.name')}
      </Text>
      <Text style={[styles.previewBody, { color: colors.textMuted }]}>
        {t(pack.descriptionKey as 'downloads.packs.kielBay.description')}
      </Text>
      <RegionPackMapPreview pack={pack} />
    </View>
  );
}

export function DownloadsScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const { colors, minTouch } = useTheme();
  const { formFactor } = useFormFactor();
  const route = useRoute<DownloadsRoute>();
  const focusPackIds = route.params?.focusPackIds ?? [];
  const scrollToCustom = route.params?.scrollToCustom ?? false;
  const passageBounds = route.params?.passageBounds;
  const passageName = route.params?.passageName;
  const focusSet = useMemo(() => new Set(focusPackIds), [focusPackIds]);
  const scrollRef = useRef<ScrollView>(null);
  const customSectionY = useRef(0);
  const regions = useOfflinePackStore((s) => s.regions);
  const hydrated = useOfflinePackStore((s) => s.hydrated);
  const chartStyleUri = useOfflinePackStore((s) => s.chartStyleUri);
  const deleteRegion = useOfflinePackStore((s) => s.deleteRegion);
  const retryPendingSeamarkIndexing = useOfflinePackStore((s) => s.retryPendingSeamarkIndexing);
  const ensureChartStyle = useOfflinePackStore((s) => s.ensureChartStyle);
  const downloadWifiOnly = useSettingsStore((s) => s.downloadWifiOnly);
  const patchSettings = useSettingsStore((s) => s.patchSettings);
  const showInfo = useFeedbackStore((s) => s.showInfo);
  const { packBusy, handleDownload, handleCancel, setActionBusyId, downloadLocksOtherPacks, actionBusyId } =
    usePackDownloadActions();
  const [selectedPackId, setSelectedPackId] = useState<string | null>(REGION_PACKS[0]?.id ?? null);

  const recommendedPacks = useMemo(
    () => focusPackIds.map((id) => REGION_PACKS.find((p) => p.id === id)).filter((p): p is RegionPackDefinition => p != null),
    [focusPackIds],
  );

  useEffect(() => {
    void retryPendingSeamarkIndexing();
  }, [retryPendingSeamarkIndexing]);

  useEffect(() => {
    if (!hydrated) return;
    if (chartStyleUri) return;
    void ensureChartStyle().catch((error) => {
      console.warn('[DownloadsScreen] chart style unavailable', error);
    });
  }, [hydrated, chartStyleUri, ensureChartStyle]);

  useEffect(() => {
    if (focusPackIds.length === 0) return;
    setSelectedPackId(focusPackIds[0] ?? null);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [focusPackIds]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (route.params?.focusPackIds?.length || route.params?.scrollToCustom) {
          navigation.setParams({ focusPackIds: undefined, scrollToCustom: undefined, passageBounds: undefined, passageName: undefined });
        }
      };
    }, [navigation, route.params?.focusPackIds, route.params?.scrollToCustom]),
  );

  const customPacks = useMemo(
    () => Object.values(regions).filter((r) => r.custom),
    [regions],
  );

  const legacyPacks = useMemo(
    () => Object.values(regions).filter((r) => r.legacy && (r.state === 'ready' || r.state === 'error')),
    [regions],
  );

  const selectedPack = REGION_PACKS.find((p) => p.id === selectedPackId) ?? null;

  function selectPack(packId: string) {
    setSelectedPackId(packId);
    if (formFactor === 'compact') {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
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

  function renderRegionPackCard(pack: RegionPackDefinition, recommended = false) {
    return (
      <RegionPackCard
        key={pack.id}
        pack={pack}
        status={regions[pack.id] ?? { regionId: pack.id, state: 'idle', percentage: 0, packId: null, error: null }}
        onDownload={() => void handleDownload(pack.id).then((ok) => {
          if (ok) selectPack(pack.id);
        })}
        onDelete={() => void confirmDelete(pack.id, t(pack.nameKey as 'downloads.packs.kielBay.name'))}
        onCancel={regions[pack.id]?.state === 'downloading' ? () => void handleCancel(pack.id) : undefined}
        busy={packBusy(pack.id)}
        onSelect={() => selectPack(pack.id)}
        selected={selectedPackId === pack.id}
        recommended={recommended}
      />
    );
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
      {!hydrated ? (
        <View style={[styles.loadingRow, { minHeight: minTouch }]} accessibilityLabel={t('common.loading')}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ color: colors.textMuted }}>{t('common.loading')}</Text>
        </View>
      ) : null}
      {recommendedPacks.length > 0 ? (
        <View testID="downloads.passageRecommended">
          <SectionHeader title={t('downloads.passageRecommendedTitle')} description={t('downloads.passageRecommendedBody')} />
          {recommendedPacks.map((pack) => renderRegionPackCard(pack, true))}
        </View>
      ) : null}
      {PRIORITY_ORDER.map((priority) => {
        const packs = packsByPriority(priority).filter((p) => !focusSet.has(p.id));
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
            {packs.map((pack) => renderRegionPackCard(pack))}
          </View>
        );
      })}
      {legacyPacks.length > 0 ? (
        <>
          <SectionHeader title={t('downloads.legacyTitle')} description={t('downloads.legacyBody')} />
          {legacyPacks.map((pack) => (
            <LegacyPackCard
              key={pack.regionId}
              status={pack}
              onDelete={() =>
                void confirmDelete(
                  pack.regionId,
                  resolveRegionPack(pack.regionId)
                    ? t(resolveRegionPack(pack.regionId)!.nameKey as 'downloads.packs.kielBay.name')
                    : pack.displayName ?? pack.regionId,
                )
              }
              busy={packBusy(pack.regionId)}
            />
          ))}
        </>
      ) : null}
      {passageBounds && passageName ? (
        <Card style={{ marginBottom: 8, gap: 10 }}>
          <View testID="downloads.passageCustomBanner">
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }} accessibilityRole="header">
            {t('downloads.passageCustomTitle')}
          </Text>
          <Text style={{ color: colors.textMuted, lineHeight: 20 }}>{t('downloads.passageCustomBody', { name: passageName })}</Text>
          <Button
            label={t('downloads.passageCustomOpenMap')}
            variant="secondary"
            onPress={() => {
              if (isPassageMapPlanningActive()) {
                showInfo(t('passage.mapPlanningPaused'));
              }
              stopPassageMapPlanning();
              useCustomDownloadStore.getState().prefillFromBounds(
                passageBounds,
                t('downloads.passageCustomDefaultName', { name: passageName }),
              );
              navigation.navigate('Map');
            }}
            testID="downloads.passageCustomOpenMap"
          />
          </View>
        </Card>
      ) : null}
      <View
        onLayout={(e) => {
          customSectionY.current = e.nativeEvent.layout.y;
          if (scrollToCustom) {
            scrollRef.current?.scrollTo({ y: e.nativeEvent.layout.y, animated: true });
          }
        }}
      >
        <CustomDownloadSection
          downloadLocked={downloadLocksOtherPacks || !hydrated}
          actionBusyId={actionBusyId}
          onActionBusyChange={setActionBusyId}
        />
      </View>
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

  const detailPane = selectedPack ? <PackPreviewPanel pack={selectedPack} /> : null;

  return (
    <Screen testID="screen.downloads" title={t('downloads.title')} subtitle={t('downloads.subtitle')} scrollRef={scrollRef}>
      {formFactor === 'compact' && selectedPack ? (
        <Card>
          <PackPreviewPanel pack={selectedPack} />
        </Card>
      ) : null}
      <MasterDetailLayout master={listPane} detail={formFactor === 'compact' ? null : detailPane} requireDetail={formFactor !== 'compact'} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  previewName: { fontWeight: '700', marginBottom: 4, fontSize: 16 },
  previewBody: { marginBottom: 8, lineHeight: 20, fontSize: 14 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
});
