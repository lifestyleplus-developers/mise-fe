import { RunResultsScreen } from '@/features/spot-checks/run-results-screen';
import { useLocalSearchParams } from 'expo-router';

export default function ResultsRunRoute() {
  const { runId } = useLocalSearchParams<{ runId: string }>();
  return <RunResultsScreen runId={Number(runId)} />;
}
