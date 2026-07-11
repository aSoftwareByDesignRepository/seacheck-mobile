import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { CollapsibleDownloadsSection } from '../features/downloads/CollapsibleDownloadsSection';
import { OfflineChartsGuide } from '../features/downloads/OfflineChartsGuide';
import { CustomDownloadSection } from '../features/downloads/CustomDownloadSection';
import { CustomPackCard } from '../features/downloads/CustomPackCard';
import { DownloadsSectionCard } from '../features/downloads/DownloadsSectionCard';
import { DownloadsStatusBanner } from '../features/downloads/DownloadsStatusBanner';
import { LegacyPackCard } from '../features/downloads/LegacyPackCard';
import { RegionPackCard } from '../features/downloads/RegionPackCard';
import { RegionPackMapPreview } from '../features/downloads/RegionPackMapPreview';
import { corridorGroupNeedsAttention, countNonIdlePacks } from '../features/downloads/downloadsLayoutHelpers';
import { downloadsStyles } from '../features/downloads/downloadsStyles';
import { isPackDownloadActive } from '../features/downloads/packDownloadPresentation';
import { useFormFactor } from '../hooks/useFormFactor';
import { usePackDownloadActions } from '../hooks/usePackDownloadActions';
import { t } from '../i18n';
import { REGION_PACKS, resolveRegionPack, type RegionPackDefinition } from '../map/regionPacks';
import type { RootTabParamList } from '../navigation/types';
import { requestConfirm } from '../store/confirmStore';
import { useFeedbackStore } from '../store/feedbackStore';
import { useOfflinePackStore } from '../store/offlinePackStore';
import { useSettingsStore } from '../store/settingsStore';
import { useTheme } from '../theme/ThemeContext';
import { MasterDetailLayout } from '../features/responsive/MasterDetailLayout';
import { Screen } from '../ui/Screen';
import { SectionHeader } from '../ui/SectionHeader';
import { ToggleRow } from '../ui/ToggleRow';

const PRIORITY_ORDER = ['P0', 'P1', 'P2'] as const;
const TEST_PACK_ID = 'kiel-bay';

type DownloadsRoute = RouteProp<RootTabParamList, 'Downloads'>;

function packsByPriority(priority: RegionPackDefinition['priority']) {
  return REGION_PACKS.filter((p) => p.priority === priority);
}

function PackPreviewPanel({ pack, showHeader = true }: { pack: RegionPackDefinition; showHeader?: boolean }) {
  const { colors, spacing } = useTheme();

  return (
    <View testID="downloads.previewPanel" style={{ gap: spacing.sm }}>
      {showHeader ? <SectionHeader title={t('downloads.previewTitle')} first /> : null}
      <Text style={[downloadsStyles.previewName, { color: colors.text }]} accessibilityRole="header">
        {t(pack.nameKey as 'downloads.packs.kielBay.name')}
      </Text>
      <Text style={[downloadsStyles.previewBody, { color: colors.textMuted }]}>
        {t(pack.descriptionKey as 'downloads.packs.kielBay.description')}
      </Text>
      <RegionPackMapPreview pack={pack} />
    </View>
  );
}

function PackGroupList({
  packs,
  focusSet,
  recommended = false,
  regions,
  activeDownloadRegionId,
  selectedPackId,
  suppressActiveProgress,
  onSelect,
  onDownload,
  onDelete,
  onCancel,
  packBusy,
}: {
  packs: RegionPackDefinition[];
  focusSet: Set<string>;
  recommended?: boolean;
  regions: ReturnType<typeof useOfflinePackStore.getState>['regions'];
  activeDownloadRegionId: string | null;
  selectedPackId: string | null;
  suppressActiveProgress: boolean;
  onSelect: (packId: string) => void;
  onDownload: (packId: string) => void;
  onDelete: (packId: string, name: string) => void;
  onCancel: (packId: string) => void;
  packBusy: (packId: string) => boolean;
}) {
  const visible = packs.filter((p) => !focusSet.has(p.id) || recommended);
  if (visible.length === 0) return null;

  return (
    <>
      {visible.map((pack, index) => {
        const status = regions[pack.id] ?? { regionId: pack.id, state: 'idle', percentage: 0, packId: null, error: null };
        const downloadActive = isPackDownloadActive(pack.id, status, activeDownloadRegionId);

        return (
          <RegionPackCard
            key={pack.id}
            pack={pack}
            status={status}
            activeDownloadRegionId={activeDownloadRegionId}
            testPack={pack.id === TEST_PACK_ID}
            variant="list"
            showDivider={index > 0}
            selected={selectedPackId === pack.id}
            recommended={recommended}
            suppressActiveProgress={suppressActiveProgress}
            onDownload={() => onDownload(pack.id)}
            onDelete={() => onDelete(pack.id, t(pack.nameKey as 'downloads.packs.kielBay.name'))}
            onCancel={downloadActive ? () => onCancel(pack.id) : undefined}
            busy={packBusy(pack.id)}
            onSelect={() => onSelect(pack.id)}
          />
        );
      })}
    </>
  );
}

export function DownloadsScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const { colors, spacing, minTouch } = useTheme();
  const { formFactor } = useFormFactor();
  const route = useRoute<DownloadsRoute>();
  const focusPackIds = route.params?.focusPackIds ?? [];
  const scrollToCustom = route.params?.scrollToCustom ?? false;
  const passageBounds = route.params?.passageBounds;
  const passageName = route.params?.passageName;
  const focusSet = useMemo(() => new Set(focusPackIds), [focusPackIds]);
  const scrollRef = useRef<ScrollView>(null);
  const customSectionY = useRef(0);
  const previewSectionY = useRef(0);
  const customScrollPending = useRef(false);
  const previewScrollPending = useRef(false);
  const regions = useOfflinePackStore((s) => s.regions);
  const hydrated = useOfflinePackStore((s) => s.hydrated);
  const activeDownloadRegionId = useOfflinePackStore((s) => s.activeDownloadRegionId);
  const chartStyleUri = useOfflinePackStore((s) => s.chartStyleUri);
  const deleteRegion = useOfflinePackStore((s) => s.deleteRegion);
  const retryPendingSeamarkIndexing = useOfflinePackStore((s) => s.retryPendingSeamarkIndexing);
  const ensureChartStyle = useOfflinePackStore((s) => s.ensureChartStyle);
  const downloadWifiOnly = useSettingsStore((s) => s.downloadWifiOnly);
  const patchSettings = useSettingsStore((s) => s.patchSettings);
  const showInfo = useFeedbackStore((s) => s.showInfo);
  const {
    packBusy,
    handleDownload,
    handleCancel,
    setActionBusyId,
    downloadLocksOtherPacks,
    actionBusyId,
  } = usePackDownloadActions();
  const [selectedPackId, setSelectedPackId] = useState<string | null>(REGION_PACKS[0]?.id ?? null);

  const recommendedPacks = useMemo(
    () => focusPackIds.map((id) => REGION_PACKS.find((p) => p.id === id)).filter((p): p is RegionPackDefinition => p != null),
    [focusPackIds],
  );

  const p0Packs = useMemo(() => packsByPriority('P0').filter((p) => !focusSet.has(p.id)), [focusSet]);
  const p1Packs = useMemo(() => packsByPriority('P1').filter((p) => !focusSet.has(p.id)), [focusSet]);
  const p2Packs = useMemo(() => packsByPriority('P2').filter((p) => !focusSet.has(p.id)), [focusSet]);

  const customPacks = useMemo(() => Object.values(regions).filter((r) => r.custom), [regions]);
  const legacyPacks = useMemo(
    () => Object.values(regions).filter((r) => r.legacy && (r.state === 'ready' || r.state === 'error')),
    [regions],
  );

  const selectedPack = REGION_PACKS.find((p) => p.id === selectedPackId) ?? null;
  const passagePrefill =
    passageBounds && passageName
      ? {
          bounds: passageBounds,
          defaultName: t('downloads.passageCustomDefaultName', { name: passageName }),
          passageLabel: passageName,
        }
      : null;

  const suppressActiveProgress = activeDownloadRegionId != null;

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

  useEffect(() => {
    if (scrollToCustom) customScrollPending.current = true;
  }, [scrollToCustom]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (route.params?.focusPackIds?.length || route.params?.scrollToCustom) {
          navigation.setParams({
            focusPackIds: undefined,
            scrollToCustom: undefined,
            passageBounds: undefined,
            passageName: undefined,
          });
        }
      };
    }, [navigation, route.params?.focusPackIds, route.params?.scrollToCustom]),
  );

  function selectPack(packId: string) {
    setSelectedPackId(packId);
    if (formFactor === 'compact') {
      previewScrollPending.current = true;
      if (previewSectionY.current > 0) {
        requestAnimationFrame(() => {
          scrollRef.current?.scrollTo({ y: previewSectionY.current, animated: true });
          previewScrollPending.current = false;
        });
      }
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
      if (selectedPackId === regionId) {
        setSelectedPackId(REGION_PACKS.find((p) => p.id !== regionId)?.id ?? null);
      }
      showInfo(t('downloads.deleteSuccess'));
    } finally {
      setActionBusyId(null);
    }
  }

  function handlePackDownload(packId: string) {
    void handleDownload(packId).then((ok) => {
      if (ok) selectPack(packId);
    });
  }

  function scrollToCustomSection(y: number) {
    customSectionY.current = y;
    if (!customScrollPending.current) return;
    customScrollPending.current = false;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y, animated: true });
    });
  }

  const sharedPackListProps = {
    focusSet,
    regions,
    activeDownloadRegionId,
    selectedPackId,
    suppressActiveProgress,
    onSelect: selectPack,
    onDownload: handlePackDownload,
    onDelete: (packId: string, name: string) => void confirmDelete(packId, name),
    onCancel: (packId: string) => void handleCancel(packId),
    packBusy,
  };

  let sectionIndex = 0;
  const isFirstSection = () => sectionIndex++ === 0;

  const listPane = (
    <View>
      <DownloadsStatusBanner
        regions={regions}
        activeDownloadRegionId={activeDownloadRegionId}
        hydrated={hydrated}
        onCancelActive={
          activeDownloadRegionId ? () => void handleCancel(activeDownloadRegionId) : undefined
        }
        cancelBusy={actionBusyId === activeDownloadRegionId}
        onRetryFailed={(regionId) => void handleDownload(regionId)}
        retryBusyId={actionBusyId}
      />

      <OfflineChartsGuide />

      <DownloadsSectionCard
        title={t('downloads.beforeYouDownloadTitle')}
        description={t('downloads.wifiNote')}
        first={isFirstSection()}
        testID="downloads.networkSection"
      >
        <ToggleRow
          label={t('downloads.wifiOnly')}
          hint={t('downloads.wifiOnlyHint')}
          value={downloadWifiOnly}
          onChange={(v) => void patchSettings({ downloadWifiOnly: v })}
          testID="downloads.wifiOnly"
          colors={colors}
          minTouch={minTouch}
        />
      </DownloadsSectionCard>

      {!hydrated ? (
        <View
          style={[downloadsStyles.loadingRow, { minHeight: minTouch, marginBottom: spacing.lg }]}
          accessibilityLabel={t('common.loading')}
        >
          <ActivityIndicator color={colors.primary} />
          <Text style={{ color: colors.textMuted }}>{t('common.loading')}</Text>
        </View>
      ) : null}

      {recommendedPacks.length > 0 ? (
        <DownloadsSectionCard
          title={t('downloads.passageRecommendedTitle')}
          description={t('downloads.passageRecommendedBody')}
          first={isFirstSection()}
          testID="downloads.passageRecommended"
        >
          <PackGroupList packs={recommendedPacks} recommended {...sharedPackListProps} />
        </DownloadsSectionCard>
      ) : null}

      {p0Packs.length > 0 ? (
        <DownloadsSectionCard
          title={t('downloads.regionPacksTitle')}
          description={t('downloads.regionPacksP0Hint')}
          first={isFirstSection()}
          testID="downloads.regionPacksP0"
        >
          <PackGroupList packs={p0Packs} {...sharedPackListProps} />
        </DownloadsSectionCard>
      ) : null}

      {p1Packs.length > 0 ? (
        <CollapsibleDownloadsSection
          title={t('downloads.regionPacksP1')}
          packCount={p1Packs.length}
          activeCount={countNonIdlePacks(p1Packs, regions)}
          forceExpanded={corridorGroupNeedsAttention(p1Packs, regions)}
          first={isFirstSection()}
          testID="downloads.regionPacksP1"
        >
          <PackGroupList packs={p1Packs} {...sharedPackListProps} />
        </CollapsibleDownloadsSection>
      ) : null}

      {p2Packs.length > 0 ? (
        <CollapsibleDownloadsSection
          title={t('downloads.regionPacksP2')}
          packCount={p2Packs.length}
          activeCount={countNonIdlePacks(p2Packs, regions)}
          forceExpanded={corridorGroupNeedsAttention(p2Packs, regions)}
          first={isFirstSection()}
          testID="downloads.regionPacksP2"
        >
          <PackGroupList packs={p2Packs} {...sharedPackListProps} />
        </CollapsibleDownloadsSection>
      ) : null}

      {formFactor === 'compact' && selectedPack ? (
        <View
          onLayout={(e) => {
            previewSectionY.current = e.nativeEvent.layout.y;
            if (previewScrollPending.current) {
              previewScrollPending.current = false;
              requestAnimationFrame(() => {
                scrollRef.current?.scrollTo({ y: e.nativeEvent.layout.y, animated: true });
              });
            }
          }}
        >
          <DownloadsSectionCard title={t('downloads.previewTitle')} first={isFirstSection()} testID="downloads.compactPreview">
            <PackPreviewPanel pack={selectedPack} showHeader={false} />
          </DownloadsSectionCard>
        </View>
      ) : null}

      <View
        onLayout={(e) => {
          scrollToCustomSection(e.nativeEvent.layout.y);
        }}
      >
        <DownloadsSectionCard
          title={t('downloads.customTitle')}
          description={t('downloads.customBody')}
          first={isFirstSection()}
          testID="downloads.customArea"
        >
          <CustomDownloadSection
            downloadLocked={downloadLocksOtherPacks || !hydrated}
            actionBusyId={actionBusyId}
            onActionBusyChange={setActionBusyId}
            passagePrefill={passagePrefill}
          />
        </DownloadsSectionCard>
      </View>

      {customPacks.length > 0 ? (
        <DownloadsSectionCard
          title={t('downloads.customSavedTitle')}
          description={t('downloads.customSavedBody')}
          first={isFirstSection()}
          testID="downloads.customSaved"
        >
          {customPacks.map((pack, index) => {
            const downloadActive = isPackDownloadActive(pack.regionId, pack, activeDownloadRegionId);
            return (
              <CustomPackCard
                key={pack.regionId}
                status={pack}
                activeDownloadRegionId={activeDownloadRegionId}
                variant="list"
                showDivider={index > 0}
                suppressActiveProgress={suppressActiveProgress}
                onDownload={() => void handleDownload(pack.regionId)}
                onDelete={() => void confirmDelete(pack.regionId, pack.displayName ?? pack.regionId)}
                onCancel={downloadActive ? () => void handleCancel(pack.regionId) : undefined}
                busy={packBusy(pack.regionId)}
              />
            );
          })}
        </DownloadsSectionCard>
      ) : null}

      {legacyPacks.length > 0 ? (
        <CollapsibleDownloadsSection
          title={t('downloads.legacyTitle')}
          description={t('downloads.legacyBody')}
          packCount={legacyPacks.length}
          activeCount={legacyPacks.filter((p) => p.state === 'ready' || p.state === 'error').length}
          forceExpanded={legacyPacks.some((p) => p.state === 'error')}
          first={isFirstSection()}
          testID="downloads.legacy"
        >
          {legacyPacks.map((pack, index) => (
            <LegacyPackCard
              key={pack.regionId}
              status={pack}
              variant="list"
              showDivider={index > 0}
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
        </CollapsibleDownloadsSection>
      ) : null}
    </View>
  );

  const detailPane = selectedPack ? <PackPreviewPanel pack={selectedPack} /> : null;

  return (
    <Screen testID="screen.downloads" title={t('downloads.title')} subtitle={t('downloads.subtitle')} scrollRef={scrollRef}>
      <MasterDetailLayout master={listPane} detail={formFactor === 'compact' ? null : detailPane} requireDetail={formFactor !== 'compact'} />
    </Screen>
  );
}
