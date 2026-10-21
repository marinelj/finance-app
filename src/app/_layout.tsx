import '@/i18n';

import { DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider, useTheme } from '@/design/theme';
import { NotificationResponder, ReminderSync } from '@/features/credit/ReminderSync';
import { configureNotifications, notificationsSupported } from '@/lib/notifications';
import { CreditDataProvider } from '@/state/creditData';
import { DatabaseGate } from '@/state/DatabaseGate';
import { PreferencesProvider } from '@/state/preferences';
import { ToastProvider } from '@/state/toast';

// The splash screen stays up until the database is open (see DatabaseGate).
SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden, e.g. after a fast refresh.
});
configureNotifications();

function Navigation() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigationTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.hairline,
    },
  };

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerTintColor: colors.primaryText,
          headerTitleStyle: { color: colors.text },
          headerStyle: { backgroundColor: colors.background },
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.background },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="product/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="product/[id]/index" options={{ title: '' }} />
        <Stack.Screen name="product/[id]/edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="settings/fx" options={{ title: t('fx.title') }} />
        <Stack.Screen name="settings/types" options={{ title: t('settings.productTypes') }} />
        <Stack.Screen name="design-system" options={{ title: t('settings.designSystem') }} />
      </Stack>
      <ReminderSync />
      {notificationsSupported ? <NotificationResponder /> : null}
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <DatabaseGate>
            <PreferencesProvider>
              <CreditDataProvider>
                <ToastProvider>
                  <Navigation />
                </ToastProvider>
              </CreditDataProvider>
            </PreferencesProvider>
          </DatabaseGate>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
