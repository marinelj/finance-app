import { useTranslation } from 'react-i18next';

import { Appear } from '@/components/Appear';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';

export default function CreditScreen() {
  const { t } = useTranslation();
  return (
    <Screen withTabBar title={t('credit.title')}>
      <Appear index={0}>
        <Card>
          <EmptyState
            emoji="💳"
            tone="pink"
            title={t('credit.emptyTitle')}
            message={t('credit.emptyMessage')}
          />
        </Card>
      </Appear>
    </Screen>
  );
}
