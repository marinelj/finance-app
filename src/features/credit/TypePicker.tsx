import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Appear } from '@/components/Appear';
import { Icon } from '@/components/Icon';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { mixHex } from '@/design/color';
import { useStyles, useTheme } from '@/design/theme';
import type { Theme } from '@/design/tokens';
import type { CustomProductType } from '@/db/schema';
import { PRESET_KEYS, PRODUCT_PRESETS, type PresetKey } from '@/domain/credit';

import { CustomTypeSheet } from './CustomTypeSheet';
import { ProductEmoji } from './ProductEmoji';

type TypePickerProps = {
  customTypes: CustomProductType[];
  onPickPreset: (preset: PresetKey) => void;
  onPickCustom: (type: CustomProductType) => void;
};

/** First step of adding a product: built-in presets, the user's own types, or a new type. */
export function TypePicker({ customTypes, onPickPreset, onPickCustom }: TypePickerProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [sheetOpen, setSheetOpen] = useState(false);

  let index = 0;
  return (
    <View style={styles.page}>
      <Text variant="title" accessibilityRole="header">
        {t('form.chooseType')}
      </Text>
      <Text variant="micro" tone="muted">
        {t('form.builtIn')}
      </Text>
      <View style={styles.grid}>
        {PRESET_KEYS.map((key) => {
          const preset = PRODUCT_PRESETS[key];
          return (
            <Appear key={key} index={index++} style={styles.cell}>
              <Tile
                emoji={preset.emoji}
                color={preset.color}
                title={t(`presets.${key}`)}
                subtitle={t(`presetHints.${key}`)}
                onPress={() => onPickPreset(key)}
              />
            </Appear>
          );
        })}
      </View>

      <Text variant="micro" tone="muted">
        {t('form.customTypes')}
      </Text>
      <View style={styles.grid}>
        {customTypes.map((type) => (
          <Appear key={type.id} index={index++} style={styles.cell}>
            <Tile
              emoji={type.emoji}
              color={type.color}
              title={type.name}
              subtitle={t(`kinds.${type.kind}`)}
              onPress={() => onPickCustom(type)}
            />
          </Appear>
        ))}
        <Appear index={index++} style={styles.cell}>
          <PressableScale
            onPress={() => setSheetOpen(true)}
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel={t('form.newCustomType')}
            accessibilityHint={t('form.newCustomTypeHint')}
            style={[styles.tile, styles.newTile]}>
            <View style={[styles.plus, { backgroundColor: colors.primarySoft }]}>
              <Icon name="add" size={24} color={colors.primaryText} />
            </View>
            <Text variant="callout" weight="700" tone="primary">
              {t('form.newCustomType')}
            </Text>
            <Text variant="caption" tone="muted" numberOfLines={2}>
              {t('form.newCustomTypeHint')}
            </Text>
          </PressableScale>
        </Appear>
      </View>

      <CustomTypeSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCreated={(type) => {
          setSheetOpen(false);
          onPickCustom(type);
        }}
      />
    </View>
  );
}

type TileProps = {
  emoji: string;
  color: string;
  title: string;
  subtitle: string;
  onPress: () => void;
};

function Tile({ emoji, color, title, subtitle, onPress }: TileProps) {
  const styles = useStyles(makeStyles);
  return (
    <PressableScale
      onPress={onPress}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      style={[styles.tile, { borderColor: mixHex(color, '#FFFFFF', 0.7) }]}>
      <ProductEmoji emoji={emoji} color={color} size={40} />
      <Text variant="callout" weight="700" numberOfLines={1}>
        {title}
      </Text>
      <Text variant="caption" tone="muted" numberOfLines={2}>
        {subtitle}
      </Text>
    </PressableScale>
  );
}

const makeStyles = ({ colors, radius, space, shadow }: Theme) =>
  StyleSheet.create({
    page: { gap: space.lg },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
    cell: { width: '47.5%', flexGrow: 1 },
    tile: {
      minHeight: 132,
      gap: space.xs,
      padding: space.lg,
      borderRadius: radius.lg,
      borderWidth: 1.5,
      backgroundColor: colors.surface,
      boxShadow: shadow.card,
    },
    newTile: { borderStyle: 'dashed', borderColor: colors.primary, boxShadow: undefined },
    plus: {
      width: 40,
      height: 40,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
