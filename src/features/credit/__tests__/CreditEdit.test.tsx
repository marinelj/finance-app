import { fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren, ReactNode } from 'react';

import CreditScreen from '@/app/(tabs)/credit';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { name?: string }) =>
      key === 'credit.editProduct' ? `Edit ${values?.name}` : key,
  }),
}));
jest.mock('@/state/preferences', () => ({
  usePreferences: () => ({ language: 'en', prefs: { homeCurrency: 'CNY', hideAmounts: false } }),
}));
jest.mock('@/state/creditData', () => ({
  useCreditData: () => ({
    statuses: [
      {
        product: {
          id: 'synthetic',
          name: 'Synthetic card',
          issuer: 'Example',
          kind: 'credit_card',
          currency: 'CNY',
          balance: 0,
          emoji: '💳',
          color: '#336699',
          isActive: true,
        },
        due: null,
      },
    ],
    summary: { dueThisMonth: 0, dueThisMonthCount: 0, totalOwed: 0, utilization: null },
    customTypes: [],
    today: '2026-11-06',
  }),
}));
jest.mock('@/features/credit/CardDeck', () => ({
  CardDeck: ({
    items,
    renderCard,
    onPress,
  }: {
    items: unknown[];
    renderCard: (item: unknown, isFront: boolean) => ReactNode;
    onPress: (item: unknown) => void;
  }) => {
    const { Pressable } = jest.requireActual('react-native');
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open deck card"
        onPress={() => onPress(items[0])}>
        {renderCard(items[0], true)}
      </Pressable>
    );
  },
}));
jest.mock('@/components/Screen', () => ({ Screen: ({ children }: PropsWithChildren) => children }));
jest.mock('@/components/Appear', () => ({ Appear: ({ children }: PropsWithChildren) => children }));
jest.mock('@/components/Card', () => ({ Card: ({ children }: PropsWithChildren) => children }));
jest.mock('@/components/PressableScale', () => ({
  PressableScale: jest.requireActual('react-native').Pressable,
}));
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: jest.requireActual('react-native').View,
}));
jest.mock('@/components/EmptyState', () => ({ EmptyState: () => null }));
jest.mock('@/components/DueBadge', () => ({ DueBadge: () => null }));
jest.mock('@/components/AmountText', () => ({ AmountText: () => null }));
jest.mock('@/components/Icon', () => ({ Icon: () => null }));
jest.mock('@/components/SectionHeader', () => ({ SectionHeader: () => null }));

beforeEach(() => mockPush.mockClear());

it.each([
  ['deck', 0],
  ['row', 1],
] as const)('edits directly from the %s pencil without opening details', async (_, index) => {
  await render(<CreditScreen />);
  const button = screen.getAllByRole('button', { name: 'Edit Synthetic card' })[index];
  expect(button).toHaveStyle({ width: 44, height: 44 });
  const stopPropagation = jest.fn();
  await fireEvent.press(button, { stopPropagation });
  expect(stopPropagation).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/product/[id]/edit',
    params: { id: 'synthetic' },
  });
});

it('still opens details from the rest of the deck card or list row', async () => {
  await render(<CreditScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Open deck card' }));
  await fireEvent.press(screen.getByRole('button', { name: /^Synthetic card,/ }));
  expect(mockPush).toHaveBeenCalledTimes(2);
  expect(mockPush).toHaveBeenNthCalledWith(1, {
    pathname: '/product/[id]',
    params: { id: 'synthetic' },
  });
  expect(mockPush).toHaveBeenNthCalledWith(2, {
    pathname: '/product/[id]',
    params: { id: 'synthetic' },
  });
});
