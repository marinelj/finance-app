import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';

type SectionHeaderProps = {
  title: string;
  action?: { label: string; onPress: () => void };
};

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <Text variant="headline" accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {action ? (
        <Pressable onPress={action.onPress} hitSlop={10} accessibilityRole="button">
          <Text variant="callout" tone="primary" weight="600">
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { flex: 1 },
});
