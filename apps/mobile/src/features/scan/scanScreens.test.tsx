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

import { act, fireEvent, render, screen, userEvent } from '@testing-library/react-native';
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
  it('shows the heading, the thumb and Cancel while analyzing, with no checklist', async () => {
    const model = makeModel({ api: new GateApi() });
    model.analyze({ thumb: null, request: buildScanRequest({ kind: 'photo', imageBase64: 'bW9jaw==' }) });
    await render(<AnalyzingView model={model} animationsDisabled />);
    expect(screen.getByText('Reading your plate')).toBeOnTheScreen();
    expect(screen.getByText('Usually under 5 seconds')).toBeOnTheScreen();
    expect(screen.getByTestId('scan.analyzing.thumb')).toBeOnTheScreen();
    expect(screen.queryByTestId('scan.checklist')).not.toBeOnTheScreen();
    expect(screen.queryByText('Detecting food')).not.toBeOnTheScreen();
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
  it('renders the review header, badge, total, macros and both ingredient rows', async () => {
    await render(<ReviewSheetView model={reviewModel()} onClose={() => {}} />);
    expect(screen.getByTestId('scan.review')).toBeOnTheScreen();
    expect(screen.getByTestId('scan.badge')).toBeOnTheScreen();
    expect(screen.getByTestId('scan.totalKcal')).toHaveTextContent('550');
    expect(screen.getByTestId('scan.macros')).toBeOnTheScreen();
    expect(screen.queryByTestId('scan.warningChip')).not.toBeOnTheScreen();
    expect(screen.getByTestId('scan.hiddenFat.1')).toBeOnTheScreen();
    expect(screen.queryByTestId('scan.hiddenFat.0')).not.toBeOnTheScreen();
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

  it('ED-safe hides every kcal figure and shows the note while the grams stay editable', async () => {
    setEdSafeMode(true);
    await render(<ReviewSheetView model={reviewModel()} onClose={() => {}} />);
    expect(screen.queryByTestId('scan.totalKcal')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('scan.macros')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('scan.itemKcal.0')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('scan.hiddenFat.1')).not.toBeOnTheScreen();
    expect(screen.getByTestId('scan.edSafeNote')).toBeOnTheScreen();
    expect(screen.getByTestId('scan.grams.0.increment')).toBeOnTheScreen();
    expect(screen.getByTestId('scan.grams.1')).toBeOnTheScreen();
  });

  it('keeps a long meal title editable on one line', async () => {
    const model = reviewModel();
    const long = 'Grilled chicken rice bowl with house dressing and a very long descriptive title that overflows';
    model.setMealTitle(long);
    await render(<ReviewSheetView model={model} onClose={() => {}} />);
    expect(screen.getByTestId('scan.titleField').props.value).toBe(long);
  });

  it('testGramsStepperRecomputesKcal', async () => {
    const model = reviewModel();
    await render(<ReviewSheetView model={model} onClose={() => {}} />);
    expect(screen.getByTestId('scan.itemKcal.0')).toHaveTextContent('464 kcal');
    for (let i = 0; i < 3; i += 1) {
      await userEvent.press(screen.getByTestId('scan.grams.0.increment'));
    }
    // 145 x 350 / 100 = 507.5 -> 508, recomputed from the current grams, never echoing the fixture.
    expect(screen.getByTestId('scan.itemKcal.0')).toHaveTextContent('508 kcal');
    expect(model.getState().result?.items[0].grams).toBe(350);
  });

  it('tapping the grams pill of another item opens its editor and collapses the first', async () => {
    await render(<ReviewSheetView model={reviewModel()} onClose={() => {}} />);
    expect(screen.queryByTestId('scan.grams.1.increment')).not.toBeOnTheScreen();
    await userEvent.press(screen.getByTestId('scan.grams.1'));
    expect(screen.getByTestId('scan.grams.1.increment')).toBeOnTheScreen();
    expect(screen.queryByTestId('scan.grams.0.increment')).not.toBeOnTheScreen();
    expect(screen.getByTestId('scan.grams.0')).toBeOnTheScreen();
  });

  it('Save is disabled while an item is unresolved', async () => {
    const response = twoItemResponse();
    response.items[1] = { ...response.items[1], unresolved: true };
    const model = makeModel({ api: new GateApi() });
    model.receive(response);
    await render(<ReviewSheetView model={model} onClose={() => {}} />);
    expect(screen.getByTestId('scan.reviewNeeded.1')).toBeOnTheScreen();
    expect(screen.getByTestId('scan.save')).toBeDisabled();
    expect(screen.getByText('Resolve 1 item to save')).toBeOnTheScreen();
  });

  it('Remove item drops an unresolved item, the total follows and Save opens', async () => {
    const response = twoItemResponse();
    response.items[1] = { ...response.items[1], unresolved: true };
    const model = makeModel({ api: new GateApi(), persistence: (await makeRealPersistence()).persistence });
    model.receive(response);
    await render(<ReviewSheetView model={model} onClose={() => {}} />);
    await userEvent.press(screen.getByTestId('scan.removeItem.1'));
    expect(screen.queryByTestId('scan.item.1')).not.toBeOnTheScreen();
    expect(screen.getByTestId('scan.totalKcal')).toHaveTextContent('464');
    expect(screen.getByTestId('scan.save')).toBeEnabled();
    expect(screen.getByText('Save to Lunch')).toBeOnTheScreen();
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

  it('Report a problem records the reason and note, leaves the item as it was, and confirms', async () => {
    const model = reviewModel();
    await render(<ReviewSheetView model={model} onClose={() => {}} />);
    await userEvent.press(screen.getByTestId('scan.fixIssue.0'));
    expect(screen.getByTestId('scan.correction.sheet')).toBeOnTheScreen();
    expect(screen.getByText("It isn't chicken-rice")).toBeOnTheScreen();
    await userEvent.press(screen.getByTestId('scan.correction.kind.portionOff'));
    await userEvent.type(screen.getByTestId('scan.correction.note'), 'smaller bowl');
    await userEvent.press(screen.getByTestId('scan.correction.save'));
    expect(model.getState().result?.items[0].correction).toEqual({ kind: 'portionOff', note: 'smaller bowl' });
    expect(model.getState().result?.items[0].grams).toBe(320);
    expect(screen.getByTestId('scan.correction.sentTitle')).toBeOnTheScreen();
    await userEvent.press(screen.getByTestId('scan.correction.back'));
    expect(screen.queryByTestId('scan.correction.sheet')).not.toBeOnTheScreen();
    expect(screen.getByText('Report noted')).toBeOnTheScreen();
  });

  it('the photo is not included in a report unless the toggle is turned on', async () => {
    const model = reviewModel();
    await render(<ReviewSheetView model={model} onClose={() => {}} />);
    await userEvent.press(screen.getByTestId('scan.fixIssue.0'));
    expect(screen.getByTestId('scan.correction.includePhoto').props.value).toBe(false);
    fireEvent(screen.getByTestId('scan.correction.includePhoto'), 'valueChange', true);
    await userEvent.press(screen.getByTestId('scan.correction.save'));
    expect(model.getState().result?.items[0].correction).toEqual({ kind: 'wrongFood', note: '', includePhoto: true });
  });

  it("Report a problem offers the direct fix first: Shouldn't be here removes the item", async () => {
    const model = reviewModel();
    await render(<ReviewSheetView model={model} onClose={() => {}} />);
    await userEvent.press(screen.getByTestId('scan.fixIssue.0'));
    expect(screen.queryByTestId('scan.correction.fixNow')).not.toBeOnTheScreen();
    await userEvent.press(screen.getByTestId('scan.correction.kind.notEaten'));
    expect(screen.getByText('Fix it now: remove the item')).toBeOnTheScreen();
    await userEvent.press(screen.getByTestId('scan.correction.fixNow'));
    expect(model.getState().result?.items.map((entry) => entry.source.label)).toEqual(['house-dressing']);
    expect(screen.queryByTestId('scan.correction.sheet')).not.toBeOnTheScreen();
  });

  it('Report a problem on another item: the item pills retarget the report and Wrong amount offers the grams editor', async () => {
    const model = reviewModel();
    await render(<ReviewSheetView model={model} onClose={() => {}} />);
    await userEvent.press(screen.getByTestId('scan.fixIssue.0'));
    await userEvent.press(screen.getByTestId('scan.correction.item.1'));
    await userEvent.press(screen.getByTestId('scan.correction.kind.portionOff'));
    await userEvent.press(screen.getByTestId('scan.correction.fixNow'));
    expect(screen.getByTestId('scan.grams.1.increment')).toBeOnTheScreen();
    expect(model.getState().result?.items[1].correction).toBeNull();
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

  it('the viewfinder offers the four mode chips, a close button and no zoom readout', async () => {
    await render(flow(makeModel({ api: new GateApi() })));
    for (const value of ['photo', 'barcode', 'label', 'text']) {
      expect(screen.getByTestId(`scan.modePill.${value}`)).toBeOnTheScreen();
    }
    expect(screen.getByTestId('scan.close')).toBeOnTheScreen();
    expect(screen.queryByTestId('scan.zoom')).not.toBeOnTheScreen();
  });

  it('the Describe chip opens the describe sheet and its close button returns to the camera', async () => {
    await render(flow(makeModel({ api: new GateApi() })));
    await userEvent.press(screen.getByTestId('scan.modePill.text'));
    expect(screen.getByTestId('scan.describeTitle')).toBeOnTheScreen();
    await userEvent.press(screen.getByTestId('scan.describe.close'));
    expect(await screen.findByTestId('scan.shutter')).toBeOnTheScreen();
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

describe('DescribeMealSheet (s-describe-light / dark / estimating)', () => {
  it('Estimate is disabled until the text has non-space characters', async () => {
    const model = makeModel({ api: new GateApi() });
    await render(<DescribeMealSheet model={model} />);
    expect(screen.getByTestId('scan.describeSubmit')).toBeDisabled();
    expect(screen.getByText('Estimate')).toBeOnTheScreen();
    await userEvent.type(screen.getByTestId('scan.describeField'), '   ');
    expect(screen.getByTestId('scan.describeSubmit')).toBeDisabled();
    await userEvent.type(screen.getByTestId('scan.describeField'), 'two eggs');
    expect(screen.getByTestId('scan.describeSubmit')).toBeEnabled();
  });

  it('shows the helper line and the length over 500, and nothing about free scans', async () => {
    const model = makeModel({ api: new GateApi() });
    model.setDescribeText('two eggs');
    await render(<DescribeMealSheet model={model} />);
    expect(screen.getByText('Amounts help: “1 cup”, “a palm-sized piece”.')).toBeOnTheScreen();
    expect(screen.getByTestId('scan.describe.counter')).toHaveTextContent('8/500');
    expect(screen.getByTestId('scan.describe.meal')).toHaveTextContent('Lunch');
    expect(screen.queryByText(/free scans/)).not.toBeOnTheScreen();
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

  it('while estimating the field is read-only, the dock says Estimating and Cancel keeps the text', async () => {
    const model = makeModel({ api: new GateApi() });
    model.setDescribeText('two eggs on toast');
    model.analyzeDescription('two eggs on toast');
    await render(<DescribeMealSheet model={model} />);
    expect(screen.getByTestId('scan.describe.estimating')).toBeOnTheScreen();
    expect(screen.getByText('Estimating...')).toBeOnTheScreen();
    expect(screen.getByTestId('scan.describeSubmit')).toBeDisabled();
    expect(screen.getByTestId('scan.describeField').props.editable).toBe(false);
    await userEvent.press(screen.getByTestId('scan.cancel'));
    expect(model.getState().phase.kind).toBe('capture');
    expect(model.getState().describeText).toBe('two eggs on toast');
  });

  it('a failure overlays the error card and Back to description returns to capture', async () => {
    const model = await modelInPhase('422', 'failed');
    await render(<DescribeMealSheet model={model} />);
    expect(screen.getByTestId('scan.errorCard')).toBeOnTheScreen();
    await userEvent.press(screen.getByTestId('scan.describe.back'));
    expect(model.getState().phase.kind).toBe('capture');
  });

  it('Search manually on the error card calls the route escape, and there is no search icon in the header', async () => {
    const onSearchManually = jest.fn();
    const model = await modelInPhase('422', 'failed');
    await render(<DescribeMealSheet model={model} onSearchManually={onSearchManually} />);
    expect(screen.queryByTestId('scan.describe.search')).not.toBeOnTheScreen();
    await userEvent.press(screen.getByTestId('scan.searchManually'));
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

  it('shows the saved screen with the dish and kcal, the today card, Undo and both actions', async () => {
    const { model } = await savedModel();
    await render(<ScanSavedView model={model} onViewDiary={() => {}} onAddMore={() => {}} />);
    expect(screen.getByText('Saved to Lunch')).toBeOnTheScreen();
    expect(screen.getByText(`${model.getState().mealTitle} · ${model.getState().savedKcal} kcal`)).toBeOnTheScreen();
    expect(screen.getByText('Today so far')).toBeOnTheScreen();
    expect(screen.getByTestId('scan.todayKcal')).toBeOnTheScreen();
    expect(screen.getByTestId('toast:undo')).toBeOnTheScreen();
    expect(screen.getByText('View diary')).toBeOnTheScreen();
    expect(screen.getByText('Scan another')).toBeOnTheScreen();
  });

  it('Undo tombstones the entries and notifies again, and a second press does nothing more', async () => {
    const { model, calls } = await savedModel();
    await render(<ScanSavedView model={model} onViewDiary={() => {}} onAddMore={() => {}} />);
    await userEvent.press(screen.getByTestId('toast:undo'));
    await userEvent.press(screen.getByTestId('toast:undo'));
    await waitUntil(() => model.getState().phase.kind === 'review');
    await new Promise((resolve) => setTimeout(resolve, 50));
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

  it('ED-safe shows the dish without kcal and drops the today card', async () => {
    setEdSafeMode(true);
    const { model } = await savedModel();
    await render(<ScanSavedView model={model} onViewDiary={() => {}} onAddMore={() => {}} />);
    expect(screen.getByText('Saved to Lunch')).toBeOnTheScreen();
    expect(screen.getByText(model.getState().mealTitle)).toBeOnTheScreen();
    expect(screen.queryByText(/kcal/)).not.toBeOnTheScreen();
    expect(screen.queryByTestId('scan.todaySoFar')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('scan.todayKcal')).not.toBeOnTheScreen();
  });
});
