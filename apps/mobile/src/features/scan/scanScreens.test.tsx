/**
 * RNTL cases for the scan screens, one per state of the SwiftUI snapshot matrix (ScanSnapshotTests:
 * viewfinder, analyzing, review light/dark/ED-safe/long-title, 404, quota) plus the describe, correction and
 * saved screens. Behavior is asserted through labels and testIDs; pixels are the Simulator evidence.
 */
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

import { act, render, screen, userEvent } from '@testing-library/react-native';
import * as ReactNative from 'react-native';

import { buildScanRequest } from '../../data/api/scanClient';
import { setEdSafeMode } from '../../design';
import { FixtureScanApi } from '../../testing';
import { AnalyzingView } from './AnalyzingView';
import { DescribeMealSheet } from './DescribeMealSheet';
import { QuotaReachedView } from './QuotaReachedView';
import { ReviewSheetView } from './ReviewSheetView';
import { ScanFlowView } from './ScanFlowView';
import { ScanSavedView } from './ScanSavedView';
import { createFixtureCaptureService } from './scanCapture';
import { GateApi, makeModel, makeRealPersistence, twoItemResponse, waitUntil } from './scanTestKit';
import type { ScanModel } from './scanModel';

afterEach(() => {
  setEdSafeMode(false);
  jest.restoreAllMocks();
});

function reviewModel(): ScanModel {
  const model = makeModel({ api: new GateApi() });
  model.receive(twoItemResponse());
  return model;
}

async function modelInPhase(api: ConstructorParameters<typeof FixtureScanApi>[0], phase: string): Promise<ScanModel> {
  const model = makeModel({ api: new FixtureScanApi(api) });
  model.analyze({ thumb: null, request: buildScanRequest({ kind: 'photo', imageBase64: 'bW9jaw==' }) });
  await waitUntil(() => model.getState().phase.kind === phase);
  return model;
}

describe('AnalyzingView (scan-analyzing)', () => {
  it('shows the headings, the thumb, three checklist rows and Cancel while detecting', async () => {
    const model = makeModel({ api: new GateApi() });
    model.analyze({ thumb: null, request: buildScanRequest({ kind: 'photo', imageBase64: 'bW9jaw==' }) });
    await render(<AnalyzingView model={model} animationsDisabled />);
    expect(screen.getByText('Analyzing your meal')).toBeOnTheScreen();
    expect(screen.getByText('AI estimate in progress')).toBeOnTheScreen();
    expect(screen.getByTestId('scan.analyzing.thumb')).toBeOnTheScreen();
    expect(screen.getByText('Detecting food')).toBeOnTheScreen();
    expect(screen.getByText('Reading nutrition')).toBeOnTheScreen();
    expect(screen.getByText('Checking accuracy')).toBeOnTheScreen();
    expect(screen.queryByText('Confirming with a second pass')).not.toBeOnTheScreen();
    expect(screen.getByText('Cancel')).toBeOnTheScreen();
  });

  it('Cancel returns to capture', async () => {
    const model = makeModel({ api: new GateApi() });
    model.analyze({ thumb: null, request: buildScanRequest({ kind: 'photo', imageBase64: 'bW9jaw==' }) });
    await render(<AnalyzingView model={model} animationsDisabled />);
    await userEvent.press(screen.getByTestId('scan.cancel'));
    expect(model.getState().phase.kind).toBe('capture');
  });
});

describe('ReviewSheetView (scan-review-light / dark / edsafe / longtitle)', () => {
  it('renders the review header, badge, total, warning chip and both ingredient rows', async () => {
    await render(<ReviewSheetView model={reviewModel()} onClose={() => {}} />);
    expect(screen.getByTestId('scan.review')).toBeOnTheScreen();
    expect(screen.getByTestId('scan.badge')).toBeOnTheScreen();
    expect(screen.getByTestId('scan.totalKcal')).toHaveTextContent('550');
    expect(screen.getByTestId('scan.warningChip')).toBeOnTheScreen();
    expect(screen.getByText('chicken-rice')).toBeOnTheScreen();
    expect(screen.getByText('house-dressing')).toBeOnTheScreen();
    expect(screen.getByTestId('scan.itemKcal.0')).toHaveTextContent('464 kcal');
    expect(screen.getByTestId('scan.itemKcal.1')).toHaveTextContent('86 kcal');
    expect(screen.getByText('Save to Lunch')).toBeOnTheScreen();
  });

  it('renders in dark scheme with the same content', async () => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');
    await render(<ReviewSheetView model={reviewModel()} onClose={() => {}} />);
    expect(screen.getByTestId('scan.totalKcal')).toHaveTextContent('550');
    expect(screen.getByText('chicken-rice')).toBeOnTheScreen();
  });

  it('ED-safe hides every kcal figure while the stepper still reads grams', async () => {
    setEdSafeMode(true);
    await render(<ReviewSheetView model={reviewModel()} onClose={() => {}} />);
    expect(screen.queryByTestId('scan.totalKcal')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('scan.itemKcal.0')).not.toBeOnTheScreen();
    expect(screen.getByTestId('scan.grams.0')).toBeOnTheScreen();
    expect(screen.getByTestId('stepper:chicken-rice', { includeHiddenElements: true })).toHaveAccessibilityValue({ text: '320 grams' });
  });

  it('keeps a long meal title editable on one line', async () => {
    const model = reviewModel();
    const long = 'Grilled chicken rice bowl with house dressing and a very long descriptive title that overflows';
    model.setMealTitle(long);
    await render(<ReviewSheetView model={model} onClose={() => {}} />);
    expect(screen.getByTestId('scan.titleField').props.value).toBe(long);
  });

  it('three grams increments recompute the item kcal from the current grams', async () => {
    const model = reviewModel();
    await render(<ReviewSheetView model={model} onClose={() => {}} />);
    for (let i = 0; i < 3; i += 1) {
      await userEvent.press(screen.getAllByTestId('ccstepper.increment', { includeHiddenElements: true })[0]);
    }
    expect(screen.getByTestId('scan.itemKcal.0')).toHaveTextContent('508 kcal');
    expect(model.getState().result?.items[0].grams).toBe(350);
  });

  it('Save is disabled while an item is unresolved', async () => {
    const response = twoItemResponse();
    response.items[1] = { ...response.items[1], unresolved: true };
    const model = makeModel({ api: new GateApi() });
    model.receive(response);
    await render(<ReviewSheetView model={model} onClose={() => {}} />);
    expect(screen.getByTestId('scan.reviewNeeded.1')).toBeOnTheScreen();
    expect(screen.getByTestId('scan.save')).toBeDisabled();
  });

  it('retake and close call back', async () => {
    const model = reviewModel();
    const onClose = jest.fn();
    await render(<ReviewSheetView model={model} onClose={onClose} />);
    await userEvent.press(screen.getByTestId('scan.close'));
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.press(screen.getByTestId('scan.retake'));
    expect(model.getState().phase.kind).toBe('capture');
  });

  it('Fix Issue opens the correction sheet and Save note marks the item Fix noted', async () => {
    const model = reviewModel();
    await render(<ReviewSheetView model={model} onClose={() => {}} />);
    await userEvent.press(screen.getByTestId('scan.fixIssue.0'));
    expect(screen.getByTestId('scan.correction.sheet')).toBeOnTheScreen();
    await userEvent.press(screen.getByTestId('chip-option:Portion way off'));
    await userEvent.type(screen.getByTestId('scan.correction.note'), 'smaller bowl');
    await userEvent.press(screen.getByTestId('scan.correction.save'));
    expect(model.getState().result?.items[0].correction).toEqual({ kind: 'portionOff', note: 'smaller bowl' });
    expect(screen.getByText('Fix noted')).toBeOnTheScreen();
  });

  it('Save to the chosen meal runs one save and shows the saved phase', async () => {
    const real = await makeRealPersistence();
    const model = makeModel({ api: new GateApi(), persistence: real.persistence, notify: real.notify });
    model.receive(twoItemResponse());
    await render(<ReviewSheetView model={model} onClose={() => {}} />);
    await userEvent.press(screen.getByText('Dinner'));
    await userEvent.press(screen.getByTestId('scan.save'));
    await waitUntil(() => model.getState().phase.kind === 'saved');
    expect(real.save).toHaveBeenCalledTimes(1);
    expect(real.calls).toEqual(['save', 'notify']);
    expect(model.getState().mealSlot).toBe('dinner');
  });
});

describe('QuotaReachedView (scan-quota)', () => {
  it('shows the quota copy with the reset date and both actions', async () => {
    const model = await modelInPhase('402', 'quotaReached');
    await render(<QuotaReachedView model={model} onLogManually={() => {}} />);
    expect(screen.getByText("You've used all 3 free scans this week")).toBeOnTheScreen();
    expect(screen.getByTestId('scan.quotaBody')).toHaveTextContent(/Your scans reset .+\. You can still log everything manually\./);
    expect(screen.getByText('See plans')).toBeOnTheScreen();
    expect(screen.getByText('Log manually')).toBeOnTheScreen();
  });

  it('See plans opens the neutral plans sheet whose Log manually hands off to the route', async () => {
    const model = await modelInPhase('402', 'quotaReached');
    const onLogManually = jest.fn();
    await render(<QuotaReachedView model={model} onLogManually={onLogManually} />);
    await userEvent.press(screen.getByTestId('scan.seePlans'));
    expect(screen.getByTestId('scan.plansTitle')).toBeOnTheScreen();
    expect(screen.getByText(/CoachCal plan options will be available at launch/)).toBeOnTheScreen();
    await userEvent.press(screen.getByTestId('scan.plansLogManually'));
    expect(onLogManually).toHaveBeenCalledTimes(1);
  });
});

describe('ScanFlowView (scan-viewfinder, scan-404 and the phase switch)', () => {
  const flow = (model: ScanModel, initialMode: 'photo' | 'text' = 'photo') => (
    <ScanFlowView
      model={model}
      initialMode={initialMode}
      createCapture={(mode) => createFixtureCaptureService(mode === 'text' ? 'photo' : mode)}
      onClose={() => {}}
      onLogManually={() => {}}
    />
  );

  it('capture shows the viewfinder with the fixture feed', async () => {
    await render(flow(makeModel({ api: new GateApi() })));
    expect(await screen.findByTestId('scan.fixtureFeed', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByTestId('scan.shutter')).toBeOnTheScreen();
  });

  it('text mode shows the describe sheet instead of the viewfinder', async () => {
    await render(flow(makeModel({ api: new GateApi() }), 'text'));
    expect(screen.getByTestId('scan.describeTitle')).toBeOnTheScreen();
    expect(screen.queryByTestId('scan.fixtureFeed')).not.toBeOnTheScreen();
  });

  it('a 404 barcode failure shows the inline error card with its two actions', async () => {
    const model = makeModel({ api: new FixtureScanApi('404') });
    model.analyze({ thumb: null, request: buildScanRequest({ kind: 'barcode', barcode: '4006381333931' }) });
    await waitUntil(() => model.getState().phase.kind === 'failed');
    await render(flow(model));
    expect(screen.getByTestId('scan.errorCard')).toBeOnTheScreen();
    expect(screen.getByText('Try again')).toBeOnTheScreen();
    expect(screen.getByText('Search manually')).toBeOnTheScreen();
  });

  it('a 422 failure shows the analysis-failure error card', async () => {
    const model = await modelInPhase('422', 'failed');
    await render(flow(model));
    expect(screen.getByTestId('scan.errorCard')).toBeOnTheScreen();
  });

  it('switches to analyzing, review, and saved as the phase moves', async () => {
    const api = new GateApi();
    const real = await makeRealPersistence();
    const model = makeModel({ api, persistence: real.persistence, notify: real.notify });
    await render(flow(model));
    await act(async () => {
      model.analyze({ thumb: null, request: buildScanRequest({ kind: 'photo', imageBase64: 'bW9jaw==' }) });
    });
    expect(screen.getByTestId('scan.analyzing')).toBeOnTheScreen();
    await act(async () => {
      api.resumeAll(twoItemResponse());
      await waitUntil(() => model.getState().phase.kind === 'review');
    });
    expect(screen.getByTestId('scan.review')).toBeOnTheScreen();
    await userEvent.press(screen.getByTestId('scan.save'));
    await waitUntil(() => model.getState().phase.kind === 'saved');
    expect(screen.getByTestId('scan.savedToast')).toBeOnTheScreen();
  });
});

describe('DescribeMealSheet', () => {
  it('Analyze description is disabled until the text has non-space characters', async () => {
    const model = makeModel({ api: new GateApi() });
    await render(<DescribeMealSheet model={model} />);
    expect(screen.getByTestId('scan.describeSubmit')).toBeDisabled();
    await userEvent.type(screen.getByTestId('scan.describeField'), '   ');
    expect(screen.getByTestId('scan.describeSubmit')).toBeDisabled();
    await userEvent.type(screen.getByTestId('scan.describeField'), 'two eggs');
    expect(screen.getByTestId('scan.describeSubmit')).toBeEnabled();
  });

  it('submits the trimmed description as a text scan', async () => {
    const api = new GateApi();
    const model = makeModel({ api });
    model.setDescribeText('  two eggs on toast  ');
    await render(<DescribeMealSheet model={model} />);
    await userEvent.press(screen.getByTestId('scan.describeSubmit'));
    expect(api.calls).toHaveLength(1);
    expect(api.calls[0]).toMatchObject({ kind: 'text', textDescription: 'two eggs on toast' });
  });

  it('a failure overlays the error card and Back to description returns to capture', async () => {
    const model = await modelInPhase('422', 'failed');
    await render(<DescribeMealSheet model={model} />);
    expect(screen.getByTestId('scan.errorCard')).toBeOnTheScreen();
    await userEvent.press(screen.getByTestId('scan.describe.back'));
    expect(model.getState().phase.kind).toBe('capture');
  });

  it('the search icon calls the route escape', async () => {
    const onSearchManually = jest.fn();
    await render(<DescribeMealSheet model={makeModel({ api: new GateApi() })} onSearchManually={onSearchManually} />);
    await userEvent.press(screen.getByLabelText('Search the food database'));
    expect(onSearchManually).toHaveBeenCalledTimes(1);
  });
});

describe('ScanSavedView', () => {
  async function savedModel(): Promise<{ model: ScanModel; calls: string[] }> {
    const real = await makeRealPersistence();
    const model = makeModel({ api: new GateApi(), persistence: real.persistence, notify: real.notify });
    model.receive(twoItemResponse());
    await model.save();
    return { model, calls: real.calls };
  }

  it('shows the toast with the saved kcal, the today peek, and the quick actions', async () => {
    const { model } = await savedModel();
    await render(<ScanSavedView model={model} onViewDiary={() => {}} onAddMore={() => {}} />);
    expect(screen.getByText('Saved to Lunch')).toBeOnTheScreen();
    expect(screen.getByText(`${model.getState().savedKcal} kcal added`)).toBeOnTheScreen();
    expect(screen.getByText('Today so far')).toBeOnTheScreen();
    expect(screen.getByTestId('scan.todayKcal')).toBeOnTheScreen();
    expect(screen.getByText('View diary')).toBeOnTheScreen();
    expect(screen.getByText('Add more')).toBeOnTheScreen();
  });

  it('Undo hides the toast and tombstones the entries, notifying again', async () => {
    const { model, calls } = await savedModel();
    await render(<ScanSavedView model={model} onViewDiary={() => {}} onAddMore={() => {}} />);
    await userEvent.press(screen.getByTestId('toast:undo'));
    await waitUntil(() => model.getState().phase.kind === 'review');
    expect(screen.queryByTestId('scan.savedToast')).not.toBeOnTheScreen();
    expect(calls).toEqual(['save', 'notify', 'notify']);
  });

  it('View diary and Add more call back; Add more starts a new scan', async () => {
    const { model } = await savedModel();
    const onViewDiary = jest.fn();
    await render(<ScanSavedView model={model} onViewDiary={onViewDiary} onAddMore={() => model.startNewScan()} />);
    await userEvent.press(screen.getByTestId('scan.viewDiary'));
    expect(onViewDiary).toHaveBeenCalledTimes(1);
    await userEvent.press(screen.getByTestId('scan.addMore'));
    expect(model.getState().phase.kind).toBe('capture');
  });

  it('ED-safe collapses the today peek', async () => {
    setEdSafeMode(true);
    const { model } = await savedModel();
    await render(<ScanSavedView model={model} onViewDiary={() => {}} onAddMore={() => {}} />);
    expect(screen.queryByTestId('scan.todaySoFar')).not.toBeOnTheScreen();
  });
});
