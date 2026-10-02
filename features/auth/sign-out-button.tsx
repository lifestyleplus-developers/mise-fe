import { useSignOut } from '@/features/auth/use-sign-out';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { useT } from '@/shared/i18n';

/** Sign out, until Settings (FE Spec §3.12) exists to own it. */
export function SignOutButton() {
  const t = useT();
  const signOut = useSignOut();
  return (
    <Button variant="outline" onPress={signOut}>
      <Text>{t('settings.sign-out')}</Text>
    </Button>
  );
}
