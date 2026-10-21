import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useStyles, useTheme } from '@/design/theme';
import type { Theme } from '@/design/tokens';
import { deleteCustomType } from '@/db/credit';
import { CustomTypeSheet } from '@/features/credit/CustomTypeSheet';
import { ProductEmoji } from '@/features/credit/ProductEmoji';
import { confirm } from '@/lib/confirm';
import { haptics } from '@/lib/haptics';
import { useCreditData } from '@/state/creditData';

/** The user's own product types: list, create and delete. */
export default function ProductTypesScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { customTypes } = useCreditData();
  const [sheetOpen, setSheetOpen] = useState(false);

  const remove = async (id: string, name: string) => {
    const ok = await confirm({
      title: t('customType.deleteTitle', { name }),
      message: t('customType.deleteMessage'),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!ok) return;
    haptics.warning();
    deleteCustomType(id);
  };

  return (
    <Screen hasHeader>
      <Card style={styles.card}>
        {customTypes.length === 0 ? (
          <Text variant="callout" tone="muted">
            {t('settings.productTypesEmpty')}
          </Text>
        ) : (
          customTypes.map((type) => (
            <View key={type.id} style={styles.row}>
              <ProductEmoji emoji={type.emoji} color={type.color} size={40} />
              <View style={styles.flex}>
                <Text variant="body" weight="600">
                  {type.name}
                </Text>
                <Text variant="caption" tone="muted">
                  {t(`kinds.${type.kind}`)}
                </Text>
              </View>
              <Pressable
                onPress={() => void remove(type.id, type.name)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`${t('common.delete')} ${type.name}`}
                style={styles.delete}>
                <Icon name="trash-outline" size={20} color={colors.status.danger.text} />
              </Pressable>
            </View>
          ))
        )}
      </Card>
      <Button
        label={t('form.newCustomType')}
        icon="add"
        variant="secondary"
        onPress={() => setSheetOpen(true)}
        style={styles.center}
      />
      <CustomTypeSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCreated={() => setSheetOpen(false)}
      />
    </Screen>
  );
}

const makeStyles = ({ radius, space }: Theme) =>
  StyleSheet.create({
    card: { gap: space.md },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    flex: { flex: 1, gap: 2 },
    delete: { padding: space.sm, borderRadius: radius.pill },
    center: { alignSelf: 'center' },
  });
