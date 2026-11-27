/**
 * Manual Jest mock for `expo-image-manipulator`: `manipulateAsync` echoes a fake JPEG result that
 * keeps the requested resize. The context API (`ImageManipulator.manipulate`) is not mocked: a unit
 * that uses it mocks it in its own test.
 */
const actual = jest.requireActual<typeof import('expo-image-manipulator')>('expo-image-manipulator');

export const manipulateAsync = jest.fn(
  async (uri: string, actions: { resize?: { width?: number; height?: number } }[] = [], options: { base64?: boolean } = {}) => {
    const resize = actions.find((a) => a.resize)?.resize;
    return {
      uri: `${uri}#manipulated`,
      width: resize?.width ?? 1024,
      height: resize?.height ?? resize?.width ?? 1024,
      ...(options.base64 ? { base64: 'bW9jaw==' } : {}),
    };
  },
);

export const SaveFormat = actual.SaveFormat;
export const FlipType = actual.FlipType;

export function __reset(): void {
  manipulateAsync.mockClear();
}
