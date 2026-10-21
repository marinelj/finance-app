import { useTranslation } from 'react-i18next';

import { Appear } from '@/components/Appear';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';

export default function WealthScreen() {
  const { t } = useTranslation();
  return (
    <Screen withTabBar title={t('wealth.title')}>
      <Appear index={0}>
        <Card>
          <EmptyState
            emoji="🌱"
            tone="mint"
            title={t('wealth.emptyTitle')}
            message={t('wealth.emptyMessage')}
          />
        </Card>
      </Appear>
    </Screen>
  );
}
