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

import * as fs from 'node:fs';
import * as path from 'node:path';

import { render, screen } from '@testing-library/react-native';

import { lightColors } from '../tokens';

import { Icon, iconStrokeWidth } from './Icon';
import { iconNames, iconShapes } from './iconShapes';

const canvasPath = path.resolve(__dirname, '../../../../..', 'docs/design/ember/index.html');
const canvas = fs.readFileSync(canvasPath, 'utf8');

type CanvasSymbol = { id: string; shapes: Array<Record<string, string>> };

function readCanvasSymbols(): CanvasSymbol[] {
  const symbols: CanvasSymbol[] = [];
  for (const match of canvas.matchAll(/<symbol id="([^"]+)" viewBox="0 0 24 24">(.*?)<\/symbol>/g)) {
    const shapes: Array<Record<string, string>> = [];
    for (const tag of match[2].matchAll(/<(path|circle|rect)\s+([^>]*?)\/>/g)) {
      const attributes: Record<string, string> = { tag: tag[1] };
      for (const attribute of tag[2].matchAll(/([a-z]+)="([^"]*)"/g)) attributes[attribute[1]] = attribute[2];
      shapes.push(attributes);
    }
    symbols.push({ id: match[1], shapes });
  }
  return symbols;
}

const symbols = readCanvasSymbols();

describe('Icon set against docs/design/ember/index.html', () => {
  it('reads every symbol of the canvas (51)', () => {
    expect(canvas.match(/<symbol /g)).toHaveLength(51);
    expect(symbols).toHaveLength(51);
  });

  it('has exactly one name per symbol id, in the canvas order', () => {
    expect(iconNames.map((name) => `i-${name}`)).toEqual(symbols.map((symbol) => symbol.id));
    expect(new Set(iconNames).size).toBe(iconNames.length);
  });

  it('copies the path data and every shape attribute verbatim', () => {
    for (const symbol of symbols) {
      const name = symbol.id.slice(2) as keyof typeof iconShapes;
      expect(iconShapes[name]).toEqual(symbol.shapes);
    }
  });
});

describe('Icon', () => {
  it('draws the shapes of its symbol with the 2 px round stroke at the default size 20', async () => {
    await render(<Icon name="camera" testID="icon" />);
    const svg = screen.getByTestId('icon');
    expect(svg).toHaveProp('width', 20);
    expect(svg).toHaveProp('height', 20);
    expect(svg).toHaveProp('vbWidth', 24);
    expect(svg).toHaveProp('vbHeight', 24);
    expect(svg).toHaveProp('strokeWidth', iconStrokeWidth);
    expect(svg).toHaveProp('strokeLinecap', 'round');
    expect(svg).toHaveProp('stroke', lightColors.text);
  });

  it('takes size and a token color', async () => {
    await render(<Icon name="flame" size={28} color={lightColors.accentInk} testID="icon" />);
    const svg = screen.getByTestId('icon');
    expect(svg).toHaveProp('width', 28);
    expect(svg).toHaveProp('stroke', lightColors.accentInk);
  });

  it('is an image with its label when an accessibilityLabel is given', async () => {
    await render(<Icon name="eyeoff" accessibilityLabel="ED-safe mode on" testID="icon" />);
    const svg = screen.getByTestId('icon');
    expect(svg).toHaveProp('accessible', true);
    expect(svg).toHaveProp('accessibilityRole', 'image');
    expect(svg).toHaveProp('accessibilityLabel', 'ED-safe mode on');
  });

  it('is decorative without a label', async () => {
    await render(<Icon name="eyeoff" testID="icon" />);
    const svg = screen.getByTestId('icon');
    expect(svg).toHaveProp('accessible', false);
    expect(svg.props.accessibilityLabel).toBeUndefined();
    expect(svg.props.accessibilityRole).toBeUndefined();
  });

  it('renders every icon of the set without throwing', async () => {
    for (const name of iconNames) {
      await render(<Icon name={name} testID={`icon.${name}`} />);
      expect(screen.getByTestId(`icon.${name}`)).toBeOnTheScreen();
    }
  });
});
