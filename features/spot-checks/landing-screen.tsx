import { PlaceholderCard } from '@/features/shell/placeholder';
import { PushedScreen } from '@/features/shell/pushed-screen';
import { useT } from '@/shared/i18n';

import { SpotCheckLinks } from './spot-check-links';

/**
 * The Spot checks entry. Stands in for the capture screen (SPT-01) until it is built;
 * the links under the title are the real ones, so every other screen can be reached.
 */
export function SpotChecksLandingScreen() {
  const t = useT();
  return (
    <PushedScreen title={t('modules.spot-checks')} backHref="/modules">
      <SpotCheckLinks />
      <PlaceholderCard name={t('modules.spot-checks')} />
    </PushedScreen>
  );
}
