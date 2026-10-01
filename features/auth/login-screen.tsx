import { BusinessPicker } from '@/features/auth/business-picker';
import { useLogin } from '@/features/auth/use-login';
import { Button } from '@/shared/components/ui/button';
import { ModalDialog } from '@/shared/components/ui/modal';
import { Text } from '@/shared/components/ui/text';
import { ThemeToggle } from '@/shared/components/theme-toggle';
import { TextField } from '@/shared/components/ui/text-field';
import { LOGIN_FAILURE, type LoginFailure } from '@/shared/constants/errors';
import { THEME } from '@/shared/lib/theme';
import { useT, type MessageKey } from '@/shared/i18n';
import { Redirect } from 'expo-router';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { ActivityIndicator, ScrollView, TextInput, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

/**
 * Failure → catalogue key. A Record over the failure union, so the compiler
 * errors the moment a failure code lacks a message — the copy table the
 * error modal reads from. Switch on code, never on message (§15).
 */
const ERROR_KEY: Record<LoginFailure, MessageKey> = {
  [LOGIN_FAILURE.INVALID_CREDENTIALS]: 'login.err.invalid',
  [LOGIN_FAILURE.RATE_LIMITED]: 'login.err.rate-limited',
  [LOGIN_FAILURE.UNREACHABLE]: 'login.err.unreachable',
};

export function LoginScreen() {
  const { colorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  // One state machine: the screen renders `state` and never holds async
  // state of its own (issues 4, 9 and 11 all close on this).
  const { state, login, chooseBusiness, resetLogin } = useLogin();
  const t = useT();

  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  // Refocus target after a failed attempt — issue 6 in login-issues.md.
  // Ref passes straight through TextField → Input → TextInput on React 19;
  // no forwarding code needed in the primitives.
  const passwordRef = React.useRef<TextInput>(null);

  const isSubmitting = state.kind === 'submitting';
  const canSubmit =
    username.trim().length > 0 && password.length > 0 && !isSubmitting;

  function handleSubmit() {
    if (!canSubmit) return;
    login({ username, password });
  }

  function dismissError() {
    // The mockup refocused the password field on an invalid result; with the
    // error in a modal, the dismiss is the moment to do it — focusing while
    // the dialog is still up leaves the keyboard fighting the modal on
    // Android. By the time OK (or a backdrop tap) lands, the cursor is
    // already in the field: dismiss and type. Invalid only — the password is
    // only cleared on that failure, and the field the user is correcting is
    // the one that gets focus.
    const wasInvalid =
      state.kind === 'failure' &&
      state.failure === LOGIN_FAILURE.INVALID_CREDENTIALS;
    if (wasInvalid) setPassword('');
    resetLogin();
    if (wasInvalid) passwordRef.current?.focus();
  }

  // Signed in — §2: Home is the entry point for every role. Redirect rather
  // than push, so Back from Home never lands on a signed-in login form.
  if (state.kind === 'ok') return <Redirect href="/home" />;

  return (
    <SafeAreaView className="flex-1">
      {/* pb-16 lifts the centred wordmark+card group 32pt above true centre —
          dead-centre content reads as sitting low, and with the toggle strip
          floated (below) nothing pushes the group down any more. */}
      <ScrollView
        contentContainerClassName="flex-grow justify-center pb-16"
        keyboardShouldPersistTaps="handled"
      >
        {/* The wordmark and card are centred as one group, so the wordmark
            carries no top margin — only the gap down to the card. */}
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
                {/* ActivityIndicator takes a `color` prop and can't be reached
                    through className, so the token is read here directly. */}
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

      {/* The mockup's language-pill slot, holding the theme toggle until
          Settings exists to take it. Floated after the ScrollView — later
          siblings paint on top — so the strip takes no layout space. Absolute
          positioning ignores the SafeAreaView's padding, so the top inset is
          applied by hand; box-none lets taps fall through to the card except
          on the button itself. */}
      <View
        className="absolute inset-x-0 top-0"
        style={{ paddingTop: insets.top }}
        pointerEvents="box-none"
      >
        <View
          className="h-11 flex-row items-center justify-end px-4"
          pointerEvents="box-none"
        >
          <ThemeToggle />
        </View>
      </View>

      {/* Failures surface as a modal rather than inline: the banner cost the
          card a row on every error and pushed the fields mid-correction. */}
      <ModalDialog
        visible={state.kind === 'failure'}
        title={t('login.err.title')}
        message={state.kind === 'failure' ? t(ERROR_KEY[state.failure]) : ''}
        actionLabel={t('common.ok')}
        onDismiss={dismissError}
      />

      {/* 409 — a username that exists in more than one business. The picker
          stays up while the chosen business's sign-in is in flight. */}
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
