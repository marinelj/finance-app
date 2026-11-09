import type { Href } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useGoBack } from '@/lib/goBack';

import { HeaderButton } from './HeaderButton';

/** One consistent chevron, including when a deep link has no navigation history. */
export function StackBackButton({ fallback }: { fallback: Href }) {
  const { t } = useTranslation();
  const goBack = useGoBack(fallback);
  return <HeaderButton icon="chevron-back" label={t('common.back')} onPress={goBack} />;
}
