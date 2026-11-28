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

import { lightColors } from '../tokens';

import { BannerNote, markdownSegments } from './BannerNote';

describe('BannerNote', () => {
  it.each(['neutral', 'success', 'info', 'caution', 'error'] as const)('renders the %s variant', async (variant) => {
    await render(<BannerNote text="Note text" variant={variant} />);
    expect(screen.getByTestId(`banner:${variant}`)).toHaveTextContent('Note text');
  });

  it('paints caution and error with their own tint and border', async () => {
    await render(
      <>
        <BannerNote text="Floor" variant="caution" />
        <BannerNote text="Export failed" variant="error" />
      </>,
    );
    expect(screen.getByTestId('banner:caution')).toHaveStyle({
      backgroundColor: lightColors.cautionTint,
      borderColor: lightColors.caution,
    });
    expect(screen.getByTestId('banner:error')).toHaveStyle({
      backgroundColor: lightColors.errorTint,
      borderColor: lightColors.error,
    });
  });

  it('defaults to the neutral variant', async () => {
    await render(<BannerNote text="Plain note" />);
    expect(screen.getByTestId('banner:neutral')).toBeOnTheScreen();
  });

  it('renders markdown copy without printing the asterisks', async () => {
    await render(
      <BannerNote markdown text="**Safety floor:** the plan will not go lower." variant="info" />,
    );
    const banner = screen.getByTestId('banner:info');
    expect(banner).toHaveTextContent('Safety floor: the plan will not go lower.');
    expect(banner).not.toHaveTextContent('**');
  });

  it('splits markdown segments into bold runs', () => {
    expect(markdownSegments('**Safety floor:** keep')).toEqual([
      { text: 'Safety floor:', bold: true },
      { text: ' keep', bold: false },
    ]);
    expect(markdownSegments('no markers')).toEqual([{ text: 'no markers', bold: false }]);
  });
});
