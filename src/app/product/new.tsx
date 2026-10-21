import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { HeaderButton } from '@/components/HeaderButton';
import { Screen } from '@/components/Screen';
import type { CustomProductType } from '@/db/schema';
import type { PresetKey } from '@/domain/credit';
import { defaultFormValues } from '@/domain/productForm';
import { ProductForm } from '@/features/credit/ProductForm';
import { notifyPermissionChanged } from '@/features/credit/ReminderSync';
import { TypePicker } from '@/features/credit/TypePicker';
import { requestNotificationPermission } from '@/lib/notifications';
import { useCreditData } from '@/state/creditData';
import { usePreferences } from '@/state/preferences';
import { useToast } from '@/state/toast';

type Choice = { preset: PresetKey } | { customType: CustomProductType };

/** Add a product: pick a type, then fill in the form. */
export default function NewProductScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { prefs } = usePreferences();
  const { customTypes, products, today } = useCreditData();
  const [choice, setChoice] = useState<Choice | null>(null);

  const close = () => router.back();

  if (!choice) {
    return (
      <>
        <Stack.Screen
          options={{
            title: t('form.titleNew'),
            headerLeft: () => <HeaderButton label={t('common.cancel')} onPress={close} />,
          }}
        />
        <Screen hasHeader>
          <TypePicker
            customTypes={customTypes}
            onPickPreset={(preset) => setChoice({ preset })}
            onPickCustom={(customType) => setChoice({ customType })}
          />
        </Screen>
      </>
    );
  }

  const isPreset = 'preset' in choice;
  const typeLabel = isPreset ? t(`presets.${choice.preset}`) : choice.customType.name;
  const named = isPreset && choice.preset !== 'credit_card' && choice.preset !== 'other';
  const initialValues = defaultFormValues({
    ...(isPreset ? { preset: choice.preset } : { customType: choice.customType }),
    name: named ? typeLabel : '',
    homeCurrency: prefs.homeCurrency,
    today,
  });

  return (
    <>
      <Stack.Screen
        options={{
          title: typeLabel,
          headerLeft: () => (
            <HeaderButton
              label={t('common.back')}
              icon="chevron-back"
              onPress={() => setChoice(null)}
            />
          ),
        }}
      />
      <ProductForm
        initialValues={initialValues}
        typeLabel={typeLabel}
        today={today}
        onSaved={() => {
          const first = products.length === 0;
          toast({ message: t('form.saved'), aboveTabBar: true });
          router.back();
          // Ask for notification permission once there is something to remind about.
          if (first && prefs.reminders.enabled) {
            void requestNotificationPermission(t('reminders.channel')).then(
              notifyPermissionChanged
            );
          }
        }}
      />
    </>
  );
}
