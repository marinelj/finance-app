import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { Appear } from '@/components/Appear';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { TextField } from '@/components/form/TextField';
import { HeaderButton } from '@/components/HeaderButton';
import { Icon } from '@/components/Icon';
import { PressableScale } from '@/components/PressableScale';
import { ProgressRing } from '@/components/ProgressRing';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useMotion } from '@/design/motion';
import { useStyles, useTheme } from '@/design/theme';
import { springs, type Theme } from '@/design/tokens';
import { saveRiskProfile } from '@/db/wealth';
import { parseInteger } from '@/domain/numberInput';
import {
  DROP_REACTIONS,
  GOALS,
  HORIZONS,
  INCOME_STABILITY,
  MAX_RISK_SCORE,
  scoreRisk,
  type RiskAnswers,
  type RiskQuestion,
} from '@/domain/riskProfile';
import { tKey } from '@/features/wealth/meta';
import { haptics } from '@/lib/haptics';
import { useWealthData } from '@/state/wealthData';

const STEPS: RiskQuestion[] = ['age', 'horizon', 'goal', 'dropReaction', 'incomeStability'];
const OPTIONS: Record<Exclude<RiskQuestion, 'age'>, readonly string[]> = {
  horizon: HORIZONS,
  goal: GOALS,
  dropReaction: DROP_REACTIONS,
  incomeStability: INCOME_STABILITY,
};

/** Five-question risk profile (one question per step), then the result with its reasons. */
export default function RiskProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { risk } = useWealthData();
  const [retaking, setRetaking] = useState(risk == null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<RiskAnswers>>(risk?.answers ?? {});
  const [ageText, setAgeText] = useState(risk ? String(risk.answers.age) : '');
  const [ageError, setAgeError] = useState<string | undefined>();

  const close = () => router.back();

  if (!retaking && risk) {
    return (
      <>
        <Stack.Screen
          options={{
            title: t('risk.title'),
            headerLeft: () => <HeaderButton label={t('common.done')} onPress={close} />,
          }}
        />
        <RiskResult
          answers={risk.answers}
          onRetake={() => {
            setStep(0);
            setRetaking(true);
          }}
          onDone={close}
        />
      </>
    );
  }

  const question = STEPS[step];
  const advance = (next: Partial<RiskAnswers>) => {
    const merged = { ...answers, ...next };
    setAnswers(merged);
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      return;
    }
    saveRiskProfile(merged as RiskAnswers);
    haptics.success();
    setRetaking(false);
  };

  const submitAge = () => {
    const age = parseInteger(ageText);
    if (age == null || Number.isNaN(age) || age < 16 || age > 110) {
      haptics.error();
      setAgeError(t('risk.ageInvalid'));
      return;
    }
    advance({ age });
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: t('risk.title'),
          headerLeft: () =>
            step > 0 ? (
              <HeaderButton
                label={t('common.back')}
                icon="chevron-back"
                onPress={() => setStep(step - 1)}
              />
            ) : (
              <HeaderButton label={t('common.cancel')} onPress={close} />
            ),
        }}
      />
      <Screen hasHeader>
        <Progress value={(step + 1) / STEPS.length} />
        <Text variant="caption" tone="muted">
          {t('risk.step', { index: step + 1, count: STEPS.length })}
        </Text>
        <Appear key={`title-${question}`} index={0}>
          <Text variant="title" accessibilityRole="header">
            {t(`risk.questions.${question}`)}
          </Text>
        </Appear>
        {question === 'age' ? (
          <Appear key="age" index={1} style={styles.gap}>
            {step === 0 ? <Text tone="secondary">{t('risk.intro')}</Text> : null}
            <TextField
              label={t('risk.ageLabel')}
              value={ageText}
              onChangeText={(text) => {
                setAgeText(text);
                setAgeError(undefined);
              }}
              keyboardType="number-pad"
              maxLength={3}
              error={ageError}
              autoFocus
            />
            <Button label={t('risk.next')} size="lg" fullWidth onPress={submitAge} />
          </Appear>
        ) : (
          <View accessibilityRole="radiogroup" style={styles.gap}>
            {OPTIONS[question].map((value, index) => (
              <Appear key={`${question}-${value}`} index={index + 1}>
                <AnswerCard
                  label={tKey(t, `risk.answers.${question}.${value}`)}
                  selected={answers[question] === value}
                  onPress={() => {
                    haptics.selection();
                    advance({ [question]: value } as Partial<RiskAnswers>);
                  }}
                />
              </Appear>
            ))}
          </View>
        )}
      </Screen>
    </>
  );
}

function Progress({ value }: { value: number }) {
  const { colors } = useTheme();
  const { reduceMotion } = useMotion();
  const fill = useAnimatedStyle(() => ({
    width: reduceMotion ? `${value * 100}%` : withSpring(`${value * 100}%`, springs.snappy),
  }));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      style={[styles.track, { backgroundColor: colors.primarySoft }]}>
      <Animated.View style={[styles.fill, { backgroundColor: colors.primary }, fill]} />
    </View>
  );
}

function AnswerCard({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const themed = useStyles(makeStyles);
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[
        themed.answer,
        selected && { borderColor: colors.primary, backgroundColor: colors.primarySoft },
      ]}>
      <Text variant="headline" style={styles.flex}>
        {label}
      </Text>
      <Icon
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={22}
        color={selected ? colors.primary : colors.textMuted}
      />
    </PressableScale>
  );
}

function RiskResult({
  answers,
  onRetake,
  onDone,
}: {
  answers: RiskAnswers;
  onRetake: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const themed = useStyles(makeStyles);
  const result = scoreRisk(answers);

  return (
    <Screen hasHeader>
      <Appear index={0}>
        <Card style={themed.result}>
          <Text variant="micro" tone="muted">
            {t('risk.result')}
          </Text>
          <ProgressRing
            progress={result.score / MAX_RISK_SCORE}
            size={148}
            strokeWidth={14}
            accessibilityLabel={t('risk.score', { score: result.score, max: MAX_RISK_SCORE })}>
            <Text variant="title" align="center">
              {t(`risk.profiles.${result.profile}`)}
            </Text>
            <Text variant="caption" tone="muted">
              {t('risk.score', { score: result.score, max: MAX_RISK_SCORE })}
            </Text>
          </ProgressRing>
          <Text variant="body" tone="secondary" align="center">
            {t(`risk.profileHints.${result.profile}`)}
          </Text>
          {result.cappedBy.map((reason) => (
            <View key={reason} style={themed.cap}>
              <Icon name="shield-checkmark" size={18} color={colors.status.caution.text} />
              <Text variant="callout" tone="caution" style={styles.flex}>
                {t(`risk.capped.${reason}`)}
              </Text>
            </View>
          ))}
        </Card>
      </Appear>
      <Appear index={1}>
        <Card style={styles.gap}>
          {STEPS.map((question) => (
            <View key={question} style={styles.answerRow}>
              <Text variant="caption" tone="muted">
                {t(`risk.questions.${question}`)}
              </Text>
              <Text variant="callout" weight="600">
                {question === 'age'
                  ? String(answers.age)
                  : tKey(t, `risk.answers.${question}.${answers[question]}`)}
              </Text>
            </View>
          ))}
        </Card>
      </Appear>
      <Button label={t('risk.retake')} variant="secondary" fullWidth onPress={onRetake} />
      <Button label={t('common.done')} fullWidth onPress={onDone} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 12 },
  flex: { flex: 1 },
  track: { height: 6, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
  answerRow: { gap: 2 },
});

const makeStyles = ({ colors, radius, space }: Theme) =>
  StyleSheet.create({
    answer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      minHeight: 64,
      paddingHorizontal: space.xl,
      paddingVertical: space.lg,
      borderRadius: radius.lg,
      borderWidth: 2,
      borderColor: colors.hairline,
      backgroundColor: colors.surface,
    },
    result: { alignItems: 'center', gap: space.lg },
    cap: {
      flexDirection: 'row',
      gap: space.sm,
      alignItems: 'flex-start',
      alignSelf: 'stretch',
      padding: space.md,
      borderRadius: radius.sm,
      backgroundColor: colors.status.caution.soft,
    },
  });
