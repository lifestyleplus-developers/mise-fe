import { Banner, type BannerProps } from '@/shared/components/ui/banner';
import { useT } from '@/shared/i18n';
import * as React from 'react';
import { Animated, Easing } from 'react-native';

type AutoDismissBannerProps = Omit<BannerProps, 'onDismiss'> & {
  onDismiss: () => void;
  /** How long it stays before fading, in ms. */
  duration?: number;
};

/** A banner with a close button that fades itself away after `duration`. */
function AutoDismissBanner({
  onDismiss,
  duration = 5000,
  ...banner
}: AutoDismissBannerProps) {
  const t = useT();
  const opacity = React.useRef(new Animated.Value(1)).current;
  const dismiss = React.useRef(onDismiss);
  dismiss.current = onDismiss;

  React.useEffect(() => {
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
  }, [duration, opacity]);

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
