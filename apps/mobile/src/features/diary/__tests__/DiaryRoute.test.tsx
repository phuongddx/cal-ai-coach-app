/**
 * The diary route's formSheet guard (src/app/diary.tsx). A formSheet whose only child is the day
 * ScrollView trips react-native-screens' "FormSheet with ScrollView expects at most 2 subviews" layout
 * path and renders blank (U-33 findings, flow 04). The route therefore wraps DiaryDayView in one View with
 * `collapsable={false}`, so Fabric cannot flatten the wrapper away. Jest cannot run the native sheet, so
 * the test pins the structure the fix depends on: the day view sits inside exactly one non-collapsable
 * View, and that View is the route's root. It lives here, not under src/app, where every file is a route.
 */
import { render, screen } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  router: { dismiss: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({}),
}));
jest.mock('../../../data/auth', () => ({ getSessionStore: () => ({ getSession: () => null }) }));
jest.mock('../../../data/environment', () => ({
  getDataEnvironment: () => Promise.resolve({ db: {}, now: () => new Date(2026, 8, 12, 9, 0, 0, 0) }),
}));
jest.mock('../../../data/repos/diaryDetailRepository', () => ({ createDiaryDetailRepository: () => ({}) }));
jest.mock('../../../data/sync/runtime', () => ({
  notifyLocalMutation: jest.fn(),
  getSyncRuntime: () => Promise.resolve({ subscribe: () => () => undefined }),
}));
jest.mock('../diaryDayModel', () => ({ createDiaryDayModel: () => ({ refresh: async () => undefined }) }));
jest.mock('../screens/DiaryDayView', () => {
  const { View: MockView } = jest.requireActual('react-native');
  return { DiaryDayView: () => <MockView testID="diary.dayViewStub" /> };
});

// eslint-disable-next-line import/first -- the route is imported after the mocks it reads
import DiaryScreen from '../../../app/diary';

describe('DiaryScreen formSheet wrapper', () => {
  it('puts the day view inside one non-collapsable View that is the route root', async () => {
    await render(<DiaryScreen />);
    const dayView = await screen.findByTestId('diary.dayViewStub');

    const wrapper = dayView.parent;
    expect(wrapper).not.toBeNull();
    expect(wrapper?.type).toBe('View');
    expect(wrapper?.props.collapsable).toBe(false);
    expect(wrapper?.props.style).toEqual({ flex: 1 });
    // The wrapper is the route's root: the sheet's direct child is this one View, never the day view itself.
    const tree = screen.toJSON();
    expect(tree).not.toBeNull();
    expect(Array.isArray(tree)).toBe(false);
    expect((tree as { props: { collapsable?: boolean } }).props.collapsable).toBe(false);
  });
});
