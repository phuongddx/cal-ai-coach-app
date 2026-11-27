/* CoachCal Redesign v2: shared chrome + generated bands (design system, onboarding, glanceables, icon). */
(function () {
  const ic = (id, cls = "") => `<svg class="i ${cls}"><use href="#i-${id}"/></svg>`;

  /* ---------- Device chrome: status bar, home indicator, tab bar ---------- */
  document.querySelectorAll("[data-sb]").forEach((p) => {
    p.insertAdjacentHTML("afterbegin",
      `<div class="sb"><span>9:41</span><span class="island"></span><span class="sys"><i></i><b></b></span></div>`);
    p.insertAdjacentHTML("beforeend", `<div class="home"></div>`);
  });
  const tabs = [["sun", "Today"], ["chart", "Progress"], ["spark", "Coach"], ["user", "Profile"]];
  document.querySelectorAll("[data-tab]").forEach((p) => {
    const on = +p.dataset.tab;
    p.insertAdjacentHTML("beforeend",
      `<div class="tabwrap"><nav class="tabbar" aria-label="Tabs">${tabs.map(([i, l], n) =>
        `<a class="${n === on ? "on" : ""}" aria-label="${l}">${ic(i, "md")}${l}</a>`).join("")}</nav>
        <a class="fab" aria-label="Scan food">${ic("camera")}</a></div>`);
  });

  /* ---------- 0. Design system ---------- */
  const ds = document.getElementById("ds");
  if (ds) {
    const sw = (name, hex, fg, note) =>
      `<div class="sw"><div class="chipc" style="background:${hex};color:${fg}">Aa</div><b>${name}</b><code>${hex}</code><span>${note}</span></div>`;
    ds.innerHTML = `
    <div class="ds-grid">
      <div class="ds-card"><h3>Brand</h3><div class="sws">
        ${sw("accent", "#FF6A00", "#0B0A09", "Fill only · black label 6.89:1")}
        ${sw("accent-pressed", "#E35A00", "#0B0A09", "Pressed · 5.40:1")}
        ${sw("accent-strong", "#E35A00", "#fff", "Graphics on light · 3.67:1")}
        ${sw("accent-ink", "#B84300", "#fff", "Text on light · 5.47:1")}
        ${sw("accent-tint", "#FFEBDC", "#B84300", "Selected bg · ink 4.73:1")}
        ${sw("ember", "#141210", "#FF7A1F", "Hero card · ring 6.51:1")}
      </div></div>
      <div class="ds-card"><h3>Neutrals (warm)</h3><div class="sws">
        ${sw("text", "#141210", "#fff", "18.69:1")}
        ${sw("text-2", "#5F5B57", "#fff", "6.73:1")}
        ${sw("text-3", "#6F6A65", "#fff", "5.35:1 · was 2.21:1")}
        ${sw("grouped", "#F6F5F3", "#141210", "Grouped bg")}
        ${sw("fill", "#EFEDEA", "#141210", "Controls · tracks")}
        ${sw("dark card", "#1C1A18", "#F7F5F2", "Dark text 15.94:1")}
      </div></div>
      <div class="ds-card"><h3>Semantic (warning is no longer orange)</h3><div class="sws">
        ${sw("success", "#22A653", "#fff", "ink #146C34 · 6.51:1")}
        ${sw("caution", "#E0A800", "#141210", "ink #6E5300 · 7.24:1")}
        ${sw("error", "#E5243B", "#fff", "ink #B3122E · 6.90:1")}
        ${sw("info", "#2563EB", "#fff", "ink #1D4ED8 · 6.70:1")}
      </div></div>
      <div class="ds-card"><h3>Macros (carbs move off orange)</h3><div class="sws">
        ${sw("protein", "#2563EB", "#fff", "5.17:1")}
        ${sw("carbs", "#0E8A7E", "#fff", "4.24:1")}
        ${sw("fat", "#7C4DDB", "#fff", "5.33:1")}
        ${sw("fiber", "#2E8B47", "#fff", "4.29:1")}
      </div></div>
      <div class="ds-card"><h3>Type: SF Pro, Dynamic Type styles</h3>
        <div class="tscale">
          <div style="font:700 34px/1.1 var(--cc-font)">Large Title 34</div>
          <div style="font:700 28px/1.15 var(--cc-font)">Title 1 · 28</div>
          <div style="font:700 22px/1.2 var(--cc-font)">Title 2 · 22</div>
          <div style="font:600 17px/1.3 var(--cc-font)">Headline 17</div>
          <div style="font:400 17px/1.35 var(--cc-font)">Body 17. Grams, kcal and labels.</div>
          <div style="font:400 15px/1.35 var(--cc-font);color:var(--cc-text-2)">Subheadline 15</div>
          <div style="font:400 13px/1.35 var(--cc-font);color:var(--cc-text-2)">Footnote 13</div>
          <div class="num" style="font:700 44px/1 var(--cc-font-round)">1,284 <small style="font:600 15px var(--cc-font);color:var(--cc-text-2)">SF Pro Rounded, numbers</small></div>
        </div></div>
      <div class="ds-card"><h3>Components</h3>
        <div style="display:flex;flex-direction:column;gap:10px">
          <a class="btn primary">Primary · black on orange</a>
          <div style="display:flex;gap:8px"><a class="btn secondary">Secondary</a><a class="btn destructive">Destructive</a></div>
          <a class="btn primary disabled">Disabled, says why</a>
          <div style="display:flex;gap:6px;flex-wrap:wrap"><span class="chip on">Selected</span><span class="chip">Chip</span><span class="chip tint">Tint</span></div>
          <div style="display:flex;gap:6px;flex-wrap:wrap"><span class="badge hi"><span class="dot"></span>High confidence</span><span class="badge md"><span class="dot"></span>Medium confidence</span><span class="badge lo"><span class="dot"></span>Low confidence</span></div>
          <div class="seg"><a>Breakfast</a><a class="on" style="color:var(--cc-accent-ink)">Lunch</a><a>Dinner</a><a>Snack</a></div>
          <div style="display:flex;gap:10px;align-items:center"><span class="toggle on"></span><span class="toggle"></span><span style="font:400 13px var(--cc-font);color:var(--cc-text-2)">On state uses accent-strong (3.67:1); the knob position carries state too.</span></div>
        </div></div>
      <div class="ds-card"><h3>Spacing, radii, sizes</h3>
        <div style="display:flex;gap:6px;align-items:flex-end">${[4,8,12,16,20,24,32,40,48].map(s=>`<div style="text-align:center;font:500 11px var(--cc-font);color:var(--cc-text-2)"><div style="width:${s}px;height:${s}px;background:var(--cc-accent-strong);border-radius:3px;margin:0 auto 4px"></div>${s}</div>`).join("")}</div>
        <div style="display:flex;gap:10px;margin-top:16px">${[10,14,20,28].map(r=>`<div style="width:56px;height:56px;border:2px solid var(--cc-text-3);border-radius:${r}px;display:grid;place-items:center;font:500 12px var(--cc-font)">${r}</div>`).join("")}</div>
        <p style="font:400 13px/1.5 var(--cc-font);color:var(--cc-text-2);margin-top:14px">Tap target 44 · button 56 · shutter 76 · ring 184/16. Tokens live in <code>Tokens.swift</code> and <code>Colors.xcassets</code> with Any / Dark / High Contrast. No literal hex in feature code.</p></div>
      <div class="ds-card dark" style="background:#000"><h3 style="color:#F7F5F2">Dark mode</h3><div class="sws">
        ${sw("accent", "#FF6A00", "#0B0A09", "Same fill in both modes")}
        ${sw("accent-ink", "#FF7A1F", "#000", "Text · 6.66:1 card")}
        ${sw("card", "#1C1A18", "#F7F5F2", "Warm, not grey")}
        ${sw("text-3", "#9A958F", "#000", "5.00:1 elevated")}
        ${sw("caution", "#FFD43B", "#000", "Yellow")}
        ${sw("carbs", "#3CCFBE", "#000", "Teal")}
      </div></div>
    </div>`;
  }

  /* ---------- 5. Onboarding: 9 steps ---------- */
  const onb = document.getElementById("onb");
  if (onb) {
    const rail = (n) => `<div style="display:flex;gap:4px;margin:4px 0 0">${Array.from({ length: 9 }, (_, i) =>
      `<i style="flex:1;height:4px;border-radius:2px;background:${i < n ? "var(--cc-accent-strong)" : "var(--cc-fill)"}"></i>`).join("")}</div>`;
    const nav = (n) => `<div class="navbar" style="margin-top:4px">${n > 1 ? `<a class="glassbtn" aria-label="Back">${ic("back")}</a>` : `<span style="width:44px"></span>`}<span class="t" style="font:600 13px var(--cc-font);color:var(--cc-text-2)">Step ${n} of 9</span><a class="btn ghost" style="width:auto;padding:0 4px;font-size:15px;height:44px">${n < 7 ? "Skip" : ""}</a></div>${rail(n)}`;
    const opt = (title, sub, on, icon) => `<a style="display:flex;gap:12px;align-items:center;min-height:64px;padding:12px 16px;border-radius:18px;border:${on ? "2px solid var(--cc-accent)" : "1.5px solid var(--cc-separator)"};background:${on ? "var(--cc-accent-tint)" : "var(--cc-card)"}">${icon ? `<span style="width:40px;height:40px;border-radius:12px;background:${on ? "var(--cc-accent)" : "var(--cc-fill)"};color:${on ? "#0B0A09" : "var(--cc-text)"};display:grid;place-items:center">${ic(icon)}</span>` : ""}<div style="flex:1"><b style="font:600 17px var(--cc-font)">${title}</b>${sub ? `<div style="font:400 13px var(--cc-font);color:var(--cc-text-2);margin-top:2px">${sub}</div>` : ""}</div>${on ? `<span style="width:24px;height:24px;border-radius:50%;background:var(--cc-accent);color:#0B0A09;display:grid;place-items:center">${ic("check", "sm")}</span>` : ""}</a>`;
    const field = (label, value, unit) => `<div><div style="font:500 13px var(--cc-font);color:var(--cc-text-2);margin-bottom:6px">${label}</div><div style="height:56px;border-radius:14px;background:var(--cc-fill);display:flex;align-items:center;padding:0 16px;gap:6px"><b class="num" style="font:700 22px var(--cc-font-round)">${value}</b><span style="color:var(--cc-text-2);font:500 15px var(--cc-font)">${unit}</span></div></div>`;
    const title = (t, s) => `<div style="font:700 28px/1.15 var(--cc-font);margin-top:22px">${t}</div>${s ? `<div style="font:400 17px/1.4 var(--cc-font);color:var(--cc-text-2);margin-top:8px">${s}</div>` : ""}`;
    const dock = (label, extra = "") => `<div class="dock"><a class="btn primary">${label}</a>${extra}</div>`;
    const frame = (n, name, body, cap, fixes = [], cls = "plain", dockHtml = dock("Continue")) =>
      `<figure class="frame"><div class="phone ${cls}" data-sb2><div class="scroll" style="padding-bottom:150px">${n ? nav(n) : ""}${body}</div>${dockHtml}</div><figcaption>${n ? n + " · " : ""}${name}<span>${cap}</span>${fixes.map(f => `<i class="fix">${f}</i>`).join("")}</figcaption></figure>`;

    const steps = [
      `<figure class="frame"><div class="phone dark on-dark" style="background:#000" data-sb2>
        <div class="ph-bowl" style="position:absolute;left:-40px;top:70px;width:470px;height:470px;border-radius:50%"></div>
        <div style="position:absolute;left:0;right:0;top:300px;height:260px;background:linear-gradient(to bottom,transparent,#000)"></div>
        <svg style="position:absolute;left:70px;top:150px;width:250px;height:250px" viewBox="0 0 312 312" fill="none" stroke="#FF6A00" stroke-width="6" stroke-linecap="round"><path d="M4 52V28A24 24 0 0 1 28 4h24M260 4h24a24 24 0 0 1 24 24v24M308 260v24a24 24 0 0 1-24 24h-24M52 308H28A24 24 0 0 1 4 284v-24"/></svg>
        <span class="badge hi" style="position:absolute;left:110px;top:420px;background:#12301E;color:#4ADE80"><span class="dot"></span>High confidence · 624 kcal</span>
        <div style="position:absolute;left:24px;right:24px;top:500px">
          <div style="font:600 13px var(--cc-font);color:#FF7A1F;letter-spacing:.06em">COACHCAL</div>
          <div style="font:700 34px/1.1 var(--cc-font);color:#F7F5F2;margin-top:8px">Snap your plate. See the estimate and how sure we are.</div>
        </div>
        <div class="dock" style="background:linear-gradient(to top,#000 70%,transparent)"><a class="btn primary">Get started</a><a class="btn ghost" style="color:#F7F5F2;margin-top:4px">I already have an account</a></div>
      </div><figcaption>1 · Welcome<span>The value is shown, not described: a real plate, the brackets and the confidence badge. No email gate before the value.</span></figcaption></figure>`,

      frame(2, "Goal", title("What brings you here?", "This sets your starting plan. You can change it any time.") +
        `<div style="display:flex;flex-direction:column;gap:10px;margin-top:22px">${opt("Lose weight", "A gentle, steady deficit", true, "chart")}${opt("Maintain", "Keep things steady", false, "target")}${opt("Gain muscle", "A small surplus with more protein", false, "dumbbell")}${opt("Just eat better", "No calorie target. Focus on balance", false, "leaf")}</div>`,
        "“Just eat better” leads to a plan without a calorie target, which suits ED-Safe from day one.", []),

      frame(3, "About you", title("A few basics", "Used only to estimate your energy needs.") +
        `<div style="display:flex;flex-direction:column;gap:14px;margin-top:22px">
          <div><div style="font:500 13px var(--cc-font);color:var(--cc-text-2);margin-bottom:6px">Sex used for the formula</div><div class="seg"><a class="on" style="color:var(--cc-accent-ink)">Female</a><a>Male</a><a>Prefer not to say</a></div></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${field("Age", "29", "years")}${field("Height", "172", "cm")}</div>
          ${field("Current weight", "80.6", "kg")}
          <div class="seg" style="width:160px"><a class="on">Metric</a><a>Imperial</a></div>
        </div>`,
        "“Prefer not to say” uses the average of both formulas. Units can be switched here, so imperial users don't have to wait for Settings.", ["inclusive option", "#28 units"]),

      frame(4, "Goal weight and pace", title("Where would you like to be?") +
        `<div style="display:flex;flex-direction:column;gap:14px;margin-top:22px">${field("Goal weight", "76", "kg")}
          <div><div style="font:500 13px var(--cc-font);color:var(--cc-text-2);margin-bottom:6px">Pace</div><div class="seg"><a>Relaxed<br></a><a class="on" style="color:var(--cc-accent-ink)">Steady</a><a>Faster</a></div>
          <div class="card" style="margin-top:10px;background:var(--cc-grouped);border:0;font:400 15px/1.45 var(--cc-font)">About <b>0.4 kg a week</b>. Most people can keep this pace without feeling hungry all the time.</div></div>
          <div class="card" style="display:flex;gap:10px;background:var(--cc-caution-tint);border:0;font:400 13px/1.45 var(--cc-font);color:var(--cc-caution-ink)">${ic("info", "md")}<span>We never suggest going below 1,200 kcal (women) or 1,500 kcal (men) without a clinician.</span></div>
        </div>`,
        "The pace is described in plain words. A safety floor is stated up front and uses caution yellow, not orange.", ["caution ≠ brand"]),

      frame(5, "Activity and diet", title("How active are you?") +
        `<div style="display:flex;flex-direction:column;gap:8px;margin-top:18px">${opt("Mostly sitting", "Desk job, little exercise", false)}${opt("Lightly active", "Walks, 1–2 workouts a week", true)}${opt("Active", "3–5 workouts a week", false)}</div>
        <div style="font:600 15px var(--cc-font);margin-top:20px">Any diet we should know about?</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px"><span class="chip">None</span><span class="chip on">Vegetarian</span><span class="chip">Vegan</span><span class="chip">Halal</span><span class="chip">Low carb</span><span class="chip">Gluten free</span></div>`,
        "Two light questions on one screen instead of two screens. Chips are 44 pt tall.", []),

      frame(6, "Projection", title("Here's a realistic path", "Based on a steady 0.4 kg a week.") +
        `<div class="card" style="margin-top:20px">
          <svg viewBox="0 0 326 170" style="width:100%;height:170px" aria-label="Projected weight from 80.6 to 76 kilograms by late March">
            <g stroke="var(--cc-separator)"><path d="M0 30H300M0 80H300M0 130H300"/></g>
            <g font-family="-apple-system" font-size="11" fill="var(--cc-text-2)"><text x="304" y="34">81</text><text x="304" y="84">78.5</text><text x="304" y="134">76</text><text x="0" y="164">Today</text><text x="250" y="164">Late Mar</text></g>
            <path d="M8 34 C 90 60, 180 110, 286 130" fill="none" stroke="var(--cc-accent-strong)" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="1 0"/>
            <path d="M8 34 C 90 50, 180 95, 286 116 M8 34 C 90 70, 180 125, 286 144" fill="none" stroke="var(--cc-accent-strong)" stroke-width="1" opacity=".35"/>
            <circle cx="8" cy="34" r="6" fill="var(--cc-accent-strong)"/><circle cx="286" cy="130" r="6" fill="var(--cc-card)" stroke="var(--cc-accent-strong)" stroke-width="3"/>
          </svg>
          <div style="font:400 15px/1.45 var(--cc-font);color:var(--cc-text-2);margin-top:6px">Real weight goes up and down day to day. The shaded band shows the normal range.</div>
        </div>`,
        "The projection shows a range, not a promise, and never shows a “before/after” body.", ["honest projection"]),

      frame(7, "Privacy, Health and ED-Safe", title("You choose what we see") +
        `<div class="group" style="margin-top:20px">
          <div class="cell" style="align-items:flex-start;padding:14px 16px"><span class="ic" style="background:#E5243B">${ic("heart")}</span><span class="lbl">Connect Apple Health<small>Read weight and workouts. Write meals. You'll see Apple's permission sheet next.</small></span><span class="toggle on"></span></div>
          <div class="cell" style="align-items:flex-start;padding:14px 16px"><span class="ic" style="background:#2563EB">${ic("bell")}</span><span class="lbl">Meal reminders<small>Up to 3 a day. Never about weight.</small></span><span class="toggle"></span></div>
          <div class="cell" style="align-items:flex-start;padding:14px 16px"><span class="ic" style="background:var(--cc-fat)">${ic("eyeoff")}</span><span class="lbl">ED-Safe mode<small>Hide calorie numbers everywhere, including your plan on the next screen.</small></span><span class="toggle"></span></div>
        </div>
        <div style="display:flex;gap:10px;margin-top:14px;font:400 13px/1.45 var(--cc-font);color:var(--cc-text-2)">${ic("shield", "md")}<span>Photos are used to estimate your meal and are not used to train models. <a style="color:var(--cc-accent-ink);text-decoration:underline;display:inline-block;padding:14px 0;margin:-14px 0">Privacy policy</a></span></div>`,
        "ED-Safe can be turned on before the first number appears, so the plan reveal respects it. Health access is explained before the system sheet.", ["ED-Safe before numbers"]),

      frame(8, "Building your plan", `<div style="display:flex;flex-direction:column;align-items:center;text-align:center;margin-top:60px">
          <div class="ring" style="--ring:140px"><svg viewBox="0 0 184 184"><circle cx="92" cy="92" r="76" fill="none" stroke="var(--cc-fill)" stroke-width="16"/><circle cx="92" cy="92" r="76" fill="none" stroke="var(--cc-accent-strong)" stroke-width="16" stroke-linecap="round" stroke-dasharray="330 478"/></svg><div class="center">${ic("spark", "lg")}</div></div>
          <div style="font:700 26px/1.2 var(--cc-font);margin-top:24px">Working out your numbers</div>
        </div>
        <div class="card" style="margin-top:24px;font:400 15px/1.6 var(--cc-font)">
          <div style="display:flex;justify-content:space-between"><span style="color:var(--cc-text-2)">Resting energy (Mifflin-St Jeor)</span><b class="num">1,590</b></div>
          <div style="display:flex;justify-content:space-between"><span style="color:var(--cc-text-2)">× Lightly active 1.375</span><b class="num">2,186</b></div>
          <div style="display:flex;justify-content:space-between"><span style="color:var(--cc-text-2)">− Steady pace</span><b class="num">−440</b></div>
          <div style="display:flex;justify-content:space-between;border-top:1px solid var(--cc-separator);margin-top:6px;padding-top:6px"><span>Daily target</span><b class="num" style="color:var(--cc-accent-ink)">1,750 kcal</b></div>
        </div>`,
        "The real calculation is shown line by line as it completes, with no fake loading bar. This step takes about a second. Under ED-Safe it shows only “Balancing your meals”.", ["#53 fake progress"], "plain", `<div class="dock"><a class="btn primary disabled">Almost there</a></div>`),

      frame(9, "Your plan", title("Your plan is ready") +
        `<div class="ember" style="margin-top:20px"><div style="display:flex;gap:18px;align-items:center">
          <div class="ring" style="--ring:120px"><svg viewBox="0 0 184 184"><circle cx="92" cy="92" r="76" fill="none" stroke="#3A342F" stroke-width="18"/><circle cx="92" cy="92" r="76" fill="none" stroke="#FF6A00" stroke-width="18" stroke-linecap="round" stroke-dasharray="477 478"/></svg><div class="center"><div class="num" style="font:700 26px/1 var(--cc-font-round)">1,750</div><div style="font:500 12px var(--cc-font);color:#ABA6A0">kcal / day</div></div></div>
          <div style="flex:1;font:500 14px/1.9 var(--cc-font);color:#ABA6A0"><div><span style="color:#6EA8FF">●</span> Protein <b style="color:#F7F5F2">130 g</b></div><div><span style="color:#3CCFBE">●</span> Carbs <b style="color:#F7F5F2">175 g</b></div><div><span style="color:#B794FF">●</span> Fat <b style="color:#F7F5F2">60 g</b></div></div>
        </div></div>
        <div class="group" style="margin-top:12px"><div class="cell noicon"><span class="lbl">Goal</span><span class="val">76 kg by late March</span></div><div class="cell noicon"><span class="lbl">Free scans</span><span class="val">3 a week</span></div></div>
        <div style="font:400 13px/1.45 var(--cc-font);color:var(--cc-text-2);margin-top:12px">You can edit any of this in Profile. The scan limit comes from your plan.</div>`,
        "The reveal sits on the ember card. Scan limits are stated before any paywall. The paywall is offered once after this screen and can always be closed.", ["transparent billing"], "plain", dock("Start logging", `<div class="note">Next: an optional look at CoachCal Plus. You can close it.</div>`)),
    ];
    onb.innerHTML = steps.join("");
    onb.querySelectorAll("[data-sb2]").forEach((p) => {
      p.insertAdjacentHTML("afterbegin", `<div class="sb"><span>9:41</span><span class="island"></span><span class="sys"><i></i><b></b></span></div>`);
      p.insertAdjacentHTML("beforeend", `<div class="home"></div>`);
    });
  }

  /* ---------- 6. Widgets + Live Activity ---------- */
  const g = document.getElementById("glanceRow");
  if (g) {
    const ring = (size, pct, stroke, track = "#3A342F", color = "#FF6A00") => {
      const c = 2 * Math.PI * 40; return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" style="transform:rotate(-90deg)"><circle cx="50" cy="50" r="40" fill="none" stroke="${track}" stroke-width="${stroke}"/><circle cx="50" cy="50" r="40" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${(c * pct).toFixed(1)} ${c.toFixed(1)}"/></svg>`; };
    const W = (w, h, body, extra = "") => `<div style="width:${w}px;height:${h}px;border-radius:22px;background:#141210;color:#F7F5F2;position:relative;overflow:hidden;padding:14px;box-shadow:0 10px 30px rgba(0,0,0,.18);${extra}">${body}</div>`;
    const cap = (t, s) => `<figcaption>${t}<span>${s}</span></figcaption>`;
    const glow = `<div style="position:absolute;right:-60px;top:-70px;width:180px;height:180px;background:radial-gradient(closest-side,rgba(255,106,0,.35),transparent)"></div>`;

    const small = W(170, 170, `${glow}<div style="position:relative;display:grid;place-items:center;height:100%"><div style="position:relative;width:112px;height:112px">${ring(112, .61, 11)}<div style="position:absolute;inset:0;display:grid;place-items:center;text-align:center"><div><div class="num" style="font:700 26px/1 var(--cc-font-round)">816</div><div style="font:500 11px var(--cc-font);color:#ABA6A0;margin-top:2px">kcal left</div></div></div></div></div><div style="position:absolute;left:14px;top:12px;font:600 11px var(--cc-font);color:#FF7A1F">CoachCal</div>`);
    const smallEd = W(170, 170, `${glow}<div style="position:relative;display:grid;place-items:center;height:100%"><div style="position:relative;width:112px;height:112px">${ring(112, .66, 11)}<div style="position:absolute;inset:0;display:grid;place-items:center;text-align:center"><div><div style="font:700 17px/1.1 var(--cc-font)">On track</div><div style="font:500 11px var(--cc-font);color:#ABA6A0;margin-top:2px">2 of 3 meals</div></div></div></div></div><div style="position:absolute;left:14px;top:12px;font:600 11px var(--cc-font);color:#FF7A1F">CoachCal</div>`);
    const medium = W(364, 170, `${glow}<div style="position:relative;display:flex;gap:16px;align-items:center;height:100%"><div style="position:relative;width:120px;height:120px;flex:none">${ring(120, .61, 11)}<div style="position:absolute;inset:0;display:grid;place-items:center;text-align:center"><div><div class="num" style="font:700 26px/1 var(--cc-font-round)">816</div><div style="font:500 11px var(--cc-font);color:#ABA6A0">kcal left</div></div></div></div>
      <div style="flex:1;display:flex;flex-direction:column;gap:9px">${[["Protein", "82/130 g", .63, "#6EA8FF"], ["Carbs", "140/210 g", .67, "#3CCFBE"], ["Fat", "38/70 g", .54, "#B794FF"]].map(([k, v, p, c]) => `<div><div style="display:flex;justify-content:space-between;font:500 12px var(--cc-font)"><span style="color:#ABA6A0">${k}</span><span class="num">${v}</span></div><div style="height:6px;border-radius:3px;background:#3A342F;margin-top:4px"><i style="display:block;height:100%;width:${p * 100}%;border-radius:3px;background:${c}"></i></div></div>`).join("")}
      <a style="margin-top:2px;height:32px;border-radius:16px;background:#FF6A00;color:#0B0A09;display:flex;align-items:center;justify-content:center;gap:6px;font:600 13px var(--cc-font)">${ic("camera", "sm")}Scan a meal</a></div></div>`);
    const lockCirc = `<div style="width:72px;height:72px;border-radius:50%;background:rgba(255,255,255,.18);backdrop-filter:blur(10px);position:relative;color:#fff">${ring(72, .61, 8, "rgba(255,255,255,.25)", "#fff")}<div style="position:absolute;inset:0;display:grid;place-items:center;text-align:center"><div><div class="num" style="font:700 17px/1 var(--cc-font-round)">816</div><div style="font:600 9px var(--cc-font);opacity:.8">LEFT</div></div></div></div>`;
    const lockRect = `<div style="width:172px;height:72px;border-radius:16px;background:rgba(255,255,255,.18);backdrop-filter:blur(10px);color:#fff;padding:10px 12px;font:600 13px/1.35 var(--cc-font)"><div style="display:flex;gap:6px;align-items:center">${ic("flame", "sm")}12-day streak</div><div style="opacity:.85;font-weight:500">1,284 of 2,100 kcal</div><div style="height:5px;border-radius:3px;background:rgba(255,255,255,.3);margin-top:4px"><i style="display:block;width:61%;height:100%;border-radius:3px;background:#fff"></i></div></div>`;
    const lock = `<div style="width:390px;height:250px;border-radius:40px;background:linear-gradient(160deg,#3a2a20,#120e0b 60%,#2a1206);padding:20px;position:relative;overflow:hidden">
      <div style="text-align:center;color:#F7F5F2;font:500 15px var(--cc-font);opacity:.85">Tuesday 24 November</div><div style="text-align:center;color:#F7F5F2;font:700 72px/1 var(--cc-font-round);margin-top:2px">9:41</div>
      <div style="display:flex;gap:12px;justify-content:center;margin-top:18px">${lockCirc}${lockRect}</div></div>`;

    const la = `<div style="width:370px;border-radius:26px;background:rgba(20,18,16,.92);color:#F7F5F2;padding:16px 18px;box-shadow:0 10px 30px rgba(0,0,0,.25)">
      <div style="display:flex;align-items:center;gap:10px"><span style="width:28px;height:28px;border-radius:8px;background:#FF6A00;color:#0B0A09;display:grid;place-items:center">${ic("scan", "sm")}</span><b style="font:600 15px var(--cc-font);flex:1">Reading your plate</b><span style="font:500 13px var(--cc-font);color:#ABA6A0">~3 s</span></div>
      <div style="display:flex;gap:12px;align-items:center;margin-top:12px"><div class="ph-bowl" style="width:56px;height:56px;border-radius:14px;flex:none"></div><div style="flex:1"><div style="font:600 17px var(--cc-font)">Chicken rice bowl</div><div style="font:500 13px var(--cc-font);color:#ABA6A0;margin-top:2px">Finding each food · step 2 of 3</div><div style="height:6px;border-radius:3px;background:#3A342F;margin-top:8px"><i style="display:block;width:66%;height:100%;border-radius:3px;background:#FF6A00"></i></div></div></div>
    </div>`;
    const laDone = `<div style="width:370px;border-radius:26px;background:rgba(20,18,16,.92);color:#F7F5F2;padding:16px 18px;box-shadow:0 10px 30px rgba(0,0,0,.25)">
      <div style="display:flex;align-items:center;gap:12px"><div class="ph-bowl" style="width:56px;height:56px;border-radius:14px;flex:none"></div><div style="flex:1"><div style="font:600 17px var(--cc-font)">Ready to review</div><div style="margin-top:6px;display:flex;gap:8px;align-items:center"><span class="badge hi mini" style="background:#12301E;color:#4ADE80"><span class="dot"></span>High</span><span class="num" style="font:600 15px var(--cc-font-round)">624 kcal</span></div></div><a style="height:44px;padding:0 16px;border-radius:22px;background:#FF6A00;color:#0B0A09;display:grid;place-items:center;font:600 15px var(--cc-font)">Review</a></div>
    </div>`;
    const island = (w, h, inner, r = h / 2) => `<div style="width:${w}px;height:${h}px;border-radius:${r}px;background:#000;color:#F7F5F2;display:flex;align-items:center;justify-content:space-between;padding:0 10px;font:600 13px var(--cc-font)">${inner}</div>`;
    const compact = island(250, 37, `<span style="display:flex;align-items:center;gap:6px;color:#FF6A00">${ic("scan", "sm")}</span><span style="width:126px"></span><span style="display:flex;align-items:center;gap:6px"><span style="width:18px;height:18px;border-radius:50%;border:2.5px solid #FF6A00;border-right-color:#3A342F"></span></span>`);
    const minimal = island(37, 37, `<span style="width:20px;height:20px;border-radius:50%;border:3px solid #FF6A00;border-right-color:#3A342F;margin:0 auto"></span>`, 19);
    const expanded = `<div style="width:370px;height:160px;border-radius:44px;background:#000;color:#F7F5F2;padding:18px 22px;position:relative">
      <div style="display:flex;justify-content:space-between;align-items:center"><span style="display:flex;gap:8px;align-items:center;font:600 15px var(--cc-font)"><span style="width:28px;height:28px;border-radius:8px;background:#FF6A00;color:#0B0A09;display:grid;place-items:center">${ic("scan", "sm")}</span>Ready</span><span class="badge hi mini" style="background:#12301E;color:#4ADE80"><span class="dot"></span>High confidence</span></div>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:14px"><div><div style="font:600 17px var(--cc-font)">Chicken rice bowl</div><div class="num" style="font:700 30px var(--cc-font-round);margin-top:4px">624 <small style="font:500 13px var(--cc-font);color:#ABA6A0">kcal · 3 items</small></div></div><a style="height:44px;padding:0 18px;border-radius:22px;background:#FF6A00;color:#0B0A09;display:grid;place-items:center;font:600 15px var(--cc-font)">Review</a></div></div>`;
    const laEd = `<div style="width:370px;border-radius:26px;background:rgba(20,18,16,.92);color:#F7F5F2;padding:16px 18px;box-shadow:0 10px 30px rgba(0,0,0,.25)"><div style="display:flex;align-items:center;gap:12px"><div class="ph-bowl" style="width:56px;height:56px;border-radius:14px;flex:none"></div><div style="flex:1"><div style="font:600 17px var(--cc-font)">Ready to review</div><div style="margin-top:6px"><span class="badge hi mini" style="background:#12301E;color:#4ADE80"><span class="dot"></span>High</span> <span style="font:500 13px var(--cc-font);color:#ABA6A0">3 items</span></div></div><a style="height:44px;padding:0 16px;border-radius:22px;background:#FF6A00;color:#0B0A09;display:grid;place-items:center;font:600 15px var(--cc-font)">Review</a></div></div>`;

    g.innerHTML = [
      `<figure class="frame">${small}${cap("Small widget", "Ember surface and brand ring. Tapping opens Today. Uses <code>containerBackground</code> so StandBy and tinted Home Screens render correctly.")}</figure>`,
      `<figure class="frame">${smallEd}${cap("Small widget · ED-Safe", "Reads the ED-Safe flag from the shared app group. No number anywhere.")}</figure>`,
      `<figure class="frame">${medium}${cap("Medium widget", "Macros plus one Scan button through an App Intent that opens the camera directly.")}</figure>`,
      `<figure class="frame">${lock}${cap("Lock Screen widgets", "Circular and rectangular accessory families render in vibrant mode. The ring is drawn in white so the system can tint it.")}</figure>`,
      `<figure class="frame" style="display:flex;flex-direction:column;gap:14px">${la}${laDone}${cap("Live Activity · Lock Screen", "Active while a scan is processing (steps come from the server) and when it's ready to review. Ends when saved or after 8 h. Height 84–160 pt.")}</figure>`,
      `<figure class="frame" style="display:flex;flex-direction:column;gap:18px;align-items:flex-start">${compact}${minimal}${expanded}${cap("Dynamic Island", "Compact: scan glyph + progress ring. Minimal: progress ring only. Expanded: name, confidence, kcal, Review.")}</figure>`,
      `<figure class="frame">${laEd}${cap("Live Activity · ED-Safe", "The <code>edSafe</code> flag in ContentState removes kcal. The confidence badge stays.")}</figure>`,
    ].join("");
  }

  /* ---------- 7. App icon ---------- */
  const ir = document.getElementById("iconRow");
  if (ir) {
    const glyph = (ring, dot, sw = 150) => `<g transform="translate(18 0)"><path d="M 693 330 A 260 260 0 1 0 693 694" fill="none" stroke="${ring}" stroke-width="${sw}" stroke-linecap="round"/><circle cx="742" cy="512" r="74" fill="${dot}"/></g>`;
    const icon = (bg, ring, dot, extra = "") => `<svg viewBox="0 0 1024 1024" width="180" height="180" style="border-radius:40px;box-shadow:0 12px 30px rgba(0,0,0,.18)${extra}"><defs><radialGradient id="g${bg.replace(/[^a-z0-9]/gi, "")}" cx="30%" cy="22%" r="85%"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="1024" height="1024" fill="${bg}"/>${bg === "#FF6A00" ? `<rect width="1024" height="1024" fill="url(#g${bg.replace(/[^a-z0-9]/gi, "")})"/>` : ""}${glyph(ring, dot)}</svg>`;
    const variants = [
      ["Default", icon("#FF6A00", "#0B0A09", "#0B0A09"), "Neon orange background, black ring and ember dot. Black on #FF6A00 is 6.89:1."],
      ["Dark", icon("#141210", "#FF6A00", "#FF7A1F"), "The background drops to ember black and the glyph turns orange."],
      ["Clear", `<div style="width:180px;height:180px;border-radius:40px;background:linear-gradient(135deg,#d9c8b6,#8f7a66);display:grid;place-items:center;box-shadow:0 12px 30px rgba(0,0,0,.18)"><svg viewBox="0 0 1024 1024" width="180" height="180"><rect width="1024" height="1024" rx="230" fill="rgba(255,255,255,.18)"/>${glyph("rgba(255,255,255,.92)", "rgba(255,255,255,.92)")}</svg></div>`, "The system renders glass; we supply the foreground layer only."],
      ["Tinted", icon("#1a1a1a", "#E8E8E8", "#E8E8E8"), "Grayscale foreground. iOS applies the user's tint."],
    ];
    ir.innerHTML = variants.map(([t, svg, s]) => `<figure class="frame" style="width:200px">${svg}<figcaption>${t}<span>${s}</span></figcaption></figure>`).join("") +
      `<figure class="frame" style="width:520px"><div style="display:flex;gap:16px;align-items:center"><img src="icon/AppIcon-1024.svg" width="120" height="120" style="border-radius:27px" alt="Default icon 1024"><img src="icon/layer-background.svg" width="120" height="120" alt="Background layer"><img src="icon/layer-foreground.svg" width="120" height="120" style="background:repeating-conic-gradient(#ddd 0 25%,#fff 0 50%) 0 0/16px 16px" alt="Foreground layer"></div>
       <figcaption>Icon Composer layers<span>1024 × 1024, square, unmasked. Background is a flat colour, so the system adds the Liquid Glass light. The foreground is the ring plus the dot on transparent. Export a flattened PNG with no alpha for older OS versions. Files: <code>icon/layer-background.svg</code>, <code>icon/layer-foreground.svg</code>, <code>icon/AppIcon-1024.svg</code>. This replaces #FF8841 and the old mark.</span></figcaption></figure>`;
  }
})();
