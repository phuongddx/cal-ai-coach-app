/* CoachCal Redesign v2 · additions 27/11/2026
   8  Diary: edit an item (edit, delete confirm, saved, deleted + undo) × light, dark, ED-Safe
   9  Export CSV errors (write failed, no data, share cancelled) × light, dark
   10 Dark mode: Billing (quota sheet, paywall, cancel). Onboarding dark is built in screens.js (#onbDark)
   11 High Contrast tokens (swatch table + two live frames)
   Loaded BEFORE screens.js so the shared status bar / home indicator is added to every [data-sb]. */
(function () {
  const ic = (id, cls = "") => `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const fig = (id, name, desc, body, fixes = []) =>
    `<figure class="frame" id="${id}" data-frame="${id}">${body}<figcaption>${name}<span>${desc}</span>${fixes.map((f) => `<i class="fix">${f}</i>`).join("")}</figcaption></figure>`;
  const grab = `<div class="grab"></div>`;
  const put = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };

  /* extra glyph for the share action */
  const sprite = document.querySelector("svg symbol")?.parentNode;
  if (sprite && !document.getElementById("i-share"))
    sprite.insertAdjacentHTML("beforeend", `<symbol id="i-share" viewBox="0 0 24 24"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></symbol>`);

  /* ======================= 8 · DIARY: EDIT AN ITEM ======================= */
  const MODES = [
    { key: "light", cls: "", ed: false, label: "light" },
    { key: "dark", cls: "dark", ed: false, label: "dark" },
    { key: "ed", cls: "", ed: true, label: "ED-Safe" },
  ];
  const diaryShell = (cls, inner, overlay = "") =>
    `<div class="phone sheetbg ${cls}" data-sb style="background:#2b2724"><div style="position:absolute;top:58px;left:0;right:0;bottom:0;background:var(--cc-grouped);border-radius:38px 38px 0 0;padding:8px 16px 0;overflow:hidden">${grab}${inner}</div>${overlay}</div>`;
  const gramPill = (g, label) => `<a class="num" aria-label="${label}, ${g} grams. Tap to edit" style="height:44px;min-width:86px;border-radius:14px;background:var(--cc-fill);display:grid;place-items:center;font:600 17px var(--cc-font-round);color:var(--cc-text)">${g} g</a>`;

  const editBody = (ed) => `
    <div class="navbar"><a class="glassbtn" aria-label="Back to Tue, 24 Nov">${ic("back")}</a><span class="t">Edit item</span><span style="width:44px"></span></div>
    <div style="display:flex;gap:14px;align-items:center;margin-top:4px">
      <div class="thumb ph-bowl" style="width:64px;height:64px;border-radius:16px"></div>
      <div style="flex:1;min-width:0">
        <a aria-label="Rename Chicken rice bowl" style="display:flex;align-items:center;gap:6px;font:700 20px/1.2 var(--cc-font);color:var(--cc-text);min-height:28px">Chicken rice bowl ${ic("pencil", "sm")}</a>
        <div style="display:flex;align-items:center;gap:8px;margin-top:6px"><span class="badge hi"><span class="dot"></span>High confidence</span><span style="font:400 13px var(--cc-font);color:var(--cc-text-2)">12:40 · scan</span></div>
      </div>
    </div>
    <div class="seg" style="margin-top:14px" role="radiogroup" aria-label="Meal"><a>Breakfast</a><a class="on" style="color:var(--cc-accent-ink)">Lunch</a><a>Dinner</a><a>Snack</a></div>
    ${ed
      ? `<div class="card" style="margin-top:12px;display:flex;gap:12px;align-items:center;padding:12px 14px">
           <span style="width:40px;height:40px;border-radius:12px;background:var(--cc-accent-tint);color:var(--cc-accent-ink);display:grid;place-items:center;flex:none">${ic("leaf")}</span>
           <div style="font:500 15px/1.4 var(--cc-font)">Adjust the grams if the portion looks off.<br><span style="color:var(--cc-text-2)">Numbers are hidden in ED-Safe mode.</span></div></div>`
      : `<div class="card" style="margin-top:12px;display:flex;align-items:flex-end;justify-content:space-between;padding:12px 14px">
           <div><div style="font:400 13px/1 var(--cc-font);color:var(--cc-text-2)">Total · was 624</div><div class="num" style="font:700 30px/1 var(--cc-font-round);margin-top:6px;letter-spacing:-.02em">650 <small style="font:600 15px var(--cc-font);color:var(--cc-text-2)">kcal</small></div></div>
           <div style="text-align:right;font:500 13px/1.5 var(--cc-font);color:var(--cc-text-2)"><span aria-hidden="true" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--cc-protein);margin-right:2px;vertical-align:1px"></span> P 42 g · <span aria-hidden="true" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--cc-carbs);margin-right:2px;vertical-align:1px"></span> C 79 g<br><span aria-hidden="true" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--cc-fat);margin-right:2px;vertical-align:1px"></span> F 17 g</div></div>`}
    <div class="sechead" style="margin-top:16px"><span>3 items · tap grams to type</span></div>
    <div class="card" style="padding:12px 14px 12px">
      <div style="display:flex;justify-content:space-between;align-items:baseline"><b style="font:600 17px var(--cc-font)">Jasmine rice</b>${ed ? `<span style="font:400 13px var(--cc-font);color:var(--cc-text-2)">was 180 g</span>` : `<span class="num" style="font:600 17px var(--cc-font-round)">260 kcal</span>`}</div>
      <div style="display:flex;gap:8px;align-items:center;margin-top:10px">
        <a class="glassbtn" aria-label="Decrease rice by 10 grams" style="border-radius:14px;background:var(--cc-fill);border:0">${ic("minus")}</a>
        <div role="spinbutton" aria-label="Jasmine rice grams" aria-valuenow="200" style="flex:1;height:44px;border-radius:14px;border:2px solid var(--cc-accent);display:flex;align-items:center;justify-content:center;gap:4px"><span class="num" style="font:700 22px var(--cc-font-round)">200</span><span style="font:500 15px var(--cc-font);color:var(--cc-text-2)">g</span><span style="width:2px;height:22px;background:var(--cc-accent);margin-left:2px"></span></div>
        <a class="glassbtn" aria-label="Increase rice by 10 grams" style="border-radius:14px;background:var(--cc-fill);border:0">${ic("plus")}</a>
      </div>
      <div style="position:relative;height:36px;margin-top:10px;overflow:hidden" aria-hidden="true">
        <div style="position:absolute;inset:0;background:repeating-linear-gradient(90deg,var(--cc-text-3) 0 1px,transparent 1px 10px);mask:linear-gradient(90deg,transparent,#000 20%,#000 80%,transparent);height:14px;top:6px;opacity:.6"></div>
        <div style="position:absolute;inset:0;background:repeating-linear-gradient(90deg,var(--cc-text-2) 0 2px,transparent 2px 50px);mask:linear-gradient(90deg,transparent,#000 20%,#000 80%,transparent);height:22px;top:2px"></div>
        <div style="position:absolute;left:50%;top:0;width:3px;height:28px;margin-left:-1px;background:var(--cc-accent-strong);border-radius:2px"></div>
        <div style="position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:space-between;font:500 11px var(--cc-font);color:var(--cc-text-2);padding:0 18px"><span>100</span><span>150</span><span style="color:var(--cc-accent-ink);font-weight:700">200</span><span>250</span><span>300</span></div>
      </div>
      <div style="display:flex;gap:6px;margin-top:8px"><span class="chip" style="height:32px;font-size:13px">½ cup</span><span class="chip" style="height:32px;font-size:13px">1 cup · 160 g</span><span class="chip" style="height:32px;font-size:13px">1½ cup</span></div>
    </div>
    <div class="group" style="margin-top:8px">
      <div class="cell noicon" style="padding:10px 14px"><span class="lbl" style="font-weight:600">Roast chicken thigh${ed ? "" : `<small>320 kcal</small>`}</span>${gramPill(140, "Roast chicken thigh")}</div>
      <div class="cell noicon" style="padding:10px 14px"><span class="lbl" style="font-weight:600">Cucumber${ed ? "" : `<small>70 kcal incl. dressing</small>`}</span>${gramPill(60, "Cucumber")}</div>
    </div>`;
  const editDock = `<div class="dock grouped" style="z-index:22"><a class="btn primary">Save changes</a><a class="btn ghost" style="margin-top:4px;color:var(--cc-error-ink)">${ic("trash", "md")}Delete item</a></div>`;
  const editPhone = (cls, ed, overlay = "") => diaryShell(cls, editBody(ed), editDock + overlay);

  const actionSheet = (ed) => `<div class="scrim" data-scrim></div>
    <div role="dialog" aria-label="Delete Chicken rice bowl?" style="position:absolute;left:8px;right:8px;bottom:30px;z-index:24">
      <div style="background:var(--cc-elevated);border-radius:22px;overflow:hidden">
        <div style="padding:16px 20px 14px;text-align:center"><b style="font:600 15px/1.3 var(--cc-font)">Delete Chicken rice bowl?</b>
          <div style="font:400 13px/1.4 var(--cc-font);color:var(--cc-text-2);margin-top:4px">${ed ? "It will be removed from Lunch." : "This removes 624 kcal from Lunch."} You can undo for 5 seconds.</div></div>
        <a style="display:grid;place-items:center;height:56px;border-top:1px solid var(--cc-separator);font:600 17px var(--cc-font);color:var(--cc-error-ink)">Delete item</a>
      </div>
      <a style="display:grid;place-items:center;height:56px;margin-top:8px;border-radius:22px;background:var(--cc-elevated);font:600 17px var(--cc-font);color:var(--cc-text)">Cancel</a>
    </div>`;

  const mealHead = (icon, name, kcal, ed) => `<div class="sechead"><span style="display:flex;gap:6px;align-items:center;color:var(--cc-text);font-size:15px">${ic(icon, "sm")}${name}</span>${!ed && kcal ? `<span class="num">${kcal}</span>` : ""}</div>`;
  const diaryBody = (ed, state) => {
    const saved = state === "saved";
    const eaten = saved ? "1,310" : "660", left = saved ? "790" : "1,440", lunch = saved ? "900 kcal" : "250 kcal";
    const summary = ed
      ? `<div class="card" style="display:flex;text-align:center;padding:12px 6px;margin-top:6px">
           <div style="flex:1"><div style="font:400 13px var(--cc-font);color:var(--cc-text-2)">Logged</div><div class="num" style="font:700 20px var(--cc-font-round);margin-top:4px">${saved ? 3 : 2} items</div></div>
           <div style="flex:1;border-left:1px solid var(--cc-separator)"><div style="font:400 13px var(--cc-font);color:var(--cc-text-2)">Weight</div><div class="num" style="font:700 20px var(--cc-font-round);margin-top:4px">80.4 kg</div></div></div>`
      : `<div class="card" style="display:flex;text-align:center;padding:12px 6px;margin-top:6px">
           <div style="flex:1"><div style="font:400 13px var(--cc-font);color:var(--cc-text-2)">Eaten</div><div class="num" style="font:700 20px var(--cc-font-round);margin-top:4px">${eaten}</div></div>
           <div style="flex:1;border-left:1px solid var(--cc-separator)"><div style="font:400 13px var(--cc-font);color:var(--cc-text-2)">Goal</div><div class="num" style="font:700 20px var(--cc-font-round);margin-top:4px">2,100</div></div>
           <div style="flex:1;border-left:1px solid var(--cc-separator)"><div style="font:400 13px var(--cc-font);color:var(--cc-text-2)">Left</div><div class="num" style="font:700 20px var(--cc-font-round);margin-top:4px;color:var(--cc-accent-ink)">${left}</div></div></div>`;
    const kc = (v) => (ed ? "" : `<div class="kc">${v}</div>`);
    const bowl = `<div class="foodrow edited"><div class="thumb ph-bowl" style="width:44px;height:44px"></div><div class="meta"><b>Chicken rice bowl</b><span>400 g <span class="badge hi mini"><span class="dot"></span>High</span><span class="tag">Edited</span></span></div>${kc(650)}</div>`;
    const toast = `<div class="foodrow"${saved ? ` style="border-top:1px solid var(--cc-separator)"` : ""}><div class="thumb ph-toast" style="width:44px;height:44px"></div><div class="meta"><b>Avocado toast</b><span>1 slice · from search</span></div>${kc(250)}</div>`;
    return `
      <div class="navbar"><a class="glassbtn" aria-label="Previous day">${ic("back")}</a><span class="t">Tue, 24 Nov</span><a class="glassbtn" aria-label="Close">${ic("x")}</a></div>
      ${summary}
      ${mealHead("sunrise", "Breakfast", "410 kcal", ed)}
      <div class="card" style="padding:2px 14px"><div class="foodrow"><div class="thumb ph-oats" style="width:44px;height:44px"></div><div class="meta"><b>Overnight oats</b><span>260 g <span class="badge md mini"><span class="dot"></span>Medium</span></span></div>${kc(410)}</div></div>
      ${mealHead("sun", "Lunch", lunch, ed)}
      <div class="card" style="padding:2px 14px;overflow:hidden">${saved ? bowl : ""}${toast}</div>
      ${mealHead("moon", "Dinner", "", ed)}
      <a class="btn" style="height:48px;border:1.5px dashed var(--cc-separator);color:var(--cc-accent-ink);font-size:15px;border-radius:14px">${ic("plus", "md")}Add dinner</a>
      ${mealHead("run", "Exercise", "−180 kcal", ed)}
      <div class="card" style="padding:12px 14px;display:flex;justify-content:space-between;font:500 16px var(--cc-font)"><span>Brisk walk · 40 min</span>${ed ? "" : `<span class="num" style="color:var(--cc-text-2)">180</span>`}</div>`;
  };
  const toastEl = (state) => state === "saved"
    ? `<div class="toast" role="status">${ic("check", "md")}<div>Changes saved<small>Chicken rice bowl · 400 g</small></div><a class="act" aria-label="Undo changes">Undo</a></div>`
    : `<div class="toast" role="status">${ic("trash", "md")}<div>Chicken rice bowl deleted<small>Removed from Lunch</small></div><a class="act" aria-label="Undo delete">Undo</a></div>`;
  const diaryPhone = (cls, ed, state) => diaryShell(cls, diaryBody(ed, state), toastEl(state));

  const d = [];
  MODES.forEach((m) => d.push(fig(`d-edit-${m.key}`, `Edit item (${m.label})`,
    m.ed ? "Same control as Review. The total and per-item kcal are removed and the neutral note takes their place. The confidence badge, grams, meal and the “was 180 g” hint stay."
      : m.key === "dark" ? "Same layout on dark. The selected meal segment uses the new fill-elevated grey (accent-ink 4.59:1). The grams field border is a graphic (accent), not text."
      : "Tap a Diary row to push this screen inside the Diary sheet. It reuses the Review grams control: a typed field, 44 pt −/+ (10 g a step), the drag ruler and serving chips. The total shows “was 624” so the change is visible before saving. Save is pinned; Delete sits under it in red ink, never as the primary.",
    editPhone(m.cls, m.ed), m.key === "light" ? ["reuses GramsField", "44pt", "meal change"] : m.ed ? ["ED-Safe keeps badge + grams"] : [])));
  MODES.forEach((m) => d.push(fig(`d-delete-${m.key}`, `Delete confirm (${m.label})`,
    m.ed ? "The message drops the kcal figure and only says where the item goes. Same two buttons."
      : "Native action sheet (RN <code>ActionSheetIOS</code> with <code>destructiveButtonIndex</code>). The message states what will change and that Undo exists. Cancel is the separate bottom button, as iOS draws it.",
    editPhone(m.cls, m.ed, actionSheet(m.ed)), m.key === "light" ? ["no silent delete"] : [])));
  MODES.forEach((m) => d.push(fig(`d-saved-${m.key}`, `Saved (${m.label})`,
    m.ed ? "Back on the Diary day. The summary shows items logged and today's weight (weight stays visible in ED-Safe). No kcal anywhere, including the toast."
      : "Save pops back to the Diary day. The edited row is tinted for 2 s and labelled “Edited”, so colour is not the only cue. Totals update at once. The toast offers Undo for 5 s and stays while VoiceOver is on.",
    diaryPhone(m.cls, m.ed, "saved"), m.key === "light" ? ["visible confirmation", "undo"] : [])));
  MODES.forEach((m) => d.push(fig(`d-deleted-${m.key}`, `Deleted + Undo (${m.label})`,
    m.ed ? "The row is gone and the toast offers Undo. The summary counts items, not kcal."
      : "The row leaves with a 200 ms collapse (reduced motion: a cross-fade). Undo restores the item and its position. After 5 s the delete is sent to the server.",
    diaryPhone(m.cls, m.ed, "deleted"), m.key === "light" ? ["undo instead of a second confirm"] : [])));
  put("diaryEditRow", d.join(""));

  /* ======================= 9 · EXPORT CSV ERRORS ======================= */
  const rangeChips = (on) => `<div role="radiogroup" aria-label="Date range" style="display:flex;gap:8px;margin-top:16px">${["Last 7 days", "Last 30 days", "All time"].map((t) => `<a class="chip tap${t === on ? " on" : ""}" role="radio" aria-checked="${t === on}">${t}</a>`).join("")}</div>`;
  const exportPhone = (cls, state) => {
    const range = state === "nodata" ? "Last 7 days" : "Last 30 days";
    const body = {
      write: `<div class="card" role="alert" style="margin-top:16px;background:var(--cc-error-tint);border:0;display:flex;gap:12px;align-items:flex-start;padding:14px">
          <span style="color:var(--cc-error-ink);flex:none;margin-top:1px">${ic("alert")}</span>
          <div><b style="font:600 17px/1.3 var(--cc-font)">Couldn't create the file</b>
            <div style="font:400 15px/1.45 var(--cc-font);margin-top:4px">Your iPhone may be low on storage. Free up some space, then try again. Nothing in your diary changed.</div>
            <div style="font:400 13px/1.4 var(--cc-font);color:var(--cc-text-2);margin-top:8px">Error EXP-WRITE · 24 Nov, 12:41</div></div></div>`,
      nodata: `<div style="margin-top:16px;border-radius:var(--r-lg);background:var(--cc-fill-elevated);padding:20px 16px;text-align:center">
          <span style="width:48px;height:48px;border-radius:14px;background:var(--cc-elevated);color:var(--cc-text-2);display:inline-grid;place-items:center">${ic("cal")}</span>
          <div style="font:600 17px/1.3 var(--cc-font);margin-top:10px">Nothing logged in the last 7 days</div>
          <div style="font:400 15px/1.45 var(--cc-font);color:var(--cc-text-2);margin-top:4px">There is no file to make for these dates. Pick a longer range to export what you have logged.</div></div>`,
      cancel: `<div class="card" role="status" style="margin-top:16px;background:var(--cc-info-tint);border:0;display:flex;gap:12px;align-items:flex-start;padding:14px">
          <span style="color:var(--cc-info-ink);flex:none;margin-top:1px">${ic("info")}</span>
          <div><b style="font:600 17px/1.3 var(--cc-font)">Not shared</b>
            <div style="font:400 15px/1.45 var(--cc-font);margin-top:4px">Your file is still ready. Share it again, or choose “Save to Files” in the share sheet.</div></div></div>
        <div style="margin-top:10px;border-radius:14px;background:var(--cc-fill-elevated);display:flex;gap:12px;align-items:center;padding:10px 14px">
          <span style="color:var(--cc-text-2)">${ic("receipt")}</span>
          <div style="flex:1;min-width:0"><div style="font:500 15px/1.3 var(--cc-font);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">coachcal-diary-2026-10-26_2026-11-24.csv</div><div style="font:400 13px var(--cc-font);color:var(--cc-text-2);margin-top:2px">42 KB · 31 days · 96 entries</div></div></div>`,
    }[state];
    const btns = {
      write: `<a class="btn primary">Try again</a><a class="btn secondary" style="margin-top:10px">${ic("mail", "md")}Contact us</a><div style="text-align:center;font:400 13px/1.4 var(--cc-font);color:var(--cc-text-2);margin-top:10px">Contact us attaches the error code, never your diary.</div>`,
      nodata: `<a class="btn primary disabled" aria-disabled="true">No entries in the last 7 days</a><a class="btn secondary" style="margin-top:10px">Choose All time</a>`,
      cancel: `<a class="btn primary">${ic("share", "md")}Share again</a><a class="btn secondary" style="margin-top:10px">Done</a>`,
    }[state];
    return `<div class="phone sheetbg ${cls}" data-sb style="background:${cls.includes("dark") ? "#0E0D0C" : "#2b2724"}"><div class="sheet" style="height:610px">${grab}
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px"><b style="font:700 22px/1.2 var(--cc-font)">Export diary</b><a class="glassbtn" aria-label="Close">${ic("x")}</a></div>
      <div style="font:400 15px/1.4 var(--cc-font);color:var(--cc-text-2);margin-top:2px">A CSV of your meals, grams, nutrition and weight.</div>
      ${rangeChips(range)}${body}
      <div style="position:absolute;left:20px;right:20px;bottom:34px">${btns}</div></div></div>`;
  };
  const x = [];
  [["write", "Write failed", "The file could not be written (e.g. storage full). The sheet stays open with an inline error card, never a dead-end alert. The message says what to try and that the diary is safe. “Contact us” attaches a short error code.", ["#60 silent fail", "recoverable"]],
   ["nodata", "No data in range", "The range has no entries. The primary button is disabled and says why, and the one-tap fix (“Choose All time”) is the secondary. If the diary is empty for all time, the chips hide and the copy becomes “Log your first meal to export”.", ["disabled says why"]],
   ["cancel", "Share sheet cancelled", "Closing the share sheet is not an error: no red, no alert. A neutral “Not shared” note keeps the file one tap away. On iOS, RN <code>Share.share()</code> resolves with <code>dismissedAction</code> in this case.", ["cancel ≠ error"]]]
    .forEach(([s, n, desc, fixes]) => ["", "dark"].forEach((cls) =>
      x.push(fig(`x-${s}-${cls || "light"}`, `Export: ${n} (${cls || "light"})`, cls ? "Dark sheet surface is ccElevated; chips, the file row and the secondary button use ccFillElevated so they keep their shape." : desc, exportPhone(cls, s), cls ? [] : fixes))));
  put("exportRow", x.join(""));

  /* ======================= 10 · DARK BILLING ======================= */
  const pv = (t) => `<span class="pv">{${t}}</span>`;
  const quotaDark = `<div class="phone sheetbg dark" data-sb style="background:#0E0D0C"><div class="sheet" style="height:520px">${grab}
      <div style="display:flex;justify-content:flex-end"><a class="glassbtn" aria-label="Close">${ic("x")}</a></div>
      <div style="width:64px;height:64px;border-radius:20px;background:var(--cc-accent-tint);color:var(--cc-accent-ink);display:grid;place-items:center">${ic("scan", "lg")}</div>
      <div style="font:700 26px/1.2 var(--cc-font);margin-top:16px">You've used this week's 3 free scans</div>
      <div style="font:400 17px/1.45 var(--cc-font);color:var(--cc-text-2);margin-top:8px">Scans reset Monday. You can still log anything by search, barcode or description, for free.</div>
      <div style="position:absolute;left:20px;right:20px;bottom:34px"><a class="btn primary">See plans</a><a class="btn secondary" style="margin-top:10px">Log manually, free</a></div></div></div>`;
  const check = (t, muted) => `<div style="display:flex;gap:10px${muted ? ";color:var(--cc-text-2)" : ""}"><span style="color:${muted ? "var(--cc-text-2)" : "var(--cc-accent-ink)"}">${ic(muted ? "info" : "check")}</span>${t}</div>`;
  const paywallDark = `<div class="phone plain dark" data-sb>
      <div class="scroll" style="padding-bottom:200px">
        <div class="navbar"><a class="btn ghost" style="width:auto;padding:0 4px;font-size:15px">Restore</a><span></span><a class="glassbtn" aria-label="Close">${ic("x")}</a></div>
        <div class="ember" style="margin-top:4px;padding:22px;border:1px solid var(--cc-border)">
          <div style="font:600 13px var(--cc-font);color:var(--cc-ember-accent);letter-spacing:.04em">COACHCAL PLUS</div>
          <div style="font:700 26px/1.2 var(--cc-font);margin-top:8px">Unlimited scans and a coach who shows the maths.</div></div>
        <div style="display:flex;flex-direction:column;gap:12px;margin:18px 4px;font:500 16px/1.35 var(--cc-font)">
          ${check("Unlimited photo, barcode and label scans")}${check("Weekly coach review and insights")}${check("CSV export and Apple Health sync")}${check("Manual logging is free on every plan", true)}</div>
        <a role="radio" aria-checked="true" style="display:flex;align-items:center;gap:12px;border:2px solid var(--cc-accent);border-radius:18px;padding:14px 16px;background:var(--cc-accent-tint)">
          <span style="width:24px;height:24px;border-radius:50%;background:var(--cc-accent);display:grid;place-items:center;color:var(--cc-on-accent)">${ic("check", "sm")}</span>
          <div style="flex:1"><b style="font:700 17px var(--cc-font)">Yearly</b><div style="font:400 13px/1.4 var(--cc-font);color:var(--cc-text-2)">${pv("trial")} free, then ${pv("yearly")}/year</div></div>
          <div style="text-align:right"><b class="num" style="font:700 17px var(--cc-font-round)">${pv("perMonth")}</b><div style="font:400 12px var(--cc-font);color:var(--cc-text-2)">per month</div></div></a>
        <a role="radio" aria-checked="false" style="display:flex;align-items:center;gap:12px;border:1.5px solid var(--cc-separator);border-radius:18px;padding:14px 16px;margin-top:8px">
          <span style="width:24px;height:24px;border-radius:50%;border:2px solid var(--cc-text-3)"></span>
          <div style="flex:1"><b style="font:700 17px var(--cc-font)">Monthly</b><div style="font:400 13px var(--cc-font);color:var(--cc-text-2)">${pv("monthly")}/month, no trial</div></div>
          <b class="num" style="font:700 17px var(--cc-font-round)">${pv("monthly")}</b></a>
      </div>
      <div class="dock"><a class="btn primary">Start ${pv("trial")} free trial</a>
        <div class="note">Free for ${pv("trial")}, then ${pv("yearly")}/year. We'll remind you 2 days before you're charged. Cancel any time in Settings.<br><a style="color:var(--cc-text-2);text-decoration:underline">Terms</a> · <a style="color:var(--cc-text-2);text-decoration:underline">Privacy</a></div></div>
    </div>`;
  const cancelDark = `<div class="phone plain dark" data-sb>
      <div class="scroll">
        <div class="navbar"><a class="glassbtn" aria-label="Back">${ic("back")}</a><span class="t">Cancel subscription</span><span style="width:44px"></span></div>
        <div style="font:700 26px/1.2 var(--cc-font);margin-top:16px">Here's what happens if you cancel</div>
        <div class="card" style="margin-top:16px;display:flex;flex-direction:column;gap:14px;font:400 16px/1.4 var(--cc-font)">
          <div style="display:flex;gap:12px"><span style="color:var(--cc-success-ink)">${ic("check")}</span><span>Plus stays on until <b>{expiryDate}</b>. You won't be charged again.</span></div>
          <div style="display:flex;gap:12px"><span style="color:var(--cc-success-ink)">${ic("check")}</span><span>Your diary, weight and streaks are kept.</span></div>
          <div style="display:flex;gap:12px"><span style="color:var(--cc-success-ink)">${ic("check")}</span><span>Manual logging stays free. Photo scans drop to 3 a week.</span></div></div>
        <div style="font:400 13px/1.45 var(--cc-font);color:var(--cc-text-2);margin:12px 4px">Apple handles the cancellation. The next step opens Apple's subscription sheet inside CoachCal.</div>
      </div>
      <div class="dock"><a class="btn destructive">Cancel subscription</a><a class="btn secondary" style="margin-top:10px">Keep Plus</a></div></div>`;
  put("billingDarkRow", [
    fig("b-quota-dark", "Quota reached (dark sheet)", "Sheet surface is ccElevated #2A2724 (not black), so it lifts off the dimmed app. The free path keeps equal weight. Limit and reset day come from the server.", quotaDark, ["dark surface"]),
    fig("b-paywall-dark", "Plans / paywall (dark)", "Prices are <b>not</b> drawn: every dotted-underlined value is filled at runtime from the App Store product. <code>{yearly}</code> and <code>{monthly}</code> = each product's localized <code>displayPrice</code>; <code>{perMonth}</code> = yearly price ÷ 12, formatted in the same currency; <code>{trial}</code> = the introductory offer period (e.g. “7 days”); if there is no offer, the trial line and “Start … free trial” become “Subscribe”. The light paywall uses the same placeholders.", paywallDark, ["3.1.2(c)", "real prices"]),
    fig("b-cancel-dark", "Cancel flow (dark)", "Same single informational step. <code>{expiryDate}</code> comes from the subscription's expiration date. Destructive tint #3A1219 with #FF7088 text is 6.19:1.", cancelDark, []),
  ].join(""));

  /* ======================= 11 · HIGH CONTRAST ======================= */
  const hcRow = document.getElementById("hcRow");
  if (hcRow) {
    const names = ["on-accent", "accent-strong", "accent-ink", "accent-tint", "ember", "ember-track", "ember-accent", "text", "text-2", "text-3"];
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;left:-9999px";
    probe.innerHTML = ["", "hc", "dark", "dark hc"].map((c) => `<div class="${c}"></div>`).join("");
    document.body.appendChild(probe);
    const val = (i, n) => getComputedStyle(probe.children[i]).getPropertyValue(`--cc-${n}`).trim().toUpperCase();
    const cell = (v) => `<td><span class="hc-sw" style="background:${v}"></span><code>${v}</code></td>`;
    const rows = names.map((n) => `<tr><td><code>--cc-${n}</code></td>${[0, 1, 2, 3].map((i) => cell(val(i, n))).join("")}</tr>`).join("");
    probe.remove();
    hcRow.innerHTML =
      fig("hc-table", "High Contrast overrides (read live from tokens.css)",
        "Only these ten tokens change. Classes: <code>.hc</code> (light) and <code>.dark.hc</code> (dark), applied when iOS “Increase Contrast” is on. In RN, pass them as <code>highContrastLight</code> / <code>highContrastDark</code> to <code>DynamicColorIOS</code>.",
        `<table class="hc-table"><thead><tr><th>Token</th><th>Light</th><th>HC light</th><th>Dark</th><th>HC dark</th></tr></thead><tbody>${rows}</tbody></table>`) +
      fig("hc-edit-light", "Edit item (High Contrast light)", "Accent text and graphics darken (ink #8F3400, strong #C24D00), secondary text goes to #4A4643, on-accent to pure black.", editPhone("hc", false)) +
      fig("hc-edit-dark", "Edit item (High Contrast dark)", "Accent text brightens to #FF9A52, text to pure white, secondary text to #C8C3BD.", editPhone("dark hc", false));
  }
})();
