import { StyleSheet, Text as RNText, View } from 'react-native';

import { mixHex } from '@/design/color';

type ProductEmojiProps = { emoji: string; color: string; size?: number };

/** The product's emoji on a pale tint of its own colour. Decorative. */
export function ProductEmoji({ emoji, color, size = 44 }: ProductEmojiProps) {
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.chip,
        {
          width: size,
          height: size,
          borderRadius: size * 0.32,
          backgroundColor: mixHex(color, '#FFFFFF', 0.82),
        },
      ]}>
      <RNText allowFontScaling={false} style={{ fontSize: size * 0.5 }}>
        {emoji}
      </RNText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignItems: 'center', justifyContent: 'center' },
});
