/** Ember's offline chip: forced/network offline, or the last run could not reach the server (a retry is scheduled). */
export function isOfflineFrom(online: boolean, lastStatus: string): boolean {
  return !online || lastStatus === 'retryScheduled';
}
