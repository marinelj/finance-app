import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStyles } from '@/design/theme';
import type { Theme } from '@/design/tokens';

import { TAB_BAR_HEIGHT } from './TabBar';
import { Text } from './Text';

type ScreenProps = {
  title?: string;
  /** Small line above the title, e.g. today's date. */
  eyebrow?: string;
  /** Accessory on the right of the title, e.g. an icon button. */
  right?: ReactNode;
  /** Leave room for the floating tab bar. */
  withTabBar?: boolean;
  /** Screens with their own native header skip the top inset. */
  hasHeader?: boolean;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

/** Scrollable page with the app's large-title header and consistent gutters. */
export function Screen({
  title,
  eyebrow,
  right,
  withTabBar = false,
  hasHeader = false,
  children,
  contentStyle,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const styles = useStyles(makeStyles);
  const bottom = (withTabBar ? TAB_BAR_HEIGHT + 24 : 0) + insets.bottom + 24;

  return (
    <View style={styles.page}>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[
          styles.content,
          { paddingTop: hasHeader ? 12 : insets.top + 12, paddingBottom: bottom },
          contentStyle,
        ]}>
        {title ? (
          <View style={styles.header}>
            <View style={styles.titles}>
              {eyebrow ? (
                <Text variant="caption" tone="muted">
                  {eyebrow}
                </Text>
              ) : null}
              <Text variant="display" accessibilityRole="header">
                {title}
              </Text>
            </View>
            {right}
          </View>
        ) : null}
        {children}
      </ScrollView>
    </View>
  );
}

const makeStyles = ({ colors, space }: Theme) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: space.xl, gap: space.lg },
    header: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md, marginBottom: space.xs },
    titles: { flex: 1, gap: 2 },
  });
