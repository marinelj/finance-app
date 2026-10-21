import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { HeaderButton } from '@/components/HeaderButton';
import { Screen } from '@/components/Screen';
import { formValuesFromProduct } from '@/domain/productForm';
import { productTypeLabel } from '@/features/credit/labels';
import { ProductForm } from '@/features/credit/ProductForm';
import { useCreditData, useProduct } from '@/state/creditData';
import { useToast } from '@/state/toast';

export default function EditProductScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { customTypes, today } = useCreditData();
  const data = useProduct(id);

  const header = (
    <Stack.Screen
      options={{
        title: t('form.titleEdit'),
        headerLeft: () => <HeaderButton label={t('common.cancel')} onPress={() => router.back()} />,
      }}
    />
  );

  if (!data) {
    return (
      <>
        {header}
        <Screen hasHeader>
          <EmptyState emoji="🔍" title={t('product.notFound')} />
        </Screen>
      </>
    );
  }

  const { product, installments } = data;
  return (
    <>
      {header}
      <ProductForm
        initialValues={formValuesFromProduct(product, installments.length > 0, today)}
        existing={{ id: product.id, product, installments }}
        typeLabel={productTypeLabel(product, customTypes, t)}
        today={today}
        onSaved={() => {
          toast({ message: t('form.saved') });
          router.back();
        }}
      />
    </>
  );
}
