/** True while an enabled query has not yet resolved (success or error). */
export function isQueryBootstrapping(
  enabled: boolean,
  query: { isSuccess: boolean; isError: boolean },
): boolean {
  return enabled && !query.isSuccess && !query.isError;
}
