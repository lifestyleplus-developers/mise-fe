import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { cn } from '@/shared/lib/utils';
import { Eye, EyeOff } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

type TextFieldProps = React.ComponentProps<typeof Input> & {
  label: string;
  /** Renders a show/hide toggle and treats the value as a password. */
  isPassword?: boolean;
  /** Starts with a password visible, for one a manager is setting. */
  initiallyShown?: boolean;
  showLabel?: string;
  hideLabel?: string;
  containerClassName?: string;
};

function TextField({
  label,
  isPassword = false,
  initiallyShown = false,
  showLabel = 'Show password',
  hideLabel = 'Hide password',
  containerClassName,
  className,
  ...props
}: TextFieldProps) {
  const id = React.useId();
  const [shown, setShown] = React.useState(initiallyShown);

  return (
    <View className={cn('flex flex-col gap-1.5', containerClassName)}>
      <Label nativeID={id}>{label}</Label>
      {isPassword ? (
        <View className="relative">
          <Input
            aria-labelledby={id}
            secureTextEntry={!shown}
            className={cn('pr-12', className)}
            {...props}
          />
          <Pressable
            onPress={() => setShown((prev) => !prev)}
            disabled={props.editable === false}
            accessibilityRole="button"
            accessibilityLabel={shown ? hideLabel : showLabel}
            className="absolute top-0.5 right-0.5 size-11 items-center justify-center rounded-full active:bg-accent disabled:opacity-60"
          >
            {shown ? (
              <EyeOff className="text-foreground size-5" />
            ) : (
              <Eye className="text-foreground size-5" />
            )}
          </Pressable>
        </View>
      ) : (
        <Input aria-labelledby={id} className={className} {...props} />
      )}
    </View>
  );
}

export { TextField };
export type { TextFieldProps };
