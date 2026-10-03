import { BusinessPicker } from '@/features/auth/business-picker';
import { useLogin } from '@/features/auth/use-login';
import { LanguageSelector } from '@/shared/components/language-selector';
import { Button } from '@/shared/components/ui/button';
import { ModalDialog } from '@/shared/components/ui/modal';
import { Text } from '@/shared/components/ui/text';
import { ThemeToggle } from '@/shared/components/theme-toggle';
import { TextField } from '@/shared/components/ui/text-field';
import { LOGIN_FAILURE, type LoginFailure } from '@/shared/constants/errors';
import { THEME } from '@/shared/lib/theme';
import { useT, type MessageKey } from '@/shared/i18n';
import { useLanguageStore } from '@/shared/stores/language-store';
import { Redirect } from 'expo-router';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { ActivityIndicator, ScrollView, TextInput, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

/** Failure → catalogue key. */
const ERROR_KEY: Record<LoginFailure, MessageKey> = {
  [LOGIN_FAILURE.INVALID_CREDENTIALS]: 'login.err.invalid',
  [LOGIN_FAILURE.RATE_LIMITED]: 'login.err.rate-limited',
  [LOGIN_FAILURE.UNREACHABLE]: 'login.err.unreachable',
};

export function LoginScreen() {
  const { colorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  const { state, login, chooseBusiness, resetLogin } = useLogin();
  const t = useT();
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);

  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const passwordRef = React.useRef<TextInput>(null);

  const isSubmitting = state.kind === 'submitting';
  const canSubmit =
    username.trim().length > 0 && password.length > 0 && !isSubmitting;

  function handleSubmit() {
    if (!canSubmit) return;
    login({ username, password });
  }

  function dismissError() {
    const wasInvalid =
      state.kind === 'failure' &&
      state.failure === LOGIN_FAILURE.INVALID_CREDENTIALS;
    if (wasInvalid) setPassword('');
    resetLogin();
    if (wasInvalid) passwordRef.current?.focus();
  }

  if (state.kind === 'ok') return <Redirect href="/home" />;

  return (
    <SafeAreaView className="flex-1">
      <ScrollView
        contentContainerClassName="flex-grow justify-center pb-16"
        keyboardShouldPersistTaps="handled"
      >
        <Text className="font-display mb-8 text-center text-[44px] leading-none tracking-[-0.015em]">
          mise
        </Text>

        <View className="shadow-card border-border bg-card mx-4 flex flex-col gap-4 rounded-[1.75rem] border p-6">
          <TextField
            label={t('login.username')}
            value={username}
            onChangeText={setUsername}
            editable={!isSubmitting}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
          />

          <TextField
            ref={passwordRef}
            label={t('login.password')}
            isPassword
            showLabel={t('login.show-password')}
            hideLabel={t('login.hide-password')}
            value={password}
            onChangeText={setPassword}
            editable={!isSubmitting}
            autoComplete="current-password"
          />

          <Button
            onPress={handleSubmit}
            disabled={!canSubmit}
            accessibilityState={{ busy: isSubmitting }}
            className="mt-2 min-h-12 w-full"
          >
            {isSubmitting ? (
              <>
                <ActivityIndicator
                  size="small"
                  color={THEME[colorScheme ?? 'light'].primaryForeground}
                />
                <Text>{t('login.signing-in')}</Text>
              </>
            ) : (
              <Text>{t('login.sign-in')}</Text>
            )}
          </Button>

          <Text className="text-muted-foreground text-center text-[13px] leading-snug">
            {t('login.forgot-password')}
          </Text>
        </View>
      </ScrollView>

      <View
        className="absolute inset-x-0 top-0"
        style={{ paddingTop: insets.top }}
        pointerEvents="box-none"
      >
        <View
          className="h-11 flex-row items-center justify-end gap-2 px-4"
          pointerEvents="box-none"
        >
          <ThemeToggle />
          <LanguageSelector value={language} onChange={setLanguage} />
        </View>
      </View>

      <ModalDialog
        visible={state.kind === 'failure'}
        title={t('login.err.title')}
        message={state.kind === 'failure' ? t(ERROR_KEY[state.failure]) : ''}
        actionLabel={t('common.ok')}
        onDismiss={dismissError}
      />

      <BusinessPicker
        visible={state.kind === 'ambiguous_username'}
        businesses={state.kind === 'ambiguous_username' ? state.businesses : []}
        choosingId={
          state.kind === 'ambiguous_username' ? state.choosingId : null
        }
        onChoose={chooseBusiness}
        onCancel={resetLogin}
      />
    </SafeAreaView>
  );
}
