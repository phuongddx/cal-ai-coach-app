/**
 * ED-safe module contract — the port of the EdSafe.swift contract plus the
 * I7 re-render requirement: a component reading `useEdSafeHidden()` re-renders
 * when `setEdSafeMode` flips the mode.
 *
 * The jest.mock preamble is the dual-react fix: see docs/rn-migration/findings/U-22.md.
 */
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

import { act, render, screen } from '@testing-library/react-native';
import { createElement } from 'react';
import { Text } from 'react-native';

import { edSafeHidden, edSafeMode, setEdSafeMode, useEdSafeHidden } from '../edSafe';

// Plain createElement keeps this file .ts (the brief names the path) while the
// probe still exercises the hook exactly as a component does.
function HiddenProbe({ label }: { label: string }) {
  const hidden = useEdSafeHidden();
  return createElement(Text, { testID: 'probe' }, `${label}:${hidden ? 'hidden' : 'visible'}`);
}

describe('ED-safe module state', () => {
  beforeEach(() => {
    setEdSafeMode(false);
  });

  it('is off by default', () => {
    expect(edSafeMode()).toBe(false);
    expect(edSafeHidden()).toBe(false);
  });

  it('setEdSafeMode(true) makes edSafeHidden() true', () => {
    setEdSafeMode(true);
    expect(edSafeMode()).toBe(true);
    expect(edSafeHidden()).toBe(true);
    setEdSafeMode(false);
    expect(edSafeHidden()).toBe(false);
  });

  it('a rendered component re-renders when the mode flips', async () => {
    await render(createElement(HiddenProbe, { label: 'before' }));
    expect(screen.getByTestId('probe')).toHaveTextContent('before:visible');

    await act(async () => {
      setEdSafeMode(true);
    });
    expect(screen.getByTestId('probe')).toHaveTextContent('before:hidden');

    await act(async () => {
      setEdSafeMode(false);
    });
    expect(screen.getByTestId('probe')).toHaveTextContent('before:visible');
  });

  it('a newly mounted component reads the flipped mode', async () => {
    await render(createElement(HiddenProbe, { label: 'first' }));
    await act(async () => {
      setEdSafeMode(true);
    });
    const { unmount } = await render(createElement(HiddenProbe, { label: 'second' }));
    expect(screen.getByTestId('probe')).toHaveTextContent('second:hidden');
    unmount();
  });

  it('setEdSafeMode to the same value does not re-render subscribers', async () => {
    let renders = 0;
    function CountingProbe() {
      renders += 1;
      useEdSafeHidden();
      return null;
    }
    await render(createElement(CountingProbe));
    const before = renders;
    await act(async () => {
      setEdSafeMode(true);
    });
    const afterFlip = renders;
    await act(async () => {
      setEdSafeMode(true);
    });
    expect(renders).toBe(afterFlip);
    expect(afterFlip).toBeGreaterThan(before);
  });
});
