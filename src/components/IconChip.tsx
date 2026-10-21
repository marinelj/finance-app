import { StyleSheet, Text as RNText, View } from 'react-native';

import { useTheme } from '@/design/theme';
import type { AccentTone } from '@/design/tokens';

import { Icon, type IconName } from './Icon';

type IconChipProps = {
  /** Either an Ionicons glyph or an emoji. */
  icon?: IconName;
  emoji?: string;
  tone?: AccentTone;
  size?: number;
};

/** Rounded-square icon on a pale accent background. Decorative: labels live next to it. */
export function IconChip({ icon, emoji, tone = 'violet', size = 40 }: IconChipProps) {
  const { colors } = useTheme();
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
          backgroundColor: colors.accentSoft[tone],
        },
      ]}>
      {emoji ? (
        <RNText allowFontScaling={false} style={{ fontSize: size * 0.5 }}>
          {emoji}
        </RNText>
      ) : icon ? (
        <Icon name={icon} size={size * 0.5} color={colors.accentStrong[tone]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignItems: 'center', justifyContent: 'center' },
});
