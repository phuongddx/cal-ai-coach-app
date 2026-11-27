/** Dual-react preamble — see docs/rn-migration/findings/U-22.md. */
jest.mock('react', () => {
  const rnPath: string = require.resolve('react-native');
  const root = rnPath.slice(0, rnPath.indexOf('/react-native/'));
  return jest.requireActual(`${root}/react`);
});
jest.mock('react/jsx-runtime', () => {
  const rnPath: string = require.resolve('react-native');
  const root = rnPath.slice(0, rnPath.indexOf('/react-native/'));
  return jest.requireActual(`${root}/react/jsx-runtime`);
});

import { render, screen } from '@testing-library/react-native';

import { SearchField } from './SearchField';

describe('SearchField', () => {
  it('shows the typed text and the placeholder', async () => {
    const onChangeText = jest.fn();
    await render(
      <SearchField text="chicken" onChangeText={onChangeText} placeholder="Search foods" />,
    );
    const input = screen.getByDisplayValue('chicken');
    expect(input).toBeOnTheScreen();
    expect(input).toHaveProp('placeholder', 'Search foods');
    expect(input).toHaveProp('accessibilityLabel', 'Search foods');
  });
});
