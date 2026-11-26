import { render, screen } from '@testing-library/react-native';

import EmberScreen from '../app/index';

// RNTL 14: render is async (it builds on `test-renderer`), so every render is awaited.
describe('skeleton Ember screen', () => {
  it('shows the kcal computed by @coachcal/core', async () => {
    await render(<EmberScreen />);
    expect(screen.getByTestId('ember:kcal')).toHaveTextContent('165 kcal');
  });
});
