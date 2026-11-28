import { useMutation, useQuery } from '@tanstack/react-query';

import { api } from '@/shared/api/client';
import { queryClient } from '@/shared/api/query-client';
import { retryTransient } from '@/shared/api/query-helpers';
import type { Incident, IncidentDetail } from '@/shared/api/types';

import { issueKeys, RESOLVE_KEY, type ResolveVariables } from './issue-keys';

const resolveMutationFn = ({
  incidentId,
}: ResolveVariables): Promise<Incident> => api.incidents.resolve(incidentId);

/**
 * POST /incidents/{id}/resolve — its defaults, so a resolve held while offline
 * can be replayed after the app restarts (AGENTS.md: setMutationDefaults where
 * the mutation is defined). The platform's answer is the truth: a resolved one
 * is left as it was, and the first resolver is kept.
 */
queryClient.setMutationDefaults(RESOLVE_KEY, {
  mutationFn: resolveMutationFn,
  onSuccess: (incident: Incident) => {
    queryClient.setQueryData<IncidentDetail>(
      issueKeys.detail(incident.id),
      (detail) => (detail ? { ...detail, ...incident } : detail),
    );
    // Open and Resolved both change, and so do the at-risk and report views.
    void queryClient.invalidateQueries({ queryKey: issueKeys.lists });
  },
});

/** One issue with its failed and missed tasks. */
export function useIncident(id: number) {
  return useQuery({
    queryKey: issueKeys.detail(id),
    queryFn: () => api.incidents.get(id),
    retry: retryTransient,
  });
}

/** "Mark resolved". It waits for a signal rather than failing (FE Spec §6). */
export function useResolveIncident() {
  return useMutation<Incident, Error, ResolveVariables>({
    mutationKey: RESOLVE_KEY,
    networkMode: 'online',
    mutationFn: resolveMutationFn,
  });
}
