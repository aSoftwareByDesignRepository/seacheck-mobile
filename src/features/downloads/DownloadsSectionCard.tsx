import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

import { Card } from '../../ui/Screen';
import { SectionHeader } from '../../ui/SectionHeader';
import { useTheme } from '../../theme/ThemeContext';

type Props = PropsWithChildren<{
  title: string;
  description?: string;
  first?: boolean;
  testID?: string;
  /** When false, children render without the outer card (e.g. inline preview). */
  wrapCard?: boolean;
}>;

export function DownloadsSectionCard({ title, description, first, testID, wrapCard = true, children }: Props) {
  const { spacing } = useTheme();

  return (
    <View testID={testID} style={{ marginBottom: spacing.lg }}>
      <SectionHeader title={title} description={description} first={first} />
      {wrapCard ? <Card style={{ marginBottom: 0 }}>{children}</Card> : children}
    </View>
  );
}
