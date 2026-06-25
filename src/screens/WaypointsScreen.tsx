import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { MasterDetailLayout } from '../features/responsive/MasterDetailLayout';
import { WaypointDetailPanel } from '../features/waypoints/WaypointDetailPanel';
import { formatCoordinates } from '../map/coords';
import type { WaypointRow, WaypointType } from '../lib/db/database';
import { t } from '../i18n';
import type { RootTabParamList } from '../navigation/types';
import { requestConfirm } from '../store/confirmStore';
import { useSettingsStore } from '../store/settingsStore';
import { useNavigationStore, waypointToTarget } from '../store/navigationStore';
import { useWaypointStore } from '../store/waypointStore';
import { useTheme } from '../theme/ThemeContext';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { FilterChip } from '../ui/FilterChip';
import { Screen, FieldInput } from '../ui/Screen';
import { StatusBadge } from '../ui/StatusBadge';

const FILTER_TYPES: (WaypointType | 'all')[] = ['all', 'harbour', 'anchorage', 'mark', 'hazard', 'mob', 'generic'];

export function WaypointsScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const { colors, spacing, minTouch } = useTheme();
  const coordFormat = useSettingsStore((s) => s.coordFormat);
  const items = useWaypointStore((s) => s.items);
  const remove = useWaypointStore((s) => s.remove);
  const update = useWaypointStore((s) => s.update);
  const create = useWaypointStore((s) => s.create);
  const setGoTo = useNavigationStore((s) => s.setGoTo);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<WaypointType | 'all'>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((wp) => {
      if (typeFilter !== 'all' && wp.type !== typeFilter) return false;
      if (!q) return true;
      return wp.name.toLowerCase().includes(q) || wp.note.toLowerCase().includes(q);
    });
  }, [items, typeFilter, search]);

  const selected = items.find((w) => w.id === selectedId) ?? null;

  const addDemo = useCallback(async () => {
    setBusy(true);
    try {
      const wp = await create({ name: t('waypoints.demoName'), latitude: 54.323, longitude: 10.141, type: 'harbour' });
      setSelectedId(wp.id);
    } finally {
      setBusy(false);
    }
  }, [create]);

  async function confirmDelete(item: WaypointRow) {
    const ok = await requestConfirm({
      title: t('waypoints.deleteTitle'),
      message: item.name,
      confirmLabel: t('waypoints.delete'),
      destructive: true,
    });
    if (!ok) return;
    await remove(item.id);
    if (selectedId === item.id) setSelectedId(null);
  }

  if (items.length === 0) {
    return (
      <Screen testID="screen.waypoints" title={t('tabs.waypoints')}>
        <EmptyState
          testID="waypoints.empty"
          icon="place"
          title={t('waypoints.emptyTitle')}
          body={t('waypoints.emptyBody')}
          actionLabel={t('waypoints.addSample')}
          onAction={() => void addDemo()}
        />
      </Screen>
    );
  }

  const listPane = (
    <View>
      <FieldInput
        value={search}
        onChangeText={setSearch}
        placeholder={t('waypoints.searchPlaceholder')}
        accessibilityLabel={t('waypoints.searchPlaceholder')}
      />
      <View style={[styles.filterRow, { marginTop: spacing.sm, marginBottom: spacing.md }]}>
        {FILTER_TYPES.map((ft) => (
          <FilterChip
            key={ft}
            label={ft === 'all' ? t('waypoints.filterAll') : t(`waypoints.types.${ft}` as 'waypoints.types.generic')}
            selected={typeFilter === ft}
            onPress={() => setTypeFilter(ft)}
            testID={`waypoints.filter.${ft}`}
          />
        ))}
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        ListEmptyComponent={<Text style={{ color: colors.textMuted, textAlign: 'center' }}>{t('waypoints.noMatches')}</Text>}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setSelectedId(item.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedId === item.id }}
            accessibilityLabel={`${item.name}, ${formatCoordinates(coordFormat, item.latitude, item.longitude)}`}
            accessibilityHint={t('waypoints.tapSelectHint')}
            style={[
              styles.row,
              {
                backgroundColor: selectedId === item.id ? colors.successBg : colors.surface,
                borderColor: selectedId === item.id ? colors.success : colors.border,
                marginBottom: spacing.sm,
                minHeight: minTouch,
              },
            ]}
            testID={`waypoints.row.${item.id}`}
          >
            <View style={styles.rowMain}>
              <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
              <Text style={[styles.coords, { color: colors.textMuted }]}>{formatCoordinates(coordFormat, item.latitude, item.longitude)}</Text>
            </View>
            <StatusBadge label={t(`waypoints.types.${item.type}` as 'waypoints.types.generic')} variant="neutral" />
          </Pressable>
        )}
      />
    </View>
  );

  const detailPane = selected ? (
    <WaypointDetailPanel
      waypoint={selected}
      onSave={async (patch) => update(selected.id, patch)}
      onGoTo={() => {
        void setGoTo(waypointToTarget(selected));
        navigation.navigate('Map');
      }}
      onDelete={() => confirmDelete(selected)}
    />
  ) : (
    <View style={[styles.hintBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Text style={{ color: colors.textMuted, textAlign: 'center', lineHeight: 22 }}>{t('waypoints.selectHint')}</Text>
    </View>
  );

  return (
    <Screen testID="screen.waypoints" title={t('tabs.waypoints')} subtitle={t('waypoints.subtitle')}>
      <MasterDetailLayout master={listPane} detail={detailPane} />
      <Button label={t('waypoints.openMap')} variant="secondary" onPress={() => navigation.navigate('Map')} testID="waypoints.openMap" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { borderWidth: 1, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowMain: { flex: 1 },
  name: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  coords: { fontSize: 14, lineHeight: 20 },
  hintBox: { borderWidth: 1, borderRadius: 14, padding: 24, minHeight: 120, justifyContent: 'center' },
});
