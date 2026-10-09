import { Banner, type BannerProps } from '@/shared/components/ui/banner';
import { useT } from '@/shared/i18n';
import * as React from 'react';
import { Animated, Easing } from 'react-native';

type AutoDismissBannerProps = Omit<BannerProps, 'onDismiss'> & {
  onDismiss: () => void;
  /** How long it stays before fading, in ms. */
  duration?: number;
  /**
   * Restarts the countdown when it changes. Defaults to the message, which
   * covers one notice replacing another; pass something that changes on every
   * occurrence where the *same* text can be raised twice.
   */
  resetKey?: string | number;
};

/** A banner with a close button that fades itself away after `duration`. */
function AutoDismissBanner({
  onDismiss,
  duration = 5000,
  resetKey,
  ...banner
}: AutoDismissBannerProps) {
  const t = useT();
  const [opacity] = React.useState(() => new Animated.Value(1));
  const dismiss = React.useRef(onDismiss);
  React.useEffect(() => {
    dismiss.current = onDismiss;
  });

  // React reuses this element for the next notice, so without restarting here
  // a second message would inherit the first's expiring countdown and flash
  // away. Resetting the opacity matters too: the element may already be
  // part-way through its fade.
  const restartOn = resetKey ?? banner.message;

  React.useEffect(() => {
    opacity.setValue(1);
    let fade: Animated.CompositeAnimation | undefined;
    const timer = setTimeout(() => {
      fade = Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      });
      fade.start(({ finished }) => {
        if (finished) dismiss.current();
      });
    }, duration);
    return () => {
      clearTimeout(timer);
      fade?.stop();
    };
  }, [duration, opacity, restartOn]);

  return (
    <Animated.View style={{ opacity }}>
      <Banner
        {...banner}
        onDismiss={onDismiss}
        dismissLabel={t('common.dismiss')}
      />
    </Animated.View>
  );
}

export { AutoDismissBanner };
