import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type IconProps = {
  name: IconName;
  size?: number;
  color: string;
};

/** Decorative icon; the surrounding control carries the accessible label. */
export function Icon({ name, size = 20, color }: IconProps) {
  return (
    <Ionicons
      name={name}
      size={size}
      color={color}
      accessible={false}
      importantForAccessibility="no"
    />
  );
}
