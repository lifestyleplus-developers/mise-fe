import { Text } from '@/shared/components/ui/text';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { Check } from 'lucide-react-native';
import { ActivityIndicator, Pressable, View } from 'react-native';

type OutletRowProps = {
  /** Authored content: shown as typed. */
  name: string;
  /** What this outlet is doing or about to do, e.g. "Running · Kiran". */
  status: string;
  checked: boolean;
  disabled: boolean;
  /** A change is being applied to this row. */
  working: boolean;
  first: boolean;
  onToggle: () => void;
  /** Name a manager, or open the team. Absent when the row has neither. */
  action?: { label: string; ariaLabel: string; onPress: () => void };
};

/** One outlet in the list: a tick, its name and state, and what to do next. */
function OutletRow({
  name,
  status,
  checked,
  disabled,
  working,
  first,
  onToggle,
  action,
}: OutletRowProps) {
  return (
    <View
      className={cn(
        'flex-row flex-wrap items-center',
        !first && 'border-border border-t',
      )}
    >
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={`${name}, ${status}`}
        accessibilityState={{ checked, disabled }}
        disabled={disabled}
        onPress={onToggle}
        className={cn(
          'min-h-14 min-w-[10rem] flex-1 flex-row items-center gap-3 px-4 py-2',
          !disabled && 'active:bg-accent',
        )}
      >
        <View
          className={cn(
            'size-6 shrink-0 items-center justify-center rounded-lg border-2',
            checked ? 'border-primary bg-primary' : 'border-input-edge bg-card',
            disabled && 'opacity-60',
          )}
        >
          {checked ? (
            <Check className="text-primary-foreground size-4" />
          ) : null}
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-sans-medium text-[15px] leading-snug">
            {name}
          </Text>
          <Text className="mt-0.5 text-[13px] leading-snug">{status}</Text>
        </View>
      </Pressable>
      {action ? (
        <Button
          variant="outline"
          size="sm"
          className="mx-3 my-1 ml-auto w-[9.5rem] shrink-0"
          disabled={disabled}
          accessibilityLabel={action.ariaLabel}
          onPress={action.onPress}
        >
          <Text>{action.label}</Text>
        </Button>
      ) : null}
      {working ? <ActivityIndicator size="small" className="mr-3" /> : null}
    </View>
  );
}

export { OutletRow };
