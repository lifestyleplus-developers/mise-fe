import { Input } from '@/shared/components/ui/input';
import { Search, X } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

type SearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  clearLabel: string;
};

/** A pill search box with a clear button once there is text. */
function SearchField({
  value,
  onChange,
  placeholder,
  clearLabel,
}: SearchFieldProps) {
  const [focused, setFocused] = React.useState(false);
  return (
    <View className="relative justify-center">
      {focused ? null : (
        <View
          pointerEvents="none"
          className="absolute inset-y-0 left-4 z-10 justify-center"
        >
          <Search className="text-muted-foreground size-5" />
        </View>
      )}
      <Input
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        accessibilityLabel={placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        className="bg-card rounded-full"
        style={{ paddingLeft: focused ? 20 : 44, paddingRight: 48 }}
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={clearLabel}
          onPress={() => onChange('')}
          className="active:bg-accent absolute top-0.5 right-0.5 size-11 items-center justify-center rounded-full"
        >
          <X className="text-foreground size-5" />
        </Pressable>
      ) : null}
    </View>
  );
}

export { SearchField };
