import { render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import ProductDetail from '@/app/product/[id]/index';
import type { ButtonProps } from '@/components/Button';

const mockPush = jest.fn();
let mockParams: { id: string; section?: string } = { id: 'synthetic' };
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/state/preferences', () => ({
  usePreferences: () => ({ language: 'en', prefs: { hideAmounts: false } }),
}));
const mockToast = jest.fn();
jest.mock('@/state/toast', () => ({ useToast: () => mockToast }));
const mockFormProps = jest.fn();
jest.mock('@/features/credit/ProductForm', () => ({
  ProductForm: (props: PropsWithChildren<Record<string, unknown>>) => {
    mockFormProps(props);
    return props.children;
  },
}));
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

beforeEach(() => {
  mockParams = { id: 'synthetic' };
  jest.clearAllMocks();
});

it('opens straight into the edit form, with no separate Edit button', async () => {
  await render(<ProductDetail />);
  const props = mockFormProps.mock.calls.at(-1)![0];
  expect(props.existing.id).toBe('synthetic');
  expect(props.initialValues.name).toBe('Synthetic card');
  expect(props.initialSection).toBeUndefined();
  expect(screen.queryByRole('button', { name: 'common.edit' })).toBeNull();
  // Payments stay on the same page, below the fields.
  expect(screen.getByRole('button', { name: 'product.markPaid' })).toBeTruthy();
});

it('saves in place: a toast, and no navigation away', async () => {
  await render(<ProductDetail />);
  mockFormProps.mock.calls.at(-1)![0].onSaved('synthetic');
  expect(mockToast).toHaveBeenCalledWith({ message: 'form.saved' });
  expect(mockPush).not.toHaveBeenCalled();
});

it('honours the billing section link from older routes', async () => {
  mockParams = { id: 'synthetic', section: 'billing' };
  await render(<ProductDetail />);
  expect(mockFormProps.mock.calls.at(-1)![0].initialSection).toBe('billing');
});
