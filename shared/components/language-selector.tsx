import { OptionList } from '@/shared/components/option-list';
import { BottomSheet } from '@/shared/components/ui/bottom-sheet';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import {
  INTERFACE_LANGUAGES,
  type InterfaceLanguage,
} from '@/shared/constants/languages';
import { useT } from '@/shared/i18n';
import { Globe } from 'lucide-react-native';
import * as React from 'react';
import { Pressable } from 'react-native';

type LanguageSelectorProps = {
  value: InterfaceLanguage;
  onChange: (language: InterfaceLanguage) => void;
  disabled?: boolean;
};

/** A pill showing the current language; tapping it opens the list. */
function LanguageSelector({
  value,
  onChange,
  disabled,
}: LanguageSelectorProps) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const current =
    INTERFACE_LANGUAGES.find((language) => language.code === value) ??
    INTERFACE_LANGUAGES[0];

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${t('language.title')}: ${current.label}`}
        className="border-input-edge bg-card active:bg-accent h-11 flex-row items-center gap-1.5 rounded-full border px-3.5 disabled:opacity-60"
      >
        <Globe className="text-foreground size-[18px]" />
        <Text className="font-sans-semibold text-[14px]">{current.label}</Text>
      </Pressable>

      <BottomSheet
        visible={open}
        title={t('language.title')}
        onDismiss={() => setOpen(false)}
        footer={
          <Button
            variant="outline"
            className="w-full"
            onPress={() => setOpen(false)}
          >
            <Text>{t('admin.cancel')}</Text>
          </Button>
        }
      >
        <OptionList
          value={value}
          options={INTERFACE_LANGUAGES.map(({ code, label }) => ({
            value: code,
            label,
          }))}
          onChange={(language) => {
            onChange(language);
            setOpen(false);
          }}
        />
      </BottomSheet>
    </>
  );
}

export { LanguageSelector };
