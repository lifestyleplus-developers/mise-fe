import { Text } from '@/shared/components/ui/text';
import { View } from 'react-native';

/** A person's initials in a ring. */
function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="border-foreground/70 size-10 shrink-0 items-center justify-center rounded-full border"
    >
      <Text className="font-sans-bold text-[12px]">{initials}</Text>
    </View>
  );
}

export { Avatar };
