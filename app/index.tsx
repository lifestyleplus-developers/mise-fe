import { Banner } from '@/shared/components/ui/banner';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { TextField } from '@/shared/components/ui/text-field';
import {
  InterfaceLanguage,
  LanguageSelector,
} from '@/shared/components/language-selector';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  View,
} from 'react-native';

// primary-foreground token, resolved manually — ActivityIndicator's `color`
// prop isn't reachable through className the way View/Text colors are.
const PRIMARY_FOREGROUND = { light: '#faf9f5', dark: '#111113' };

/**
 * Mirrors mise-week-01.html's mock login fixture: known member usernames
 * sign in with any password; specific usernames/passwords exercise the
 * other documented error states (API Contract §2, §15).
 */
const KNOWN_MEMBERS = ['priya', 'raheem', 'suresh', 'meera', 'nadia'];

type LoginResult =
  | { kind: 'ok'; persona: string }
  | { kind: 'invalid_credentials' }
  | { kind: 'rate_limited' }
  | { kind: 'unreachable' };

function resolveMockLogin(username: string, password: string): LoginResult {
  const normalized = username.trim().toLowerCase();
  if (normalized === 'offline') return { kind: 'unreachable' };
  if (normalized === 'busy') return { kind: 'rate_limited' };
  if (KNOWN_MEMBERS.includes(normalized) && password !== 'wrong') {
    return { kind: 'ok', persona: normalized };
  }
  return { kind: 'invalid_credentials' };
}

const ERROR_COPY: Record<Exclude<LoginResult['kind'], 'ok'>, string> = {
  invalid_credentials: 'Username or password is wrong.',
  rate_limited: 'Too many tries. Wait a minute.',
  unreachable: "Can't reach mise. Try again.",
};

export default function LoginScreen() {
  const { colorScheme } = useColorScheme();
  const [language, setLanguage] = React.useState<InterfaceLanguage>('EN');
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<Exclude<
    LoginResult['kind'],
    'ok'
  > | null>(null);
  const [signedInAs, setSignedInAs] = React.useState<string | null>(null);

  const canSubmit =
    username.trim().length > 0 && password.length > 0 && !submitting;

  function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    // Fixed 700ms delay, matching the mockup — long enough to see the
    // loading state, short enough not to feel broken.
    setTimeout(() => {
      const result = resolveMockLogin(username, password);
      setSubmitting(false);
      if (result.kind === 'ok') {
        setSignedInAs(result.persona);
        return;
      }
      if (result.kind === 'invalid_credentials') setPassword('');
      setError(result.kind);
    }, 700);
  }

  if (signedInAs) {
    return (
      <SafeAreaView className="bg-background flex-1 items-center justify-center gap-4 px-8">
        <Text variant="h1">mise</Text>
        <Text className="text-center">Signed in as {signedInAs}.</Text>
        <Button variant="outline" onPress={() => setSignedInAs(null)}>
          <Text>Sign out</Text>
        </Button>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="bg-background flex-1">
      <ScrollView
        contentContainerClassName="flex-grow"
        keyboardShouldPersistTaps="handled"
      >
        <View className="h-11 shrink-0 flex-row items-center justify-end px-4">
          <LanguageSelector
            value={language}
            onChange={setLanguage}
            disabled={submitting}
          />
        </View>

        <Text className="mt-8 mb-8 text-center text-[44px] leading-none tracking-tight">
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
                <ActivityIndicator
                  size="small"
                  color={PRIMARY_FOREGROUND[colorScheme ?? 'light']}
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
    </SafeAreaView>
  );
}
