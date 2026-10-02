import { useMe } from '@/features/auth/use-me';
import { useSignOut } from '@/features/auth/use-sign-out';
import {
  useLanguageSaveState,
  useSetLanguage,
} from '@/features/settings/use-set-language';
import { PushedScreen } from '@/features/shell/pushed-screen';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { DescriptionList } from '@/shared/components/description-list';
import { OptionList } from '@/shared/components/option-list';
import { PendingPill } from '@/shared/components/pending-pill';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { INTERFACE_LANGUAGES } from '@/shared/constants/languages';
import { ROLE } from '@/shared/constants/roles';
import { useT, type MessageKey } from '@/shared/i18n';
import { useLanguageStore } from '@/shared/stores/language-store';
import { useThemeStore, type ThemeName } from '@/shared/stores/theme-store';
import { LogOut, TriangleAlert } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mx-4 mb-6">
      <Text
        accessibilityRole="header"
        className="font-sans-semibold mb-2 px-1 text-[13px] tracking-wide"
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

/**
 * Settings — language, profile, sign out (FE Spec §3.12). Theme sits beside
 * language because the login-screen toggle it replaces is gone once someone is
 * signed in; the mockup has no such section, so it is the one addition.
 *
 * Profile is read-only: names and passwords are changed by a manager (API
 * Contract §4 — no self-service edit, no email).
 */
export function SettingsScreen() {
  const { data: me } = useMe();
  const t = useT();
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useSetLanguage();
  const { waiting, unsaved } = useLanguageSaveState();
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const signOut = useSignOut();
  const [confirming, setConfirming] = React.useState(false);

  // Mid sign-out the identity is already cleared; PushedScreen renders
  // nothing in that frame too.
  if (!me) return null;

  const themes: { value: ThemeName; label: string }[] = [
    { value: 'light', label: t('theme.light') },
    { value: 'dark', label: t('theme.dark') },
  ];
  const roleKey = `role.${me.user.role}` as MessageKey;

  return (
    <PushedScreen title={t('more.settings')}>
      <Section title={t('language.title')}>
        <OptionList
          value={language}
          options={INTERFACE_LANGUAGES.map(({ code, label }) => ({
            value: code,
            label,
          }))}
          onChange={setLanguage}
        />
        {waiting ? (
          <View className="mt-2">
            <PendingPill label={t('language.waiting')} />
          </View>
        ) : null}
      </Section>

      <Section title={t('theme.title')}>
        <OptionList value={theme} options={themes} onChange={setTheme} />
      </Section>

      <Section title={t('settings.profile')}>
        <DescriptionList
          rows={[
            { label: t('profile.full-name'), value: me.user.full_name },
            { label: t('profile.username'), value: me.user.username },
            { label: t('profile.role'), value: t(roleKey) },
            { label: t('profile.business'), value: me.business.name },
          ]}
        />
        <Text className="mt-2 px-1 text-[13px] leading-snug">
          {t(
            me.user.role === ROLE.MEMBER
              ? 'profile.hint'
              : 'profile.hint-admin',
          )}
        </Text>
      </Section>

      <View className="mx-4">
        <Button
          variant="outline"
          onPress={() => setConfirming(true)}
          className="border-destructive/50 bg-card min-h-12 w-full px-5"
        >
          <LogOut className="text-destructive-soft-foreground size-[18px]" />
          <Text className="text-destructive-soft-foreground font-sans-semibold text-[15px]">
            {t('settings.sign-out')}
          </Text>
        </Button>
      </View>

      {/* Leaving with a language choice that has not reached the account
          loses it, so that case warns; otherwise it is a plain confirm. */}
      <ConfirmDialog
        visible={confirming}
        icon={unsaved ? TriangleAlert : LogOut}
        tone={unsaved ? 'warning' : 'neutral'}
        title={t('signout.title')}
        body={unsaved ? t('signout.queued.language') : undefined}
        safe={{
          label: unsaved ? t('signout.stay') : t('signout.cancel'),
          onPress: () => setConfirming(false),
        }}
        other={{
          label: unsaved ? t('signout.anyway') : t('signout.confirm'),
          onPress: () => {
            setConfirming(false);
            signOut();
          },
        }}
      />
    </PushedScreen>
  );
}
