import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Text } from '@/components/Text';
import { useStyles, useTheme } from '@/design/theme';
import type { Theme } from '@/design/tokens';
import type { Action } from '@/domain/portfolioPlanner';
import { useMoney } from '@/hooks/useMoney';

import { describeAction } from './describeAction';

type NextStepsProps = {
  actions: Action[];
  /** Show only this many open steps (the dashboard); all steps when omitted (the plan). */
  limit?: number;
};

/** The ordered plan: numbered steps, each with the figures behind it in plain language. */
export function NextSteps({ actions, limit }: NextStepsProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { format, percent } = useMoney();
  const described = actions.map((action) =>
    describeAction(action, { t, money: format, percent: (value) => percent(value, 0) })
  );
  const numbered = described.map((text, i) => ({ ...text, step: i + 1 }));
  const shown = limit != null ? numbered.filter((item) => !item.done).slice(0, limit) : numbered;

  if (shown.length === 0) {
    return (
      <Text variant="callout" tone="secondary">
        {t('plan.allDone')}
      </Text>
    );
  }

  return (
    <View style={styles.list}>
      {shown.map((item) => (
        <View
          key={item.step}
          accessible
          accessibilityLabel={[
            item.done ? t('plan.stepDone') : String(item.step),
            item.title,
            ...item.lines,
          ].join('. ')}
          style={[styles.row, item.done && styles.done]}>
          <View
            style={[
              styles.badge,
              { backgroundColor: item.done ? colors.status.good.soft : colors.primary },
            ]}>
            {item.done ? (
              <Icon name="checkmark" size={16} color={colors.status.good.text} />
            ) : (
              <Text variant="micro" tone="onPrimary">
                {item.step}
              </Text>
            )}
          </View>
          <View style={styles.text}>
            <Text variant="headline">{item.title}</Text>
            {item.lines.map((line) => (
              <Text key={line} variant="callout" tone="secondary">
                {line}
              </Text>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const makeStyles = ({ radius, space }: Theme) =>
  StyleSheet.create({
    list: { gap: space.lg },
    row: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
    done: { opacity: 0.7 },
    badge: {
      width: 26,
      height: 26,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    text: { flex: 1, gap: space.xs },
  });
