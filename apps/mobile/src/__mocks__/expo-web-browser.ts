/** Manual Jest mock for `expo-web-browser`: every open call resolves "opened"; nothing leaves the process. */
export const WebBrowserResultType = { CANCEL: 'cancel', DISMISS: 'dismiss', OPENED: 'opened', LOCKED: 'locked' } as const;
export const WebBrowserPresentationStyle = {
  FULL_SCREEN: 'fullScreen',
  PAGE_SHEET: 'pageSheet',
  FORM_SHEET: 'formSheet',
  CURRENT_CONTEXT: 'currentContext',
  OVER_FULL_SCREEN: 'overFullScreen',
  OVER_CURRENT_CONTEXT: 'overCurrentContext',
  POPOVER: 'popover',
  AUTOMATIC: 'automatic',
} as const;

export const openBrowserAsync = jest.fn(async (_url: string) => ({ type: WebBrowserResultType.OPENED }));
export const openAuthSessionAsync = jest.fn(async (_url: string) => ({ type: WebBrowserResultType.CANCEL }));
export const dismissBrowser = jest.fn();
export const dismissAuthSession = jest.fn();
export const maybeCompleteAuthSession = jest.fn(() => ({ type: 'failed', message: 'mock' }));

export function __reset(): void {
  for (const fn of [openBrowserAsync, openAuthSessionAsync, dismissBrowser, dismissAuthSession, maybeCompleteAuthSession]) fn.mockClear();
}
