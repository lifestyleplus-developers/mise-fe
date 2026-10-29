import { Camera, CircleCheck, Gauge } from 'lucide-react-native';
import type { ComponentType } from 'react';

/** One icon per answer type, so a row says what kind of answer it takes. */
export const TYPE_ICON: Record<
  'BINARY' | 'NUMBER' | 'IMAGE',
  ComponentType<{ className?: string }>
> = {
  BINARY: CircleCheck,
  NUMBER: Gauge,
  IMAGE: Camera,
};
