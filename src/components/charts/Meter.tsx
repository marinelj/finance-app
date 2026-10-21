import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/design/theme';
import type { StatusTone } from '@/design/tokens';

type MeterProps = {
  /** 0–1 of the track. */
  value: number;
  tone: StatusTone;
  /** Where the healthy limit sits on the track, 0–1. */
  marker?: number;
};

/** A ratio against a limit: the fill carries severity, the track is a lighter step of it. */
export function Meter({ value, tone, marker }: MeterProps) {
  const { colors } = useTheme();
  const palette = colors.status[tone];
  const share = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.track, { backgroundColor: palette.soft }]}>
      <View style={[styles.fill, { width: `${share * 100}%`, backgroundColor: palette.mark }]} />
      {marker != null ? (
        <View
          style={[
            styles.marker,
            { left: `${Math.min(1, Math.max(0, marker)) * 100}%`, backgroundColor: colors.text },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: 999, overflow: 'visible', justifyContent: 'center' },
  fill: { height: 8, borderRadius: 999 },
  marker: { position: 'absolute', width: 2, height: 14, borderRadius: 1, marginLeft: -1 },
});
