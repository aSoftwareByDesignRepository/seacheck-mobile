import { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useFormFactor } from '../../hooks/useFormFactor';
import { useTheme } from '../../theme/ThemeContext';

type Props = PropsWithChildren<{
  master: ReactNode;
  detail: ReactNode | null;
  /** When true, detail pane only shows if detail is non-null. */
  requireDetail?: boolean;
}>;

/** Side-by-side master–detail on medium+ width; stacked on compact (plan §6.7). */
export function MasterDetailLayout({ master, detail, requireDetail = false }: Props) {
  const { formFactor } = useFormFactor();
  const { spacing } = useTheme();
  const split = formFactor !== 'compact';

  if (!split) {
    return (
      <View style={styles.stack}>
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
  stack: { gap: 0 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  master: { flex: 1, minWidth: 0 },
  detail: { flex: 1.2, minWidth: 0 },
});
