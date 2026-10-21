import { Tabs } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';

import { TabBar } from '@/components/TabBar';
import { useTheme } from '@/design/theme';

export default function TabLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        animation: 'shift',
        sceneStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
      <Tabs.Screen name="credit" options={{ title: t('tabs.credit') }} />
      <Tabs.Screen name="wealth" options={{ title: t('tabs.wealth') }} />
      <Tabs.Screen name="settings" options={{ title: t('tabs.settings') }} />
    </Tabs>
  );
}
