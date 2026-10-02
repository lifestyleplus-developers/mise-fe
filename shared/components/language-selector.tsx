import { INTERFACE_LANGUAGES } from '@/shared/constants/languages';
import { cn } from '@/shared/lib/utils';
import { Check, Globe } from 'lucide-react-native';
import * as React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

export type InterfaceLanguage = 'EN' | 'HI' | 'ML' | 'KN';

const LANGUAGES = INTERFACE_LANGUAGES;

type LanguageSelectorProps = {
  value: InterfaceLanguage;
  onChange: (language: InterfaceLanguage) => void;
  disabled?: boolean;
};

function LanguageSelector({
  value,
  onChange,
  disabled,
}: LanguageSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const current = LANGUAGES.find((l) => l.code === value) ?? LANGUAGES[0];

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`Language: ${current.label}`}
        className="border-input-edge bg-card active:bg-accent min-h-11 flex-row items-center gap-1.5 self-start rounded-full border px-3.5 disabled:opacity-60"
      >
        <Globe className="text-foreground size-[18px]" />
        <Text className="text-foreground font-sans-semibold text-[14px]">
          {current.label}
        </Text>
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          className="bg-scrim flex-1 justify-end"
          onPress={() => setOpen(false)}
          accessibilityLabel="Close"
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="border-border bg-card rounded-t-[1.75rem] border-t px-4 pt-2 pb-6"
          >
            <View className="bg-border mx-auto mb-3 h-1.5 w-10 rounded-full" />
            <Text className="font-display mb-3 px-1 text-[22px] leading-tight">
              Language
            </Text>
            <View className="border-border overflow-hidden rounded-3xl border">
              {LANGUAGES.map((language, index) => {
                const selected = language.code === value;
                return (
                  <Pressable
                    key={language.code}
                    onPress={() => {
                      onChange(language.code);
                      setOpen(false);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    className={cn(
                      'active:bg-accent min-h-14 flex-row items-center gap-3 px-4 py-2',
                      index > 0 && 'border-border border-t',
                    )}
                  >
                    <Text
                      className={cn(
                        'text-foreground min-w-0 flex-1 text-[16px]',
                        selected ? 'font-sans-bold' : 'font-sans-medium',
                      )}
                    >
                      {language.label}
                    </Text>
                    {selected ? (
                      <Check className="text-foreground size-5" />
                    ) : (
                      <View className="size-5" />
                    )}
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              onPress={() => setOpen(false)}
              className="border-border bg-card active:bg-accent mt-4 min-h-11 w-full items-center justify-center rounded-full border"
            >
              <Text className="text-foreground font-sans-semibold text-[14px]">
                Cancel
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export { LanguageSelector };
