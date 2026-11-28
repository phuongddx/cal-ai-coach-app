/// <reference types="node" />
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import { Slot } from 'expo-router';
import { extractExpoPathFromURL } from 'expo-router/build/fork/extractPathFromURL';
import { renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

/**
 * The route table is the file list of `src/app/`. These tests build the router from that real list
 * (every file replaced by a stub screen, so no native module loads) and open the deep links the app
 * documents. A route file that is renamed or deleted fails here.
 */
// The native app registers `scheme: 'coachcal'` (app.config.ts). On launch expo-router turns the opened
// URL into a path with extractExpoPathFromURL, so the tests do the same and render the resulting path.
async function openDeepLink(url: string) {
  const path = `/${extractExpoPathFromURL([], url)}`;
  await renderRouter(stubContext(), { initialUrl: path });
  return path;
}
const APP_DIR = join(__dirname, '..', 'app');

function listRouteFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? listRouteFiles(join(dir, entry.name)) : [relative(APP_DIR, join(dir, entry.name))],
  );
}

function stubContext() {
  const context: Record<string, () => React.JSX.Element> = {};
  for (const file of listRouteFiles(APP_DIR)) {
    // expo-router's in-memory context looks keys up without "./" and without the extension.
    const key = file.replace(/\.tsx?$/, '');
    context[key] = key.endsWith('_layout')
      ? () => <Slot />
      : () => <Text testID="stub">{file.replace(/\.tsx?$/, '')}</Text>;
  }
  return context;
}

describe('route skeleton', () => {
  it('has a file for every route of the app', () => {
    const files = listRouteFiles(APP_DIR).sort();
    expect(files).toEqual(
      [
        '(tabs)/_layout.tsx',
        '(tabs)/coach.tsx',
        '(tabs)/index.tsx',
        '(tabs)/profile.tsx',
        '(tabs)/progress.tsx',
        '_layout.tsx',
        'cancel-flow.tsx',
        'debug.tsx',
        'diary.tsx',
        'onboarding/index.tsx',
        'plans.tsx',
        'scan/index.tsx',
        'settings.tsx',
        'sign-in.tsx',
      ].sort(),
    );
  });

  it('keeps test files out of src/app (every file there is a route)', () => {
    expect(listRouteFiles(APP_DIR).filter((f) => /\.(test|spec)\./.test(f))).toEqual([]);
  });
});

describe('deep links resolve to their routes', () => {
  it('coachcal://diary opens the diary route', async () => {
    expect(await openDeepLink('coachcal://diary')).toBe('/diary');
    expect(screen).toHavePathname('/diary');
    expect(screen.getByTestId('stub').props.children).toBe('diary');
  });

  it('coachcal://debug?action=seed opens the debug console with the action as a parameter', async () => {
    expect(await openDeepLink('coachcal://debug?action=seed')).toBe('/debug?action=seed');
    expect(screen).toHavePathname('/debug');
    expect(screen).toHaveSearchParams({ action: 'seed' });
    expect(screen.getByTestId('stub').props.children).toBe('debug');
  });

  it('an empty path opens Today, the index of the tabs group', async () => {
    await renderRouter(stubContext(), { initialUrl: '/' });
    expect(screen).toHavePathname('/');
    expect(screen.getByTestId('stub').props.children).toBe('(tabs)/index');
  });

  it.each([
    ['coachcal://progress', '/progress'],
    ['coachcal://coach', '/coach'],
    ['coachcal://profile', '/profile'],
    ['coachcal://scan', '/scan'],
    ['coachcal://settings', '/settings'],
    ['coachcal://sign-in', '/sign-in'],
    ['coachcal://onboarding', '/onboarding'],
    ['coachcal://plans', '/plans'],
    ['coachcal://cancel-flow', '/cancel-flow'],
  ])('%s opens %s', async (url, pathname) => {
    await openDeepLink(url);
    expect(screen).toHavePathname(pathname);
  });
});
