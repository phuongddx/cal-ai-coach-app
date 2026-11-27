jest.mock('react', () => {
  const rnPath: string = (require as unknown as { resolve: (id: string) => string }).resolve('react-native');
  const root = rnPath.slice(0, rnPath.indexOf('/react-native/'));
  return jest.requireActual(`${root}/react`);
});
jest.mock('react/jsx-runtime', () => {
  const rnPath: string = (require as unknown as { resolve: (id: string) => string }).resolve('react-native');
  const root = rnPath.slice(0, rnPath.indexOf('/react-native/'));
  return jest.requireActual(`${root}/react/jsx-runtime`);
});

import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { DEFAULT_DEBUG_FLAGS } from '../debug/launchArgs';
import { AppEnvironmentProvider, useAppEnvironment, type AppEnvironment } from './appEnvironment';
import { createTelemetry } from './telemetry';

function fakeEnvironment(overrides: Partial<AppEnvironment> = {}): AppEnvironment {
  return {
    data: async () => {
      throw new Error('not used');
    },
    session: {} as AppEnvironment['session'],
    createApi: () => ({}) as ReturnType<AppEnvironment['createApi']>,
    now: () => new Date(0),
    flags: () => DEFAULT_DEBUG_FLAGS,
    telemetry: createTelemetry(),
    openScan: jest.fn(),
    resetLocalData: jest.fn(async () => undefined),
    ...overrides,
  };
}

function Probe() {
  const environment = useAppEnvironment();
  return <Text testID="probe">{`${environment.now().getTime()}:${environment.flags().edSafe}`}</Text>;
}

describe('React environment (PL-02)', () => {
  it('gives a screen the environment of the provider above it', async () => {
    await render(
      <AppEnvironmentProvider value={fakeEnvironment({ now: () => new Date(42) })}>
        <Probe />
      </AppEnvironmentProvider>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('42:false');
  });

  it('says so when a screen asks for the environment outside a provider', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(render(<Probe />)).rejects.toThrow('outside AppEnvironmentProvider');
  });
});
