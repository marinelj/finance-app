import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { ChipGroup } from '@/components/form/ChipGroup';
import { SwitchRow } from '@/components/form/SwitchRow';
import { TextField } from '@/components/form/TextField';
import { Text } from '@/components/Text';
import { createCustomType } from '@/db/credit';
import type { CustomProductType } from '@/db/schema';
import { PRODUCT_KINDS, type ProductKind } from '@/domain/credit';
import { haptics } from '@/lib/haptics';

import { ColorPicker, EmojiPicker } from './AppearancePickers';

type CustomTypeSheetProps = {
  visible: boolean;
  onClose: () => void;
  onCreated: (type: CustomProductType) => void;
};

/** Creates a product type the app does not know, mapped onto one of the built-in kinds. */
export function CustomTypeSheet({ visible, onClose, onCreated }: CustomTypeSheetProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ProductKind>('installment_loan');
  const [hasGracePeriod, setHasGracePeriod] = useState(false);
  const [emoji, setEmoji] = useState('🧧');
  const [color, setColor] = useState('#E8457C');
  const [error, setError] = useState<string | undefined>();

  const create = () => {
    if (!name.trim()) {
      haptics.error();
      setError(t('customType.nameRequired'));
      return;
    }
    const type = createCustomType({ name, kind, hasGracePeriod, emoji, color });
    haptics.success();
    setName('');
    setError(undefined);
    onCreated(type);
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('customType.title')}
      footer={<Button label={t('customType.create')} fullWidth size="lg" onPress={create} />}>
      <TextField
        label={t('customType.name')}
        placeholder={t('customType.namePlaceholder')}
        value={name}
        onChangeText={(text) => {
          setName(text);
          setError(undefined);
        }}
        error={error}
        maxLength={24}
      />
      <Text variant="caption" tone="muted">
        {t('customType.behavesLike')}
      </Text>
      <ChipGroup
        accessibilityLabel={t('customType.behavesLike')}
        value={kind}
        onChange={(value) => {
          setKind(value);
          setHasGracePeriod(value === 'credit_card' || value === 'revolving_bnpl');
        }}
        options={PRODUCT_KINDS.map((value) => ({ value, label: t(`kinds.${value}`) }))}
      />
      {kind !== 'installment_loan' ? (
        <SwitchRow
          label={t('customType.gracePeriod')}
          value={hasGracePeriod}
          onChange={setHasGracePeriod}
        />
      ) : null}
      <EmojiPicker label={t('form.icon')} value={emoji} onChange={setEmoji} color={color} />
      <ColorPicker label={t('form.color')} value={color} onChange={setColor} />
    </BottomSheet>
  );
}
