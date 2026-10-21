import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AmountText } from '@/components/AmountText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { DueBadge } from '@/components/DueBadge';
import { EmptyState } from '@/components/EmptyState';
import { IconChip } from '@/components/IconChip';
import { ProgressRing } from '@/components/ProgressRing';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
import { StatTile } from '@/components/StatTile';
import { StatusPill } from '@/components/StatusPill';
import { Text } from '@/components/Text';
import { useStyles, useTheme } from '@/design/theme';
import { typography, type AccentTone, type Theme, type TypographyVariant } from '@/design/tokens';
import { haptics } from '@/lib/haptics';

const VARIANTS = Object.keys(typography) as TypographyVariant[];
const TONES: AccentTone[] = ['violet', 'pink', 'mint', 'sun', 'sky'];
const SAMPLE_AMOUNTS = [86420.5, 12890.25, 245000];

/** Living reference of the design system (developer-facing, English only). */
export default function DesignSystemScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [sample, setSample] = useState(0);
  const [range, setRange] = useState<'1M' | '3M' | '1Y'>('1M');
  const [sheetOpen, setSheetOpen] = useState(false);

  const swatches = [
    ['primary', colors.primary],
    ['pink', colors.accent.pink],
    ['mint', colors.accent.mint],
    ['sun', colors.accent.sun],
    ['sky', colors.accent.sky],
    ['good', colors.status.good.mark],
    ['caution', colors.status.caution.mark],
    ['danger', colors.status.danger.mark],
  ] as const;

  return (
    <Screen hasHeader>
      <Card style={styles.section}>
        <SectionHeader title="Colour" />
        <View style={styles.wrap}>
          {swatches.map(([name, hex]) => (
            <View key={name} style={styles.swatch}>
              <View style={[styles.swatchColor, { backgroundColor: hex }]} />
              <Text variant="caption" tone="secondary">
                {name}
              </Text>
            </View>
          ))}
        </View>
        <Text variant="caption" tone="muted">
          Chart series (fixed order)
        </Text>
        <View style={styles.wrap}>
          {colors.chart.series.map((hex) => (
            <View key={hex} style={[styles.seriesDot, { backgroundColor: hex }]} />
          ))}
        </View>
      </Card>

      <Card style={styles.section}>
        <SectionHeader title="Type" />
        {VARIANTS.map((variant) => (
          <Text key={variant} variant={variant} numberOfLines={1}>
            {variant} 本月应还
          </Text>
        ))}
      </Card>

      <Card variant="gradient" style={styles.section}>
        <Text variant="callout" tone="onPrimary">
          Count-up amount
        </Text>
        <AmountText
          value={SAMPLE_AMOUNTS[sample]}
          currency="CNY"
          variant="hero"
          tone="onPrimary"
          animate
        />
        <Button
          label="Change value"
          variant="secondary"
          size="sm"
          onPress={() => setSample((sample + 1) % SAMPLE_AMOUNTS.length)}
        />
      </Card>

      <Card style={styles.section}>
        <SectionHeader title="Amounts" />
        <AmountText value={123456.78} currency="CNY" compact />
        <AmountText value={123456.78} currency="USD" compact />
        <AmountText value={-42.5} currency="USD" tone="danger" />
        <AmountText value={9999} currency="CNY" masked />
      </Card>

      <View style={styles.row}>
        <StatTile
          style={styles.flex}
          emoji="🗓️"
          tone="sun"
          label="Due this month"
          value={<AmountText value={8650} currency="CNY" variant="title" />}
          status={{ tone: 'caution', label: '2 bills' }}
        />
        <StatTile
          style={styles.flex}
          icon="trending-up"
          tone="mint"
          label="Passive income"
          value={<AmountText value={1320.4} currency="USD" variant="title" />}
          caption="per month"
        />
      </View>

      <Card style={styles.section}>
        <SectionHeader title="Due badges" />
        <View style={styles.wrap}>
          {[-2, 0, 2, 5, 12].map((days) => (
            <DueBadge key={days} daysLeft={days} />
          ))}
        </View>
        <View style={styles.wrap}>
          <StatusPill tone="good" label="Safe" />
          <StatusPill tone="caution" label="Watch" />
          <StatusPill tone="danger" label="High" />
        </View>
      </Card>

      <Card style={styles.section}>
        <SectionHeader title="Progress rings" />
        <View style={styles.rings}>
          <ProgressRing progress={0.24} accessibilityLabel="Utilization 24 percent">
            <Text variant="headline">24%</Text>
          </ProgressRing>
          <ProgressRing
            progress={0.62}
            color={colors.status.caution.mark}
            trackColor={colors.status.caution.soft}
            accessibilityLabel="Utilization 62 percent">
            <Text variant="headline">62%</Text>
          </ProgressRing>
          <ProgressRing
            progress={0.91}
            color={colors.status.danger.mark}
            trackColor={colors.status.danger.soft}
            accessibilityLabel="Utilization 91 percent">
            <Text variant="headline">91%</Text>
          </ProgressRing>
        </View>
      </Card>

      <Card style={styles.section}>
        <SectionHeader title="Controls" />
        <SegmentedControl
          value={range}
          onChange={setRange}
          options={[
            { value: '1M', label: '1M' },
            { value: '3M', label: '3M' },
            { value: '1Y', label: '1Y' },
          ]}
        />
        <View style={styles.wrap}>
          <Button label="Primary" />
          <Button label="Secondary" variant="secondary" />
          <Button label="Dark" variant="dark" />
          <Button label="Ghost" variant="ghost" />
          <Button label="Danger" variant="danger" icon="trash-outline" />
          <Button label="Small" size="sm" icon="add" />
        </View>
        <Button
          label="Open bottom sheet"
          variant="secondary"
          fullWidth
          onPress={() => setSheetOpen(true)}
        />
        <View style={styles.wrap}>
          {TONES.map((tone) => (
            <IconChip key={tone} icon="sparkles" tone={tone} />
          ))}
        </View>
      </Card>

      <Card>
        <EmptyState
          emoji="🪴"
          title="Empty state"
          message="One friendly sentence that says what will appear here."
          action={{ label: 'Call to action', onPress: () => haptics.success() }}
        />
      </Card>

      <BottomSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Bottom sheet"
        footer={<Button label="Done" fullWidth onPress={() => setSheetOpen(false)} />}>
        <Text tone="secondary">
          Drag the handle down, tap outside, or use the close button. Under Reduce Motion it appears
          without the spring.
        </Text>
      </BottomSheet>
    </Screen>
  );
}

const makeStyles = ({ radius, space }: Theme) =>
  StyleSheet.create({
    section: { gap: space.md },
    wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    swatch: { alignItems: 'center', gap: space.xs, width: 64 },
    swatchColor: { width: 48, height: 48, borderRadius: radius.md },
    seriesDot: { width: 28, height: 28, borderRadius: radius.pill },
    row: { flexDirection: 'row', gap: space.md },
    flex: { flex: 1 },
    rings: { flexDirection: 'row', justifyContent: 'space-around' },
  });
