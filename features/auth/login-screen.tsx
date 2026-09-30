import { mockLogin } from '@/features/auth/mock-login';
import { Banner } from '@/shared/components/ui/banner';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { ThemeToggle } from '@/shared/components/theme-toggle';
import { TextField } from '@/shared/components/ui/text-field';
import { LOGIN_FAILURE, type LoginFailure } from '@/shared/constants/errors';
import { THEME } from '@/shared/lib/theme';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

const ERROR_COPY: Record<LoginFailure, string> = {
  [LOGIN_FAILURE.INVALID_CREDENTIALS]: 'Username or password is wrong.',
  [LOGIN_FAILURE.RATE_LIMITED]: 'Too many tries. Wait a minute.',
  [LOGIN_FAILURE.UNREACHABLE]: "Can't reach mise. Try again.",
};

export function LoginScreen() {
  const { colorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<LoginFailure | null>(null);
  const [signedInAs, setSignedInAs] = React.useState<string | null>(null);

  const canSubmit =
    username.trim().length > 0 && password.length > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    const result = await mockLogin(username, password);

    setSubmitting(false);
    if (result.kind === 'ok') {
      setSignedInAs(result.persona);
      return;
    }
    if (result.kind === LOGIN_FAILURE.INVALID_CREDENTIALS) setPassword('');
    setError(result.kind);
  }

  if (signedInAs) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 px-8">
        <Text variant="h1">mise</Text>
        <Text className="text-center">Signed in as {signedInAs}.</Text>
        <Button variant="outline" onPress={() => setSignedInAs(null)}>
          <Text>Sign out</Text>
        </Button>
      </SafeAreaView>
    );
  }

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
          {error ? <Banner tone="error" message={ERROR_COPY[error]} /> : null}

          <TextField
            label="Username"
            value={username}
            onChangeText={setUsername}
            editable={!submitting}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
          />

          <TextField
            label="Password"
            isPassword
            showLabel="Show password"
            hideLabel="Hide password"
            value={password}
            onChangeText={setPassword}
            editable={!submitting}
            autoComplete="current-password"
          />

          <Button
            onPress={handleSubmit}
            disabled={!canSubmit}
            accessibilityState={{ busy: submitting }}
            className="mt-2 min-h-12 w-full"
          >
            {submitting ? (
              <>
                {/* ActivityIndicator takes a `color` prop and can't be reached
                    through className, so the token is read here directly. */}
                <ActivityIndicator
                  size="small"
                  color={THEME[colorScheme ?? 'light'].primaryForeground}
                />
                <Text>Signing in…</Text>
              </>
            ) : (
              <Text>Sign in</Text>
            )}
          </Button>

          <Text className="text-muted-foreground text-center text-[13px] leading-snug">
            Forgot your password? Ask your manager.
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
    </SafeAreaView>
  );
}
