import { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { shouldUseMasterDetail } from '../../lib/responsive/splitLayout';
import { useFormFactor } from '../../hooks/useFormFactor';
import { useTheme } from '../../theme/ThemeContext';

type Props = PropsWithChildren<{
  master: ReactNode;
  detail: ReactNode | null;
  /** When true, detail pane only shows if detail is non-null. */
  requireDetail?: boolean;
}>;

/** Side-by-side master–detail on medium+ portrait; stacked on compact and landscape. */
export function MasterDetailLayout({ master, detail, requireDetail = false }: Props) {
  const { formFactor, isLandscape } = useFormFactor();
  const { spacing } = useTheme();
  const split = shouldUseMasterDetail(formFactor, isLandscape);

  if (!split) {
    return (
      <View style={styles.stackCompact}>
        {master}
        {detail}
      </View>
    );
  }

  if (requireDetail && !detail) {
    return <View style={styles.stack}>{master}</View>;
  }

  return (
    <View style={[styles.row, { gap: spacing.md }]}>
      <View style={styles.master}>{master}</View>
      {detail ? <View style={styles.detail}>{detail}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { flex: 1, width: '100%', alignSelf: 'stretch', minHeight: 0 },
  stackCompact: { width: '100%', alignSelf: 'stretch' },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    alignSelf: 'stretch',
    width: '100%',
    minHeight: 0,
  },
  master: { flex: 1, minWidth: 0, minHeight: 0 },
  detail: { flex: 0.95, minWidth: 260, maxWidth: '44%', minHeight: 0 },
});
