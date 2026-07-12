import { StyleSheet, Text, View } from 'react-native';

import { EXTERNAL_LINKS } from '../../lib/constants/externalLinks';
import { t } from '../../i18n';
import { useTheme } from '../../theme/ThemeContext';
import { ExternalLinkRow } from '../../ui/ExternalLinkRow';

type Props = {
  testIDPrefix?: string;
};

export function NavigationDisclaimer({ testIDPrefix = 'legal' }: Props) {
  const { colors, spacing } = useTheme();

  return (
    <View style={{ gap: spacing.md }}>
      <Text style={[styles.body, { color: colors.textMuted }]}>{t('legal.disclaimerLead')}</Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>{t('legal.disclaimerCharts')}</Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>{t('legal.disclaimerOfficial')}</Text>
      <View style={{ gap: spacing.xs }}>
        <ExternalLinkRow
          label={t('legal.openSeaMapLicense')}
          url={EXTERNAL_LINKS.openSeaMapLicense}
          testID={`${testIDPrefix}.link.openseamap`}
        />
        <ExternalLinkRow
          label={t('legal.openStreetMapCopyright')}
          url={EXTERNAL_LINKS.openStreetMapCopyright}
          testID={`${testIDPrefix}.link.osm`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
});
