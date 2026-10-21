import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AmountText } from '@/components/AmountText';
import { Appear } from '@/components/Appear';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { HeaderButton } from '@/components/HeaderButton';
import { IconChip } from '@/components/IconChip';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useStyles } from '@/design/theme';
import type { Theme } from '@/design/tokens';
import { isWealthKind } from '@/domain/wealthForms';
import { describeItem } from '@/features/wealth/describe';
import { SECTION_META, tKey } from '@/features/wealth/meta';
import { useCreditData } from '@/state/creditData';
import { usePreferences } from '@/state/preferences';
import { rowsOf, useWealthData } from '@/state/wealthData';

/** All items of one kind of portfolio input. */
export default function WealthSectionScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const styles = useStyles(makeStyles);
  const { kind } = useLocalSearchParams<{ kind: string }>();
  const data = useWealthData();
  const { today } = useCreditData();
  const { prefs, language } = usePreferences();

  if (!isWealthKind(kind)) {
    return (
      <Screen hasHeader>
        <EmptyState emoji="🔍" title={t('wealth.emptyList')} />
      </Screen>
    );
  }

  const rows = rowsOf(data, kind);
  const meta = SECTION_META[kind];
  const add = () => router.push({ pathname: '/wealth/[kind]/edit', params: { kind } });

  return (
    <Screen hasHeader>
      <Stack.Screen
        options={{
          title: tKey(t, `wealth.sections.${kind}`),
          headerRight: () => (
            <HeaderButton label={tKey(t, `wealth.add.${kind}`)} icon="add" onPress={add} />
          ),
        }}
      />
      {rows.length === 0 ? (
        <Appear index={0}>
          <Card>
            <EmptyState
              emoji={meta.emoji}
              tone={meta.tone}
              title={t('wealth.emptyList')}
              message={t('wealth.emptyListHint')}
              action={{ label: tKey(t, `wealth.add.${kind}`), onPress: add }}
            />
          </Card>
        </Appear>
      ) : (
        <>
          <Text variant="callout" tone="secondary">
            {tKey(t, `wealth.sectionHints.${kind}`)}
          </Text>
          {rows.map((row, index) => {
            const summary = describeItem(kind, row, {
              t,
              language,
              today,
              hidden: prefs.hideAmounts,
            });
            return (
              <Appear key={row.id} index={index}>
                <PressableScale
                  onPress={() =>
                    router.push({ pathname: '/wealth/[kind]/edit', params: { kind, id: row.id } })
                  }
                  haptic="light"
                  scaleTo={0.98}
                  accessibilityRole="button"
                  accessibilityLabel={[summary.title, summary.subtitle, ...summary.details].join(
                    ', '
                  )}>
                  <Card style={styles.item}>
                    <View style={styles.row}>
                      <IconChip emoji={meta.emoji} tone={meta.tone} size={40} />
                      <View style={styles.text}>
                        <Text variant="body" weight="700" numberOfLines={1}>
                          {summary.title}
                        </Text>
                        {summary.subtitle ? (
                          <Text variant="caption" tone="muted" numberOfLines={2}>
                            {summary.subtitle}
                          </Text>
                        ) : null}
                      </View>
                      <View style={styles.amount}>
                        <AmountText
                          value={summary.amount}
                          currency={summary.currency}
                          variant="headline"
                        />
                        {summary.amountSuffix ? (
                          <Text variant="micro" tone="muted">
                            {summary.amountSuffix}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    {summary.details.length > 0 ? (
                      <View style={styles.details}>
                        {summary.details.map((line) => (
                          <View key={line} style={styles.detailPill}>
                            <Text variant="caption" tone="secondary">
                              {line}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </Card>
                </PressableScale>
              </Appear>
            );
          })}
        </>
      )}
    </Screen>
  );
}

const makeStyles = ({ colors, radius, space }: Theme) =>
  StyleSheet.create({
    item: { gap: space.md },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    text: { flex: 1, gap: 2 },
    amount: { alignItems: 'flex-end', maxWidth: '45%' },
    details: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    detailPill: {
      paddingHorizontal: space.md,
      paddingVertical: space.xs,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceMuted,
    },
  });
