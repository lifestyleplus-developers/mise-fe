import { OptionList } from '@/shared/components/option-list';
import { BottomSheet } from '@/shared/components/ui/bottom-sheet';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { format, useT } from '@/shared/i18n';
import { ChevronDown } from 'lucide-react-native';
import * as React from 'react';
import { Pressable } from 'react-native';

type OutletOption = { id: number; name: string };

type OutletChipProps = {
  name: string;
  onPress: () => void;
};

/** The outlet a screen is showing, "ZamZam ▾"; tap to change it. */
function OutletChip({ name, onPress }: OutletChipProps) {
  const t = useT();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={format(t('outlet.chip'), { name })}
      onPress={onPress}
      className="border-input-edge bg-card active:bg-accent min-h-11 max-w-full min-w-0 shrink flex-row items-center gap-1 self-start rounded-full border px-3.5"
    >
      <Text numberOfLines={1} className="font-sans-semibold shrink text-[13px]">
        {name}
      </Text>
      <ChevronDown className="text-foreground size-4 shrink-0" />
    </Pressable>
  );
}

type OutletSheetProps = {
  visible: boolean;
  outlets: readonly OutletOption[];
  value: number;
  onChange: (id: number) => void;
  onClose: () => void;
};

/** The outlets to choose from, one ticked. */
function OutletSheet({
  visible,
  outlets,
  value,
  onChange,
  onClose,
}: OutletSheetProps) {
  const t = useT();
  return (
    <BottomSheet
      visible={visible}
      title={t('home.outlet-sheet')}
      onDismiss={onClose}
      footer={
        <Button variant="outline" className="w-full" onPress={onClose}>
          <Text>{t('admin.cancel')}</Text>
        </Button>
      }
    >
      <OptionList
        value={String(value)}
        options={outlets.map((outlet) => ({
          value: String(outlet.id),
          label: outlet.name,
        }))}
        onChange={(id) => {
          onChange(Number(id));
          onClose();
        }}
      />
    </BottomSheet>
  );
}

type OutletPickerProps = {
  outlets: readonly OutletOption[];
  value: number;
  onChange: (id: number) => void;
};

/**
 * The chip and its sheet together. A business with one outlet has nothing to
 * choose, so nothing is drawn.
 */
function OutletPicker({ outlets, value, onChange }: OutletPickerProps) {
  const [open, setOpen] = React.useState(false);
  if (outlets.length < 2) return null;
  const current = outlets.find((outlet) => outlet.id === value) ?? outlets[0];
  return (
    <>
      <OutletChip name={current.name} onPress={() => setOpen(true)} />
      <OutletSheet
        visible={open}
        outlets={outlets}
        value={current.id}
        onChange={onChange}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

/**
 * Which outlet a screen is on. Starts on the first and falls back to it if the
 * chosen one disappears (module switched off, outlet archived).
 */
function useSelectedOutlet(outlets: readonly OutletOption[]) {
  const [id, setId] = React.useState<number | undefined>(undefined);
  const outlet = outlets.find((candidate) => candidate.id === id) ?? outlets[0];
  return [outlet as OutletOption | undefined, setId] as const;
}

export { OutletChip, OutletPicker, OutletSheet, useSelectedOutlet };
export type { OutletOption };
