import { cn } from '@/shared/lib/utils';
import { Platform, TextInput } from 'react-native';

function Input({
  className,
  ...props
}: React.ComponentProps<typeof TextInput> & React.RefAttributes<TextInput>) {
  return (
    <TextInput
      className={cn(
        'border-input-edge bg-muted text-foreground placeholder:text-muted-foreground h-12 w-full flex-row items-center rounded-2xl border px-4 font-sans text-base',
        'focus:border-ring focus:ring-ring focus:ring-2',
        props.editable === false &&
          cn(
            'opacity-60',
            Platform.select({
              web: 'disabled:pointer-events-none disabled:cursor-not-allowed',
            }),
          ),
        className,
      )}
      {...props}
    />
  );
}

export { Input };
