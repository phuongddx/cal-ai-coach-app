/** Public surface of the networking module: typed clients over the shared contracts. */
export { apiRequest, isApiFailure, resolveBaseUrl } from './http';
export type { ApiFailure, ApiRequestOptions, BearerAuth } from './http';
export { LiveScanApi, buildScanRequest, isScanApiError } from './scanClient';
export type { CoachCalApi, ScanApiError, ScanRequestInput, ScanTelemetryEvent } from './scanClient';
export { createFetchSyncTransport, resolveApiConfig } from './syncClient';
export type { ApiConfig, SyncApiError, SyncTransportOptions } from './syncClient';
export { deleteAccount, isAccountError } from './accountClient';
export type { AccountError } from './accountClient';
