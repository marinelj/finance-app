import { fireEvent, render, renderHook, screen } from '@testing-library/react-native';

import { BackNavigationProvider } from '@/lib/BackNavigationProvider';

import { StackBackButton } from '@/components/StackBackButton';
import { backFallback, useGoBack } from '../goBack';

let mockPathname = '/';
const mockRouter = {
  canGoBack: jest.fn(),
  back: jest.fn(),
  replace: jest.fn(),
  dismissAll: jest.fn(),
};
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, usePathname: () => mockPathname }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: () => 'Back' }) }));
jest.mock('@/components/Icon', () => ({ Icon: () => null }));

beforeEach(() => {
  jest.clearAllMocks();
});

it('pops existing navigation history without replacing the previous screen', async () => {
  mockRouter.canGoBack.mockReturnValue(true);
  const { result } = await renderHook(() => useGoBack('/credit'));
  result.current();
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
  expect(mockRouter.replace).not.toHaveBeenCalled();
});

it.each(['/credit', '/wealth', '/settings', '/'] as const)(
  'leaves a standalone page via %s',
  async (fallback) => {
    mockRouter.canGoBack.mockReturnValue(false);
    const { result } = await renderHook(() => useGoBack(fallback));
    result.current();
    expect(mockRouter.replace).toHaveBeenCalledWith(fallback);
    expect(mockRouter.back).not.toHaveBeenCalled();
  }
);

it('uses Home when no fallback is supplied', async () => {
  mockRouter.canGoBack.mockReturnValue(false);
  const { result } = await renderHook(() => useGoBack());
  result.current();
  expect(mockRouter.replace).toHaveBeenCalledWith('/');
});

it.each([
  ['product/[id]/index', '/credit'],
  ['/product/synthetic', '/credit'],
  ['wealth/[kind]/index', '/wealth'],
  ['/wealth/cash/edit', '/wealth'],
  ['settings/sync', '/settings'],
  ['/settings/backup', '/settings'],
  ['product/new', '/'],
  ['optimizer', '/'],
  ['plan', '/'],
  ['design-system', '/'],
])('maps %s to its fallback %s', (route, fallback) => {
  expect(backFallback(route)).toBe(fallback);
});

it('exposes one labelled Back control even without history', async () => {
  mockRouter.canGoBack.mockReturnValue(false);
  await render(<StackBackButton fallback="/settings" />);
  await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(mockRouter.replace).toHaveBeenCalledWith('/settings');
});

it('uses the owning tab for an initial deep link, then preserves history when that page is reopened', async () => {
  mockRouter.canGoBack.mockReturnValue(true);
  mockPathname = '/product/synthetic';
  const { result, rerender } = await renderHook(() => useGoBack('/credit'), {
    wrapper: BackNavigationProvider,
  });
  result.current();
  expect(mockRouter.dismissAll).toHaveBeenCalledTimes(1);
  expect(mockRouter.replace).toHaveBeenCalledWith('/credit');
  expect(mockRouter.back).not.toHaveBeenCalled();
  mockPathname = '/credit';
  await rerender(undefined);
  mockPathname = '/product/synthetic';
  await rerender(undefined);
  result.current();
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
});
