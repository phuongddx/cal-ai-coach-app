/** Manual Jest mock for `expo-sharing`: the share sheet is available and resolves at once. */
export const isAvailableAsync = jest.fn(async () => true);
export const shareAsync = jest.fn(async (_url: string, _options?: Record<string, unknown>): Promise<void> => undefined);

export function __reset(): void {
  isAvailableAsync.mockClear();
  shareAsync.mockClear();
}
