import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '../../i18n';
import type { PassageLeg, PassageWithLegs } from '../../store/passageStore';
import { useTheme } from '../../theme/ThemeContext';
import { FieldInput } from '../../ui/Screen';

type Props = {
  detail: PassageWithLegs;
  highlightedLegIndex: number | null;
  onHighlightLeg: (legIndex: number | null) => void;
  onLegSogChange: (leg: PassageLeg, sogKn: number) => void;
  onLegNoteChange: (leg: PassageLeg, note: string) => void;
};

function formatLegMeta(leg: PassageLeg): string {
  const base = t('passage.legMeta', {
    brg: Math.round(leg.bearingDeg),
    dist: leg.distanceNm.toFixed(1),
    cum: leg.cumulativeNm.toFixed(1),
    hours: leg.durationHours.toFixed(1),
  });
  if (!leg.etaUtc) return base;
  return `${base} · ${t('passage.legEta', { utc: leg.etaUtc.slice(11, 16) })}`;
}

function LegSogField({ leg, onCommit }: { leg: PassageLeg; onCommit: (sogKn: number) => void }) {
  const { colors, spacing, minTouch } = useTheme();
  const [value, setValue] = useState(leg.sogKn.toFixed(1));

  useEffect(() => {
    setValue(leg.sogKn.toFixed(1));
  }, [leg.sogKn, leg.from.id, leg.to.id]);

  return (
    <View style={[styles.sogRow, { marginTop: spacing.sm }]}>
      <Text style={[styles.sogLabel, { color: colors.textMuted }]}>{t('passage.legSogLabel')}</Text>
      <View style={styles.sogInput}>
        <FieldInput
          value={value}
          onChangeText={setValue}
          onEndEditing={() => {
            const parsed = Number.parseFloat(value.replace(',', '.'));
            if (Number.isFinite(parsed)) onCommit(parsed);
          }}
          accessibilityLabel={t('passage.legSogA11y', { from: leg.from.name, to: leg.to.name })}
          keyboardType="number-pad"
        />
      </View>
      <Text style={[styles.sogUnit, { color: colors.textMuted }]}>{t('passage.knotsShort')}</Text>
    </View>
  );
}

function LegNoteField({ leg, expanded, onExpand, onCommit }: { leg: PassageLeg; expanded: boolean; onExpand: () => void; onCommit: (note: string) => void }) {
  const { colors, spacing, minTouch } = useTheme();
  const [value, setValue] = useState(leg.note);

  useEffect(() => {
    setValue(leg.note);
  }, [leg.note, leg.from.id, leg.to.id]);

  if (!leg.note && !expanded) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('passage.addLegNoteA11y', { from: leg.from.name, to: leg.to.name })}
        onPress={onExpand}
        style={{ minHeight: minTouch, justifyContent: 'center', marginTop: spacing.xs }}
      >
        <Text style={{ color: colors.primary, fontWeight: '700' }}>{t('passage.addLegNote')}</Text>
      </Pressable>
    );
  }

  return (
    <View style={{ marginTop: spacing.sm }}>
      <FieldInput
        value={value}
        onChangeText={setValue}
        onEndEditing={() => onCommit(value.trim())}
        accessibilityLabel={t('passage.legNoteA11y', { from: leg.from.name, to: leg.to.name })}
        placeholder={t('passage.legNotePlaceholder')}
      />
    </View>
  );
}

export function PassageLegTable({ detail, highlightedLegIndex, onHighlightLeg, onLegSogChange, onLegNoteChange }: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const [expandedNoteLeg, setExpandedNoteLeg] = useState<number | null>(null);

  if (detail.waypoints.length < 2) {
    return (
      <Text style={{ color: colors.textMuted, lineHeight: 20 }} testID="passage.legTable.empty">
        {t('passage.needTwoWaypoints')}
      </Text>
    );
  }

  return (
    <View testID="passage.legTable">
      {detail.legs.map((leg) => {
        const highlighted = highlightedLegIndex === leg.index;
        return (
          <View
            key={`${leg.from.id}-${leg.to.id}`}
            style={[
              styles.legRow,
              {
                borderColor: colors.border,
                backgroundColor: highlighted ? colors.background : 'transparent',
              },
            ]}
            testID={`passage.leg.${leg.index}`}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('passage.legRowA11y', { index: leg.index, from: leg.from.name, to: leg.to.name })}
              accessibilityState={{ selected: highlighted }}
              onPress={() => onHighlightLeg(highlighted ? null : leg.index)}
              style={[styles.legHeader, { minHeight: minTouch }]}
            >
              <Text style={[styles.legIndex, { color: colors.primary }]}>{leg.index}</Text>
              <View style={styles.legMain}>
                <Text style={[styles.legTitle, { color: colors.text }]}>
                  {leg.from.name} → {leg.to.name}
                </Text>
                <Text style={[styles.legMeta, { color: colors.textMuted }]}>{formatLegMeta(leg)}</Text>
              </View>
            </Pressable>
            <LegSogField leg={leg} onCommit={(sogKn) => onLegSogChange(leg, sogKn)} />
            <LegNoteField
              leg={leg}
              expanded={expandedNoteLeg === leg.index}
              onExpand={() => setExpandedNoteLeg(leg.index)}
              onCommit={(note) => onLegNoteChange(leg, note)}
            />
          </View>
        );
      })}
      <Text style={[styles.total, { color: colors.text, marginTop: spacing.md }]}>
        {t('passage.total', { nm: detail.totalNm.toFixed(1), hours: detail.totalHours.toFixed(1) })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  legRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 12 },
  legHeader: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  legIndex: { fontSize: 16, fontWeight: '800', width: 24, textAlign: 'center' },
  legMain: { flex: 1 },
  legTitle: { fontSize: 15, fontWeight: '600' },
  legMeta: { fontSize: 14, marginTop: 4, lineHeight: 20 },
  sogRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sogLabel: { fontSize: 13, fontWeight: '700', width: 44 },
  sogInput: { flex: 1, maxWidth: 120 },
  sogUnit: { fontSize: 14, fontWeight: '600' },
  total: { fontSize: 15, fontWeight: '700' },
});
