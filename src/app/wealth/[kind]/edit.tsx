import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { HeaderButton } from '@/components/HeaderButton';
import { Screen } from '@/components/Screen';
import { deleteWealthItem } from '@/db/wealth';
import { defaultWealthValues, fromWealthRecord, isWealthKind } from '@/domain/wealthForms';
import { itemName } from '@/features/wealth/describe';
import { tKey } from '@/features/wealth/meta';
import { WealthForm } from '@/features/wealth/WealthForm';
import { confirm } from '@/lib/confirm';
import { haptics } from '@/lib/haptics';
import { useCreditData } from '@/state/creditData';
import { usePreferences } from '@/state/preferences';
import { useToast } from '@/state/toast';
import { rowsOf, useWealthData } from '@/state/wealthData';

/** Add or edit one portfolio item. */
export default function WealthItemScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { kind, id } = useLocalSearchParams<{ kind: string; id?: string }>();
  const data = useWealthData();
  const { today } = useCreditData();
  const { prefs } = usePreferences();

  const header = (title: string) => (
    <Stack.Screen
      options={{
        title,
        headerLeft: () => <HeaderButton label={t('common.cancel')} onPress={() => router.back()} />,
      }}
    />
  );

  const row = isWealthKind(kind) && id ? rowsOf(data, kind).find((item) => item.id === id) : null;
  if (!isWealthKind(kind) || (id && !row)) {
    return (
      <Screen hasHeader>
        {header('')}
        <EmptyState emoji="🔍" title={t('wealth.emptyList')} />
      </Screen>
    );
  }

  const initialValues = row
    ? fromWealthRecord(kind, row, prefs.homeCurrency)
    : defaultWealthValues(kind, prefs.homeCurrency);

  const remove = row
    ? async () => {
        const ok = await confirm({
          title: t('wealth.deleteTitle', { name: itemName(kind, row, t) }),
          message: t('wealth.deleteMessage'),
          confirmLabel: t('common.delete'),
          cancelLabel: t('common.cancel'),
          destructive: true,
        });
        if (!ok) return;
        haptics.warning();
        router.back();
        deleteWealthItem(kind, row.id);
      }
    : undefined;

  return (
    <>
      {header(row ? t('wealth.editTitle') : tKey(t, `wealth.add.${kind}`))}
      <WealthForm
        kind={kind}
        initialValues={initialValues}
        itemId={row?.id ?? null}
        today={today}
        onSaved={() => {
          toast({ message: t('form.saved') });
          router.back();
        }}
        onDelete={remove ? () => void remove() : undefined}
      />
    </>
  );
}
