import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { usePassageDeactivate } from '../../hooks/usePassageDeactivate';
import { t } from '../../i18n';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';

type Variant = 'panel' | 'inline' | 'compact';

type Props = {
  variant: Variant;
  fullWidth?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

export function PassageDeactivateButton({ variant, fullWidth, testID, style }: Props) {
  const { colors, minTouch } = useTheme();
  const { deactivate, deactivating, canDeactivate } = usePassageDeactivate();

  const label = variant === 'compact' ? t('passage.deactivateShort') : t('passage.deactivate');
  const hint =
    variant === 'compact' || variant === 'inline'
      ? t('passage.deactivateFromMapHint')
      : t('passage.deactivateFromListHint');

  if (variant === 'panel') {
    return (
      <Button
        label={label}
        variant="secondary"
        loading={deactivating}
        disabled={!canDeactivate || deactivating}
        onPress={() => void deactivate()}
        accessibilityHint={hint}
        testID={testID ?? 'passage.deactivate'}
        fullWidth={fullWidth}
        style={style as ViewStyle | undefined}
      />
    );
  }

  const compact = variant === 'compact';
  const textColor = compact ? colors.danger : colors.text;
  const borderColor = compact ? colors.dangerBorder : colors.border;
  const backgroundColor = compact ? colors.dangerBg : colors.surface;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('passage.deactivate')}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !canDeactivate || deactivating, busy: deactivating }}
      disabled={!canDeactivate || deactivating}
      onPress={() => void deactivate()}
      style={({ pressed }) => [
        compact ? styles.compactBtn : styles.inlineBtn,
        {
          borderColor,
          backgroundColor,
          minHeight: minTouch,
          opacity: !canDeactivate ? 0.45 : pressed ? 0.88 : 1,
        },
        style,
      ]}
      testID={testID ?? 'passage.deactivate'}
    >
      {deactivating ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text
          style={[compact ? styles.compactLabel : styles.inlineLabel, { color: textColor }]}
          numberOfLines={1}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inlineBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexGrow: 1,
    flexBasis: 120,
    minWidth: 0,
  },
  inlineLabel: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  compactBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 56,
    flexShrink: 0,
  },
  compactLabel: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
});
