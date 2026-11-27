/** Dual-react preamble — see docs/rn-migration/findings/U-22.md. */
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

import { SectionHeader } from './SectionHeader';

describe('SectionHeader', () => {
  it('uppercases its title and marks it as a header', async () => {
    await render(<SectionHeader title="Today" />);
    const header = screen.getByRole('header');
    expect(header).toBeOnTheScreen();
    expect(header).toHaveTextContent('Today');
    expect(header).toHaveStyle({ textTransform: 'uppercase', letterSpacing: 0.55 });
  });
});
