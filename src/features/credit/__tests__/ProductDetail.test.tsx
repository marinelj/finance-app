import { fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import ProductDetail from '@/app/product/[id]/index';
import type { ButtonProps } from '@/components/Button';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: 'synthetic' }),
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/state/preferences', () => ({
  usePreferences: () => ({ language: 'en', prefs: { hideAmounts: false } }),
}));
jest.mock('@/state/toast', () => ({ useToast: () => jest.fn() }));
jest.mock('@/state/creditData', () => ({
  useCreditData: () => ({ customTypes: [], today: '2026-11-06' }),
  useProduct: () => ({
    product: {
      id: 'synthetic',
      name: 'Synthetic card',
      issuer: 'Example',
      kind: 'credit_card',
      currency: 'CNY',
      balance: 0,
      creditLimit: 0,
      statementDay: 5,
      dueRule: 'fixed_day',
      dueDay: 23,
      isActive: true,
      hasGracePeriod: true,
      interestRate: null,
      interestRateUnit: null,
    },
    due: null,
    utilization: null,
    available: null,
    installments: [],
    payments: [],
    customType: null,
    latestBill: null,
  }),
}));
jest.mock('@/components/EmptyState', () => ({ EmptyState: () => null }));
jest.mock('@/components/HeaderButton', () => ({ HeaderButton: () => null }));
jest.mock('@/components/PressableScale', () => ({
  PressableScale: jest.requireActual('react-native').Pressable,
}));
jest.mock('@/components/Screen', () => ({ Screen: ({ children }: PropsWithChildren) => children }));
jest.mock('@/components/Appear', () => ({ Appear: ({ children }: PropsWithChildren) => children }));
jest.mock('@/components/Card', () => ({ Card: ({ children }: PropsWithChildren) => children }));
jest.mock('@/components/Button', () => ({
  Button: ({ label, onPress }: ButtonProps) => {
    const { Pressable, Text } = jest.requireActual('react-native');
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
        <Text>{label}</Text>
      </Pressable>
    );
  },
}));
jest.mock('@/components/BottomSheet', () => ({ BottomSheet: () => null }));
jest.mock('@/components/Icon', () => ({ Icon: () => null }));
jest.mock('@/components/ProgressRing', () => ({ ProgressRing: () => null }));
jest.mock('@/components/StatTile', () => ({ StatTile: () => null }));
jest.mock('@/features/credit/PaymentSheet', () => ({ PaymentSheet: () => null }));
jest.mock('@/features/credit/ProductCard', () => ({ ProductCard: () => null }));
jest.mock('@/design/motion', () => ({ useMotion: () => ({ reduceMotion: true }) }));

it('exposes a body Edit action even when the native header is absent', async () => {
  await render(<ProductDetail />);
  await fireEvent.press(screen.getByRole('button', { name: 'common.edit' }));
  expect(mockPush).toHaveBeenLastCalledWith({
    pathname: '/product/[id]/edit',
    params: { id: 'synthetic' },
  });
});
it('opens the billing section from either billing-day detail row', async () => {
  await render(<ProductDetail />);
  for (const key of ['product.statementDay', 'product.dueDay']) {
    await fireEvent.press(screen.getByText(key));
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/product/[id]/edit',
      params: { id: 'synthetic', section: 'billing' },
    });
  }
});
