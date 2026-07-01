import { MaterialIcons } from '@expo/vector-icons';
import type { PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '../../i18n';
import { Card } from '../../ui/Screen';
import { SectionHeader } from '../../ui/SectionHeader';
import { useTheme } from '../../theme/ThemeContext';

type Props = PropsWithChildren<{
  title: string;
  description?: string;
  packCount: number;
  activeCount?: number;
  /** Start expanded when any pack in the group needs attention. */
  defaultExpanded?: boolean;
  forceExpanded?: boolean;
  first?: boolean;
  testID?: string;
}>;

export function CollapsibleDownloadsSection({
  title,
  description,
  packCount,
  activeCount = 0,
  defaultExpanded = false,
  forceExpanded = false,
  first,
  testID,
  children,
}: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const [expanded, setExpanded] = useState(defaultExpanded || forceExpanded);

  useEffect(() => {
    if (forceExpanded) setExpanded(true);
  }, [forceExpanded]);

  const toggleLabel = expanded
    ? t('downloads.sectionHide', { count: packCount })
    : t('downloads.sectionShow', { count: packCount });

  return (
    <View testID={testID} style={{ marginBottom: spacing.lg }}>
      <SectionHeader title={title} description={description} first={first} />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={toggleLabel}
        accessibilityHint={description}
        onPress={() => setExpanded((v) => !v)}
        testID={testID ? `${testID}.toggle` : undefined}
        style={({ pressed }) => [
          styles.toggle,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            minHeight: minTouch,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <View style={styles.toggleText}>
          <Text style={[styles.toggleTitle, { color: colors.text }]}>
            {expanded ? t('downloads.sectionExpandedLabel') : t('downloads.sectionCollapsedLabel')}
          </Text>
          <Text style={[styles.toggleMeta, { color: colors.textMuted }]}>
            {activeCount > 0
              ? t('downloads.sectionPackCountActive', { count: packCount, active: activeCount })
              : t('downloads.sectionPackCount', { count: packCount })}
          </Text>
        </View>
        <MaterialIcons
          name={expanded ? 'expand-less' : 'expand-more'}
          size={24}
          color={colors.textMuted}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </Pressable>
      {expanded ? <Card style={{ marginBottom: 0, marginTop: spacing.sm }}>{children}</Card> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleText: { flex: 1, gap: 2 },
  toggleTitle: { fontSize: 15, fontWeight: '600', lineHeight: 22 },
  toggleMeta: { fontSize: 13, lineHeight: 18 },
});
