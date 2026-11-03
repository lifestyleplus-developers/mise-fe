import { RunPage } from '@/features/spot-checks/run-page';
import { useLocalSearchParams } from 'expo-router';

export default function CaptureRoute() {
  const { runId } = useLocalSearchParams<{ runId: string }>();
  return <RunPage runId={Number(runId)} backHref="/spot-checks" />;
}
