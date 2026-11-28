/* CoachCal Redesign v2 · round 3 (27/11/2026, after Phương approved Ember)
   12 Sign in (Apple, Google, email + password, wrong password, reset link)
   13 Profile: edit goal sheet (light, dark, ED-Safe, below-healthy-range guardrail)
   14 Scan: Describe a meal (typing, estimating) and Report a problem (Fix Issue) sheets
   15 Paywall when the App Store has not returned prices (loading, failed)
   16 Medium widget ED-Safe and Live Activity while processing (steps 1–3, failed)
   17 Dark mode: Profile, Settings, Food search, Manual log (clones of section 3 with .dark)
   Loaded after screens-additions.js and BEFORE screens.js, so screens.js adds the status bar,
   home indicator and tab bar to every [data-sb] / [data-tab] built here. */
(function () {
  const ic = (id, cls = "") => `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const fig = (id, name, desc, body, fixes = []) =>
    `<figure class="frame" id="${id}" data-frame="${id}">${body}<figcaption>${name}<span>${desc}</span>${fixes.map((f) => `<i class="fix">${f}</i>`).join("")}</figcaption></figure>`;
  const put = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
  const grab = `<div class="grab"></div>`;
  const isDark = (cls) => /\bdark\b/.test(cls);
  const backdrop = (cls) => (isDark(cls) ? "#0E0D0C" : "#2b2724");
  const sheetPhone = (cls, h, inner, extra = "") =>
    `<div class="phone sheetbg ${cls}" data-sb style="background:${backdrop(cls)}"><div class="sheet" style="height:${h}px">${grab}${inner}</div>${extra}</div>`;
  const sheetHead = (title, sub = "") =>
    `<div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px"><b style="font:700 22px/1.2 var(--cc-font)">${title}</b><a class="glassbtn" aria-label="Close">${ic("x")}</a></div>${sub ? `<div style="font:400 15px/1.4 var(--cc-font);color:var(--cc-text-2);margin-top:2px">${sub}</div>` : ""}`;
  const label = (t, mt = 16) => `<div style="font:600 13px/1.2 var(--cc-font);color:var(--cc-text-2);margin:${mt}px 4px 8px">${t}</div>`;
  const pin = (html) => `<div style="position:absolute;left:20px;right:20px;bottom:34px">${html}</div>`;

  /* extra glyphs */
  const sprite = document.querySelector("svg symbol")?.parentNode;
  const addSym = (id, body) => { if (sprite && !document.getElementById("i-" + id)) sprite.insertAdjacentHTML("beforeend", `<symbol id="i-${id}" viewBox="0 0 24 24">${body}</symbol>`); };
  addSym("eye", `<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>`);
  addSym("chat", `<path d="M21 12a8 8 0 0 1-11.8 7L4 20l1.2-4.6A8 8 0 1 1 21 12z"/>`);
  addSym("flagq", `<path d="M4 22V4a1 1 0 0 1 1-1h12l-2 4 2 4H5"/>`);

  /* brand marks (drawn for the mock; the app uses the native buttons, see captions) */
  const appleLogo = (fill) => `<svg width="18" height="22" viewBox="0 0 17 21" aria-hidden="true"><path fill="${fill}" d="M14.1 11.2c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.8-3.5.8-.7 0-1.8-.8-3-.8C4.6 5.9 3.2 6.8 2.4 8.2c-1.6 2.8-.4 6.9 1.2 9.2.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.2 0 2-1.1 2.8-2.2.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.4-.9-2.5-3.7zM11.8 4.4c.6-.8 1.1-1.8.9-2.9-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.8-1 2.8 1.1.1 2.1-.5 2.8-1.3z"/></svg>`;
  const googleG = `<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;
  const mark = (size = 64) => `<svg width="${size}" height="${size}" viewBox="0 0 1024 1024" aria-hidden="true" style="border-radius:${Math.round(size * .225)}px;display:block"><rect width="1024" height="1024" fill="#FF6A00"/><g transform="translate(18 0)"><path d="M 693 330 A 260 260 0 1 0 693 694" fill="none" stroke="#0B0A09" stroke-width="150" stroke-linecap="round"/><circle cx="742" cy="512" r="74" fill="#0B0A09"/></g></svg>`;

  /* ======================= 12 · SIGN IN ======================= */
  const authBtn = (dark, kind) => {
    if (kind === "apple") return `<a class="btn" role="button" aria-label="Sign in with Apple" style="background:${dark ? "#FFFFFF" : "#000000"};color:${dark ? "#000000" : "#FFFFFF"};font:600 17px var(--cc-font);border-radius:14px">${appleLogo(dark ? "#000000" : "#FFFFFF")}Sign in with Apple</a>`;
    if (kind === "google") return `<a class="btn" role="button" aria-label="Continue with Google" style="margin-top:10px;background:${dark ? "#131314" : "#FFFFFF"};color:${dark ? "#E3E3E3" : "#1F1F1F"};border:1px solid ${dark ? "#8E918F" : "#747775"};font:500 17px var(--cc-font);border-radius:14px">${googleG}Continue with Google</a>`;
    return `<a class="btn secondary" style="margin-top:10px;border-radius:14px">${ic("mail", "md")}Continue with email</a>`;
  };
  const signinPhone = (cls) => {
    const dark = isDark(cls);
    return `<div class="phone plain ${cls}" data-sb><div class="scroll" style="padding:0 24px">
      <div class="navbar" style="margin:0 -8px"><a class="glassbtn" aria-label="Back">${ic("back")}</a><span></span><span style="width:44px"></span></div>
      <div style="margin-top:28px">${mark(64)}</div>
      <div style="font:700 32px/1.15 var(--cc-font);letter-spacing:-.01em;margin-top:24px">Sign in to keep your diary safe</div>
      <div style="font:400 17px/1.45 var(--cc-font);color:var(--cc-text-2);margin-top:10px">Your meals, weight and streaks are backed up and stay in sync on your other devices.</div>
      <div style="display:flex;flex-direction:column;gap:12px;margin-top:28px;font:400 15px/1.4 var(--cc-font)">
        <div style="display:flex;gap:10px;align-items:flex-start"><span style="color:var(--cc-accent-ink)">${ic("shield", "md")}</span><span>We never post anywhere or read your contacts.</span></div>
        <div style="display:flex;gap:10px;align-items:flex-start"><span style="color:var(--cc-accent-ink)">${ic("lock", "md")}</span><span>Meal photos are only used for your estimate, never to train models.</span></div>
      </div>
      <div style="position:absolute;left:24px;right:24px;bottom:40px">
        ${authBtn(dark, "apple")}${authBtn(dark, "google")}
        <div aria-hidden="true" style="display:flex;align-items:center;gap:10px;margin:14px 0 4px;font:500 13px var(--cc-font);color:var(--cc-text-2)"><span style="flex:1;height:1px;background:var(--cc-separator)"></span>or<span style="flex:1;height:1px;background:var(--cc-separator)"></span></div>
        ${authBtn(dark, "email")}
        <div style="text-align:center;font:400 13px/1.45 var(--cc-font);color:var(--cc-text-2);margin-top:14px">By continuing you agree to our <a style="color:var(--cc-text-2);text-decoration:underline;display:inline-block;padding:12px 0;margin:-12px 0">Terms</a> and <a style="color:var(--cc-text-2);text-decoration:underline;display:inline-block;padding:12px 0;margin:-12px 0">Privacy Policy</a></div>
      </div></div></div>`;
  };
  const input = ({ lbl, value, placeholder, focus, error, trailing = "", type = "", bg = "var(--cc-fill)" }) =>
    `<label style="display:block;margin-top:14px"><span style="display:block;font:600 13px/1.2 var(--cc-font);color:var(--cc-text-2);margin:0 4px 6px">${lbl}</span>
      <span style="display:flex;align-items:center;gap:6px;height:52px;border-radius:14px;background:${bg};padding:0 4px 0 14px;border:2px solid ${error ? "var(--cc-error)" : focus ? "var(--cc-accent)" : "transparent"}">
        <span style="flex:1;font:400 17px var(--cc-font);color:${value ? "var(--cc-text)" : "var(--cc-text-2)"};${type === "pw" ? "letter-spacing:.18em;" : ""}white-space:nowrap;overflow:hidden">${value || placeholder}${focus ? `<span aria-hidden="true" style="display:inline-block;width:2px;height:22px;background:var(--cc-accent);vertical-align:-4px;margin-left:1px"></span>` : ""}</span>${trailing}</span></label>`;
  const eyeBtn = `<a class="glassbtn" aria-label="Show password" style="background:transparent;border:0;box-shadow:none;color:var(--cc-text-2)">${ic("eye", "md")}</a>`;
  const emailPhone = (cls, state) => {
    const err = state === "error";
    return `<div class="phone plain ${cls}" data-sb><div class="scroll" style="padding:0 20px">
      <div class="navbar" style="margin:0 -4px"><a class="glassbtn" aria-label="Back">${ic("back")}</a><span class="t">Email</span><span style="width:44px"></span></div>
      <div style="font:700 28px/1.2 var(--cc-font);margin-top:12px">Sign in with email</div>
      <div class="seg" role="radiogroup" aria-label="Sign in or create account" style="margin-top:16px"><a class="on" role="radio" aria-checked="true">Sign in</a><a role="radio" aria-checked="false">Create account</a></div>
      ${input({ lbl: "Email", value: "minh@example.com" })}
      ${input({ lbl: "Password", value: "••••••••••", type: "pw", focus: !err, error: err, trailing: eyeBtn })}
      ${err ? `<div role="alert" style="display:flex;gap:8px;align-items:flex-start;margin:10px 4px 0;font:400 15px/1.4 var(--cc-font);color:var(--cc-error-ink)">${ic("alert", "md")}<span>That email and password don't match. Check them, or reset your password.</span></div>` : ""}
      <a class="btn ghost" style="width:auto;justify-content:flex-start;padding:0 4px;margin-top:6px;font-size:15px">Forgot password?</a>
      </div>
      <div class="dock"><a class="btn primary">Sign in</a><div class="note">${err ? "After 5 wrong tries we pause sign-in for 1 minute." : "Create account asks for at least 8 characters and shows the rule before you type."}</div></div></div>`;
  };
  const resetPhone = (cls) => `<div class="phone plain ${cls}" data-sb><div class="scroll" style="padding:0 20px">
      <div class="navbar" style="margin:0 -4px"><a class="glassbtn" aria-label="Back">${ic("back")}</a><span></span><span style="width:44px"></span></div>
      <div style="width:64px;height:64px;border-radius:20px;background:var(--cc-accent-tint);color:var(--cc-accent-ink);display:grid;place-items:center;margin-top:28px">${ic("mail", "lg")}</div>
      <div style="font:700 28px/1.2 var(--cc-font);margin-top:20px">Check your email</div>
      <div style="font:400 17px/1.45 var(--cc-font);color:var(--cc-text-2);margin-top:8px">We sent a link to <b style="color:var(--cc-text)">minh@example.com</b>. Open it on this iPhone to set a new password. The link works for 1 hour.</div>
      <div style="font:400 15px/1.45 var(--cc-font);color:var(--cc-text-2);margin-top:16px">Can't find it? Look in Junk or Promotions.</div>
      </div>
      <div class="dock"><a class="btn primary">Open Mail</a><a class="btn secondary disabled" aria-disabled="true" style="margin-top:10px;color:var(--cc-text-2)">Resend link in 0:42</a><a class="btn ghost" style="margin-top:2px">Use a different email</a></div></div>`;

  /* ---- 12b · e-mail code path (27/11, round 4): the path the app builds now ---- */
  const alertLine = (t) => `<div role="alert" style="display:flex;gap:8px;align-items:flex-start;margin:10px 4px 0;font:400 15px/1.4 var(--cc-font);color:var(--cc-error-ink)">${ic("alert", "md")}<span>${t}</span></div>`;
  const codeEmailPhone = (cls, state) => {
    const err = state === "error";
    return `<div class="phone plain ${cls}" data-sb><div class="scroll" style="padding:0 20px">
      <div class="navbar" style="margin:0 -4px"><a class="glassbtn" aria-label="Back">${ic("back")}</a><span></span><span style="width:44px"></span></div>
      <div style="font:700 28px/1.2 var(--cc-font);margin-top:12px">Continue with email</div>
      <div style="font:400 17px/1.45 var(--cc-font);color:var(--cc-text-2);margin-top:8px">We'll email you a 6-digit code. If you're new, the same code creates your account.</div>
      ${input({ lbl: "Email", value: "minh@example.com", focus: !err, error: err })}
      ${err ? alertLine("We couldn't send the code. Check the address and try again.") : ""}
      </div>
      <div class="dock"><a class="btn primary">Send code</a></div></div>`;
  };
  const codeCells = (digits, { focusAt = -1, error = false } = {}) => {
    const cell = (i) => {
      const d = digits[i] || "";
      const border = error ? "var(--cc-error)" : i === focusAt ? "var(--cc-accent)" : "transparent";
      const caret = i === focusAt && !d ? `<span aria-hidden="true" style="display:inline-block;width:2px;height:28px;background:var(--cc-accent)"></span>` : "";
      return `<span style="width:48px;height:58px;border-radius:12px;background:var(--cc-fill);border:2px solid ${border};display:grid;place-items:center;font:600 28px/1 var(--cc-font-round);font-variant-numeric:tabular-nums;color:var(--cc-text)${i === 3 ? ";margin-left:10px" : ""}">${d}${caret}</span>`;
    };
    return `<div role="textbox" aria-label="6-digit code" aria-invalid="${error}" style="display:flex;gap:8px;justify-content:center;margin-top:24px">${[0, 1, 2, 3, 4, 5].map(cell).join("")}</div>`;
  };
  const codePhone = (cls, state) => {
    const err = state === "error";
    const digits = err ? "482917" : "48291";
    return `<div class="phone plain ${cls}" data-sb><div class="scroll" style="padding:0 20px">
      <div class="navbar" style="margin:0 -4px"><a class="glassbtn" aria-label="Back to email">${ic("back")}</a><span></span><span style="width:44px"></span></div>
      <div style="font:700 28px/1.2 var(--cc-font);margin-top:12px">Enter the code</div>
      <div style="font:400 17px/1.45 var(--cc-font);color:var(--cc-text-2);margin-top:8px">We sent a 6-digit code to <b style="color:var(--cc-text);font-weight:600">minh@example.com</b>.</div>
      ${codeCells(digits, { focusAt: err ? -1 : 5, error: err })}
      ${err ? alertLine("That code is wrong or has expired. Check the latest email, or send a new code.") : ""}
      <div style="font:400 15px/1.45 var(--cc-font);color:var(--cc-text-2);margin:16px 4px 0">Can't find it? Look in Junk or Promotions.</div>
      </div>
      <div class="dock">${err ? `<a class="btn primary">Verify</a>` : `<a class="btn primary disabled" aria-disabled="true">Verify</a>`}
        ${err ? `<a class="btn ghost" style="margin-top:6px">Send a new code</a>` : `<a class="btn ghost disabled" aria-disabled="true" style="margin-top:6px;color:var(--cc-text-2)">Resend code in 0:42</a>`}
        <a class="btn ghost" style="margin-top:2px">Use a different email</a></div></div>`;
  };
  put("authCodeRow", [
    fig("auth-code-email-light", "Email step (light)", "After “Continue with email”. One field, email keyboard, <code>textContentType</code> emailAddress / <code>autoComplete</code> email. “Send code” is docked above the keyboard and stays enabled; an empty or malformed address gets the same inline line as a failed send. No password, no Sign in / Create account switch: new and known addresses take the same path.", codeEmailPhone("", "focus"), ["one path", "no password"]),
    fig("auth-code-email-dark", "Email step (dark)", "Same tokens as the password screens: field on ccFill, accent focus ring and caret.", codeEmailPhone("dark", "focus")),
    fig("auth-code-sendfail-light", "Code could not be sent (light)", "Network error, rate limit or a rejected address all show this one line under the field, announced with <code>role=alert</code>. It never says whether the address has an account.", codeEmailPhone("", "error"), ["inline error", "no account leak"]),
    fig("auth-code-sendfail-dark", "Code could not be sent (dark)", "Error ink #FF7088 on black.", codeEmailPhone("dark", "error")),
    fig("auth-code-entry-light", "Code entry (light)", "Six cells, drawn over ONE hidden text field (<code>keyboardType</code> number-pad, <code>textContentType</code> oneTimeCode, <code>autoComplete</code> one-time-code, maxLength 6), so paste and the keyboard's code suggestion fill all six at once and VoiceOver reads one field, “6-digit code”. Cells are split 3 + 3 for reading. The address sits in the sentence instead of a field; “Use a different email” and Back both return to the email step. Verify enables at 6 digits; no auto-submit (parity with today). Resend counts down from 60 s.", codePhone("", "entry"), ["one field", "paste + autofill", "44pt+"]),
    fig("auth-code-entry-dark", "Code entry (dark)", "Cells on ccFill; the focused cell gets the accent ring and caret.", codePhone("dark", "entry")),
    fig("auth-code-error-light", "Wrong or expired code (light)", "All six cells take the error border and the line under them says only that the code is wrong or expired. The digits stay so the person can fix a typo; typing again clears the error. “Send a new code” is drawn after the 60 s timer has run out; while it runs, the countdown from the entry frame shows instead.", codePhone("", "error"), ["inline error", "keeps digits"]),
    fig("auth-code-error-dark", "Wrong or expired code (dark)", "Error border #FF7088 and the same line.", codePhone("dark", "error")),
  ].join(""));

  put("authRow", [
    fig("auth-signin-light", "Sign in (light)", "Reached from Welcome → “I already have an account”, from Profile when signed out, and before the first scan if the account is required. Apple first (HIG), then Google, then email. In the app use the native buttons: <code>AppleAuthenticationButton</code> (expo-apple-authentication, style BLACK on light / WHITE on dark, corner radius 14) and Google's own button assets, so both brands are drawn by their owners. No skip button is drawn: if guest use is allowed, add a ghost “Not now” under the email row.", signinPhone(""), ["Apple first", "brand buttons", "44pt+"]),
    fig("auth-signin-dark", "Sign in (dark)", "Apple button flips to white with black text, Google to its dark theme (#131314 fill, #8E918F border, #E3E3E3 text), as both guidelines require.", signinPhone("dark")),
    fig("auth-email-light", "Reference only · Email + password (light)", "One screen for both: the segment switches between Sign in and Create account. Email keyboard with autofill (<code>textContentType</code> username / password, <code>autoComplete</code> email / current-password) so iCloud Keychain and passkeys can fill it. The eye button shows the password (44 pt).", emailPhone("", "focus"), ["autofill", "show password"]),
    fig("auth-email-dark", "Reference only · Email + password (dark)", "Fields sit on ccFill. The focus ring is accent (a graphic, 3:1+), the caret too.", emailPhone("dark", "focus")),
    fig("auth-error-light", "Reference only · Wrong password (light)", "The error is inline under the field, in error-ink with an icon, and is announced (<code>role=alert</code>). It never says which of the two was wrong. The button stays enabled; after 5 tries the server rate-limits and the note says so.", emailPhone("", "error"), ["inline error", "no account leak"]),
    fig("auth-error-dark", "Reference only · Wrong password (dark)", "Error ink #FF7088 on black is 7.3:1.", emailPhone("dark", "error")),
    fig("auth-reset-light", "Reference only · Reset link sent (light)", "After “Forgot password?”. Open Mail is primary; Resend unlocks after 60 s and counts down so a tap never looks broken. Dark follows the same tokens.", resetPhone("")),
  ].join(""));

  /* ======================= 13 · PROFILE: EDIT GOAL SHEET ======================= */
  const ruler = (vals, on) => `<div style="position:relative;height:36px;margin-top:10px;overflow:hidden" aria-hidden="true">
      <div style="position:absolute;inset:0;background:repeating-linear-gradient(90deg,var(--cc-text-3) 0 1px,transparent 1px 10px);mask:linear-gradient(90deg,transparent,#000 20%,#000 80%,transparent);height:14px;top:6px;opacity:.6"></div>
      <div style="position:absolute;inset:0;background:repeating-linear-gradient(90deg,var(--cc-text-2) 0 2px,transparent 2px 50px);mask:linear-gradient(90deg,transparent,#000 20%,#000 80%,transparent);height:22px;top:2px"></div>
      <div style="position:absolute;left:50%;top:0;width:3px;height:28px;margin-left:-1px;background:var(--cc-accent-strong);border-radius:2px"></div>
      <div style="position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:space-between;font:500 11px var(--cc-font);color:var(--cc-text-2);padding:0 18px">${vals.map((v) => `<span${v === on ? ` style="color:var(--cc-accent-ink);font-weight:700"` : ""}>${v}</span>`).join("")}</div></div>`;
  const stepper = (val, unit, what, warn) => `<div style="display:flex;gap:8px;align-items:center">
      <a class="glassbtn" aria-label="Decrease ${what} by 0.5 kilograms" style="border-radius:14px">${ic("minus")}</a>
      <div role="spinbutton" aria-label="${what}" aria-valuenow="${val}" style="flex:1;height:44px;border-radius:14px;border:2px solid ${warn ? "var(--cc-caution)" : "var(--cc-accent)"};display:flex;align-items:center;justify-content:center;gap:4px"><span class="num" style="font:700 22px var(--cc-font-round)">${val}</span><span style="font:500 15px var(--cc-font);color:var(--cc-text-2)">${unit}</span></div>
      <a class="glassbtn" aria-label="Increase ${what} by 0.5 kilograms" style="border-radius:14px">${ic("plus")}</a></div>`;
  const paceRow = (name, sub, on, rec) => `<div class="cell noicon" role="radio" aria-checked="${on}" style="min-height:52px;padding:8px 14px">
      <span class="lbl" style="font-weight:${on ? 600 : 400}">${name}${rec ? ` <span class="tag" style="font:600 11px var(--cc-font);color:var(--cc-accent-ink);background:var(--cc-accent-tint);border-radius:6px;padding:3px 6px;vertical-align:2px">Recommended</span>` : ""}<small>${sub}</small></span>
      ${on ? `<span style="color:var(--cc-accent-ink)">${ic("check")}</span>` : ""}</div>`;
  const goalSheet = (cls, mode) => {
    const ed = mode === "ed", floor = mode === "floor";
    const goal = floor ? "54.0" : "76.0";
    const result = floor
      ? `<div class="card" role="alert" style="margin-top:14px;background:var(--cc-caution-tint);border:0;display:flex;gap:12px;align-items:flex-start;padding:14px">
          <span style="color:var(--cc-caution-ink);flex:none">${ic("info")}</span>
          <div style="font:400 15px/1.45 var(--cc-font)"><b style="font-weight:600">54 kg is below the healthy range for your height.</b> We'll plan for <b>59 kg</b>, the lowest weight in that range. A doctor or dietitian can help with a different goal.</div></div>`
      : `<div class="ember" style="margin-top:14px;padding:16px 18px;display:flex;gap:16px;align-items:center">
          ${ed
            ? `<div style="flex:1"><div style="font:500 13px var(--cc-font);color:var(--cc-ember-text-2)">Goal date</div><div style="font:700 22px/1.2 var(--cc-font);color:var(--cc-ember-text);margin-top:4px">76 kg around late March</div><div style="font:400 13px/1.4 var(--cc-font);color:var(--cc-ember-text-2);margin-top:6px">Your meal plan adjusts on its own. Numbers stay hidden.</div></div>`
            : `<div style="flex:1"><div style="font:500 13px var(--cc-font);color:var(--cc-ember-text-2)">Daily target</div><div class="num" style="font:700 30px/1 var(--cc-font-round);color:var(--cc-ember-text);margin-top:6px">1,750 <small style="font:600 15px var(--cc-font);color:var(--cc-ember-text-2)">kcal · was 2,100</small></div></div>
               <div style="text-align:right;font:500 13px/1.4 var(--cc-font);color:var(--cc-ember-text-2)">76 kg<br><span style="color:var(--cc-ember-text)">late March</span></div>`}</div>`;
    return sheetPhone(cls, 786, `${sheetHead("Edit goal")}
      <div style="margin-top:14px;border-radius:14px;background:var(--cc-fill-elevated);display:flex;gap:12px;align-items:center;padding:10px 8px 10px 14px">
        <span style="color:var(--cc-text-2)">${ic("scale")}</span>
        <div style="flex:1"><div style="font:600 16px var(--cc-font)">Current weight · <span class="num">80.6 kg</span></div><div style="font:400 13px var(--cc-font);color:var(--cc-text-2);margin-top:2px">From Apple Health, today</div></div>
        <a class="chip tap" style="height:44px">Update</a></div>
      ${label("Goal weight")}${stepper(goal, "kg", "Goal weight", floor)}${ruler(floor ? ["50", "52", "54", "56", "58"] : ["72", "74", "76", "78", "80"], floor ? "54" : "76")}
      ${label("Pace", 12)}
      <div class="group" role="radiogroup" aria-label="Pace">
        ${paceRow("Gentle", "0.25 kg a week", false)}${paceRow("Steady", "0.5 kg a week", true, true)}${paceRow("Faster", "0.75 kg a week · harder to keep up", false)}</div>
      ${result}
      ${pin(`<a class="btn primary">${floor ? "Save 59 kg goal" : "Save goal"}</a><div style="text-align:center;font:400 13px/1.4 var(--cc-font);color:var(--cc-text-2);margin-top:10px">Past days in your diary don't change.</div>`)}`);
  };
  put("targetRow", [
    fig("p-target-light", "Edit goal sheet (light)", "Opens from Profile → Daily target or Goal weight (large detent). Same stepper and ruler as grams, in 0.5 kg steps (lb when Units = lb). Pace is three named options, never a free number. The result updates live on the ember card and shows the old target, so the change is visible before saving. Current weight comes from Health or the last log; Update opens the weight log.", goalSheet("", "plan"), ["reuses stepper", "live result", "no free-text pace"]),
    fig("p-target-dark", "Edit goal sheet (dark)", "Sheet on ccElevated; the current-weight row and pace group use ccFillElevated so they keep their shape.", goalSheet("dark", "plan")),
    fig("p-target-ed", "Edit goal sheet (ED-Safe)", "Per the 27/11 decision ED-Safe hides only kcal: weight, goal and pace stay. The ember card shows the goal date and a neutral line instead of the daily target.", goalSheet("", "ed"), ["ED-Safe: kcal only"]),
    fig("p-target-floor", "Goal below healthy range (light)", "Guardrail: if the goal is under a BMI of 18.5 for the saved height, the stepper border turns caution-yellow and the card explains that we plan for the lowest healthy weight instead (TargetsEngine clamps, never throws). No red, no blame, and a pointer to real help. The same rule caps pace and keeps the daily target above the safe floor.", goalSheet("", "floor"), ["ED guardrail", "clamp not block"]),
  ].join(""));

  /* ======================= 14 · DESCRIBE + REPORT A PROBLEM ======================= */
  const keyboard = (dark) => {
    const key = dark ? "#6B6B6B" : "#FFFFFF", fn = dark ? "#464646" : "#ACB0BA", txt = dark ? "#FFFFFF" : "#000000", bg = dark ? "#2B2B2B" : "#D1D3D9";
    const row = (keys, pad = 0) => `<div style="display:flex;gap:6px;padding:0 ${pad}px;margin-top:11px">${keys.map((k) => `<span style="flex:1;height:42px;border-radius:8px;background:${key};color:${txt};display:grid;place-items:center;font:400 22px var(--cc-font);box-shadow:0 1px 0 rgba(0,0,0,.3)">${k}</span>`).join("")}</div>`;
    return `<div aria-hidden="true" style="position:absolute;left:0;right:0;bottom:0;height:291px;background:${bg};padding:0 3px;z-index:25">
      ${row("qwertyuiop".split(""))}${row("asdfghjkl".split(""), 18)}
      <div style="display:flex;gap:6px;margin-top:11px"><span style="width:44px;height:42px;border-radius:8px;background:${fn};color:${txt};display:grid;place-items:center;font:500 17px var(--cc-font)">⇧</span><div style="flex:1;display:flex;gap:6px;padding:0 6px">${"zxcvbnm".split("").map((k) => `<span style="flex:1;height:42px;border-radius:8px;background:${key};color:${txt};display:grid;place-items:center;font:400 22px var(--cc-font)">${k}</span>`).join("")}</div><span style="width:44px;height:42px;border-radius:8px;background:${fn};color:${txt};display:grid;place-items:center;font:500 17px var(--cc-font)">⌫</span></div>
      <div style="display:flex;gap:6px;margin-top:11px"><span style="width:92px;height:42px;border-radius:8px;background:${fn};color:${txt};display:grid;place-items:center;font:400 16px var(--cc-font)">123</span><span style="flex:1;height:42px;border-radius:8px;background:${key};color:${txt};display:grid;place-items:center;font:400 16px var(--cc-font)">space</span><span style="width:92px;height:42px;border-radius:8px;background:${fn};color:${txt};display:grid;place-items:center;font:400 16px var(--cc-font)">return</span></div></div>`;
  };
  const mealChips = (on) => `<div role="radiogroup" aria-label="Meal" style="display:flex;gap:8px;margin-top:12px">${["Breakfast", "Lunch", "Dinner", "Snack"].map((t) => `<a class="chip tap${t === on ? " on" : ""}" role="radio" aria-checked="${t === on}" style="padding:0 14px">${t}</a>`).join("")}</div>`;
  const describeText = "2 scrambled eggs with butter, 1 slice of sourdough toast and a flat white with oat milk";
  const describeSheet = (cls, state) => {
    const typing = state === "typing";
    const box = `<div role="textbox" aria-multiline="true" aria-label="What did you eat?" style="margin-top:14px;min-height:${typing ? 112 : 128}px;border-radius:16px;background:var(--cc-fill-elevated);border:2px solid ${typing ? "var(--cc-accent)" : "transparent"};padding:12px 14px;font:400 17px/1.4 var(--cc-font);color:var(--cc-text)">${describeText}${typing ? `<span aria-hidden="true" style="display:inline-block;width:2px;height:21px;background:var(--cc-accent);vertical-align:-4px;margin-left:1px"></span>` : ""}</div>
      <div style="display:flex;justify-content:space-between;font:400 13px var(--cc-font);color:var(--cc-text-2);margin:6px 4px 0"><span>Amounts help: “1 cup”, “a palm-sized piece”.</span><span class="num">89/500</span></div>`;
    if (typing) return sheetPhone(cls, 786, `${sheetHead("Describe your meal")}${box}
        <div style="display:flex;gap:8px;margin:10px -20px 0;padding:0 20px;overflow:hidden"><a class="chip tap" style="flex:none;padding:0 14px">${ic("plus", "sm")}Amount</a><a class="chip tap" style="flex:none;padding:0 14px">${ic("plus", "sm")}How it was cooked</a><a class="chip tap" style="flex:none;padding:0 14px">${ic("plus", "sm")}Brand</a></div>
        <div style="position:absolute;left:20px;right:20px;bottom:303px;display:flex;gap:10px;align-items:center"><span style="flex:1;font:400 13px/1.35 var(--cc-font);color:var(--cc-text-2)">Breakfast · uses 1 of your 2 free scans left this week</span><a class="btn primary" style="width:auto;padding:0 22px;height:48px;border-radius:24px">Estimate</a></div>`,
      keyboard(isDark(cls)));
    return sheetPhone(cls, 786, `${sheetHead("Describe your meal", "We estimate each item and show how sure we are. You can fix anything before saving.")}${box}
        ${label("Meal")}${mealChips("Breakfast").replace('style="display:flex;gap:8px;margin-top:12px"', 'style="display:flex;gap:8px"')}
        <div role="status" aria-live="polite" style="margin-top:18px;border-radius:16px;background:var(--cc-fill-elevated);padding:14px">
          <div style="display:flex;align-items:center;gap:10px;font:600 16px var(--cc-font)"><span class="spin" aria-hidden="true"></span>Estimating · step 2 of 3</div>
          <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px;font:400 15px var(--cc-font)">
            <div style="display:flex;gap:10px;align-items:center"><span style="color:var(--cc-success-ink)">${ic("check", "md")}</span>Found 3 foods</div>
            <div style="display:flex;gap:10px;align-items:center"><span style="color:var(--cc-accent-ink)">${ic("search", "md")}</span>Finding each food</div>
            <div style="display:flex;gap:10px;align-items:center;color:var(--cc-text-2)"><span>${ic("receipt", "md")}</span>Adding it up</div></div></div>
        ${pin(`<a class="btn primary disabled" aria-disabled="true">Estimating…</a><a class="btn ghost" style="margin-top:4px">Cancel</a>`)}`);
  };

  const fixItems = ["Jasmine rice", "Roast chicken thigh", "Cucumber", "Whole meal"];
  const issues = [["Wrong food", "It isn't jasmine rice"], ["Wrong amount", "More or less than that"], ["Shouldn't be here", "I didn't eat this"], ["Nutrition looks off", "The numbers seem wrong"], ["Something else", ""]];
  const fixSheet = (cls, state) => {
    if (state === "sent") return sheetPhone(cls, 520, `${sheetHead("")}
        <div style="width:64px;height:64px;border-radius:20px;background:var(--cc-success-tint);color:var(--cc-success-ink);display:grid;place-items:center;margin-top:4px">${ic("check", "lg")}</div>
        <div style="font:700 26px/1.2 var(--cc-font);margin-top:16px">Thanks, report sent</div>
        <div style="font:400 17px/1.45 var(--cc-font);color:var(--cc-text-2);margin-top:8px">We read every report to make estimates better. Your review hasn't changed: to fix this meal now, edit the item.</div>
        ${pin(`<a class="btn primary">Back to review</a><a class="btn secondary" style="margin-top:10px">${ic("pencil", "md")}Rename Jasmine rice</a>`)}`);
    return sheetPhone(cls, 786, `${sheetHead("Report a problem")}
      ${label("Which item?", 12)}
      <div role="radiogroup" aria-label="Item" style="display:flex;gap:8px;overflow:hidden;margin:0 -20px;padding:0 20px">${fixItems.map((t, i) => `<a class="chip tap${i === 0 ? " on" : ""}" role="radio" aria-checked="${i === 0}" style="flex:none;padding:0 14px">${t}</a>`).join("")}</div>
      ${label("What's wrong?", 14)}
      <div class="group" role="radiogroup" aria-label="Problem">${issues.map(([n, s], i) => `<div class="cell noicon" role="radio" aria-checked="${i === 0}" style="min-height:48px;padding:6px 14px"><span class="lbl" style="font-weight:${i === 0 ? 600 : 400}">${n}${s ? `<small>${s}</small>` : ""}</span>${i === 0 ? `<span style="color:var(--cc-accent-ink)">${ic("check")}</span>` : ""}</div>`).join("")}</div>
      <a class="btn ghost" style="width:auto;justify-content:flex-start;padding:0 4px;font-size:15px;margin-top:2px">${ic("pencil", "sm")}Fix it now: rename the item</a>
      <div role="textbox" aria-label="Add a note, optional" style="margin-top:4px;min-height:64px;border-radius:14px;background:var(--cc-fill-elevated);padding:10px 14px;font:400 17px/1.4 var(--cc-font)">It's brown rice, not jasmine</div>
      <div style="display:flex;gap:12px;align-items:center;margin-top:12px"><div style="flex:1;font:500 15px/1.35 var(--cc-font)">Include the photo<div style="font:400 13px var(--cc-font);color:var(--cc-text-2);margin-top:2px">Off by default. Only used to check this report.</div></div><span class="toggle" role="switch" aria-checked="false" aria-label="Include the photo"></span></div>
      ${pin(`<a class="btn primary">Send report</a>`)}`);
  };
  put("scanSheetsRow", [
    fig("s-describe-light", "Describe a meal: typing (light)", "Opens from the Scan accessory (“Describe”) and from search (“Can't find it? Describe it”). Large detent with the keyboard up; the field is focused on open. Hint chips insert a prompt at the caret. Estimate rides above the keyboard with the meal (defaults to time of day) and the quota line; the count comes from the server and the line is hidden on Plus.", describeSheet("", "typing"), ["kind: text", "quota shown before spending"]),
    fig("s-describe-dark", "Describe a meal: typing (dark)", "iOS dark keyboard; field on ccFillElevated with the accent focus ring.", describeSheet("dark", "typing")),
    fig("s-describe-estimating", "Describe a meal: estimating (light)", "After Estimate the keyboard drops and the text stays visible. The steps are the same three the Live Activity shows (find foods, match each food, add it up), announced politely. Success pushes the normal Review screen with the confidence badge; a typed 422 shows the Review error state. Cancel stops the request and refunds nothing because the credit is only claimed server-side.", describeSheet("", "estimating"), ["same steps as Live Activity"]),
    fig("s-fix-light", "Report a problem (light)", "Replaces the old “Fix Issue”. Entry points: the per-item ⋯ menu (item preselected) and “Something wrong? Report it” under Save (preselects Whole meal). Five reasons, one optional note, and the photo is off by default. Where a direct fix exists, it is offered first (“Fix it now”), so a report is never the only way to correct a number.", fixSheet("", "form"), ["honest label", "photo opt-in", "fix first"]),
    fig("s-fix-dark", "Report a problem (dark)", "Item chips and the reason group sit on ccFillElevated; the selected chip is accent with a black label.", fixSheet("dark", "form")),
    fig("s-fix-sent", "Report sent (light)", "Confirms in plain words and says the review is unchanged, then offers the matching direct fix. Network failure keeps the form and queues the report (it is sent with the next sync).", fixSheet("", "sent")),
  ].join(""));

  /* ======================= 15 · PAYWALL WITHOUT PRICES ======================= */
  const sk = (w, h = 14) => `<span aria-hidden="true" style="display:inline-block;width:${w}px;height:${h}px;border-radius:6px;background:var(--cc-fill);vertical-align:middle"></span>`;
  const check = (t, muted) => `<div style="display:flex;gap:10px${muted ? ";color:var(--cc-text-2)" : ""}"><span style="color:${muted ? "var(--cc-text-2)" : "var(--cc-accent-ink)"}">${ic(muted ? "info" : "check")}</span>${t}</div>`;
  const paywallState = (cls, state) => {
    const loading = state === "loading";
    const priceLine = (lbl) => (loading ? sk(lbl === "y" ? 150 : 120) : `<span style="color:var(--cc-text-2)">Price unavailable</span>`);
    const alertCard = loading ? "" : `<div class="card" role="alert" style="margin-top:14px;background:var(--cc-caution-tint);border:0;padding:14px">
        <div style="display:flex;gap:12px;align-items:flex-start"><span style="color:var(--cc-caution-ink);flex:none">${ic("info")}</span>
          <div style="font:400 15px/1.45 var(--cc-font)"><b style="font-weight:600">Prices didn't load.</b> Check your connection and try again. You'll always see the price before you pay.</div></div>
        <a class="btn secondary" style="height:44px;margin-top:12px;font-size:15px;background:var(--cc-bg)">Try again</a></div>`;
    return `<div class="phone plain ${cls}" data-sb><div class="scroll" style="padding-bottom:200px">
        <div class="navbar"><a class="btn ghost" style="width:auto;padding:0 4px;font-size:15px">Restore</a><span></span><a class="glassbtn" aria-label="Close">${ic("x")}</a></div>
        <div class="ember" style="margin-top:4px;padding:22px${isDark(cls) ? ";border:1px solid var(--cc-border)" : ""}">
          <div style="font:600 13px var(--cc-font);color:var(--cc-ember-accent);letter-spacing:.04em">COACHCAL PLUS</div>
          <div style="font:700 26px/1.2 var(--cc-font);color:var(--cc-ember-text);margin-top:8px">Unlimited scans and a coach who shows the maths.</div></div>
        ${loading ? `<div style="display:flex;flex-direction:column;gap:12px;margin:18px 4px;font:500 16px/1.35 var(--cc-font)">${check("Unlimited photo, barcode and label scans")}${check("Weekly coach review and insights")}${check("CSV export and Apple Health sync")}${check("Manual logging is free on every plan", true)}</div>` : alertCard}
        <div role="radiogroup" aria-label="Plan" aria-busy="${loading}" style="margin-top:${loading ? 0 : 14}px">
        <a role="radio" aria-checked="true" aria-disabled="true" style="display:flex;align-items:center;gap:12px;border:2px solid ${loading ? "var(--cc-accent)" : "var(--cc-separator)"};border-radius:18px;padding:14px 16px;${loading ? "background:var(--cc-accent-tint)" : ""}">
          <span style="width:24px;height:24px;border-radius:50%;${loading ? "background:var(--cc-accent);color:var(--cc-on-accent);display:grid;place-items:center" : "border:2px solid var(--cc-text-3)"}">${loading ? ic("check", "sm") : ""}</span>
          <div style="flex:1"><b style="font:700 17px var(--cc-font)">Yearly</b><div style="font:400 13px/1.6 var(--cc-font)">${priceLine("y")}</div></div>
          ${loading ? sk(56, 18) : ""}</a>
        <a role="radio" aria-checked="false" aria-disabled="true" style="display:flex;align-items:center;gap:12px;border:1.5px solid var(--cc-separator);border-radius:18px;padding:14px 16px;margin-top:8px">
          <span style="width:24px;height:24px;border-radius:50%;border:2px solid var(--cc-text-3)"></span>
          <div style="flex:1"><b style="font:700 17px var(--cc-font)">Monthly</b><div style="font:400 13px/1.6 var(--cc-font)">${priceLine("m")}</div></div>
          ${loading ? sk(56, 18) : ""}</a></div>
      </div>
      <div class="dock"><a class="btn primary disabled" aria-disabled="true">${loading ? `<span class="spin" aria-hidden="true"></span>Loading prices…` : "Prices unavailable"}</a>
        <div class="note">${loading ? "Prices come from the App Store in your currency." : "Already subscribed? Restore works without prices."}<br><a style="color:var(--cc-text-2);text-decoration:underline">Terms</a> · <a style="color:var(--cc-text-2);text-decoration:underline">Privacy</a></div></div></div>`;
  };
  put("paywallStateRow", [
    fig("b-paywall-loading", "Paywall: loading prices (light)", "Shown until StoreKit returns the products (normally under a second; show the skeleton only after 300 ms to avoid a flash). Plan names are real, prices are skeletons, the button is disabled and says why. Restore and Close always work. Reduce Motion: no shimmer, static skeleton.", paywallState("", "loading"), ["no fake price"]),
    fig("b-paywall-failed", "Paywall: prices failed (light)", "After a timeout (8 s) or a StoreKit error. A caution card (not red: nothing the person did) with Try again; the plans stay visible but unselectable and show “Price unavailable”. We never show a buy button without a price next to it (3.1.2(c)).", paywallState("", "failed"), ["3.1.2(c)", "retry"]),
    fig("b-paywall-failed-dark", "Paywall: prices failed (dark)", "Caution ink #FFD43B on #3A3214 is 9.9:1.", paywallState("dark", "failed")),
  ].join(""));

  /* ======================= 16 · WIDGET ED-SAFE + LIVE ACTIVITY STEPS ======================= */
  const ring = (size, pct, stroke, track = "#3A342F", color = "#FF6A00") => { const c = 2 * Math.PI * 40;
    return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" style="transform:rotate(-90deg)" aria-hidden="true"><circle cx="50" cy="50" r="40" fill="none" stroke="${track}" stroke-width="${stroke}"/><circle cx="50" cy="50" r="40" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${(c * pct).toFixed(1)} ${c.toFixed(1)}"/></svg>`; };
  const glow = `<div style="position:absolute;right:-60px;top:-70px;width:180px;height:180px;background:radial-gradient(closest-side,rgba(255,106,0,.35),transparent)"></div>`;
  const W = (w, h, body) => `<div style="width:${w}px;height:${h}px;border-radius:22px;background:#141210;color:#F7F5F2;position:relative;overflow:hidden;padding:14px;box-shadow:0 10px 30px rgba(0,0,0,.18)">${body}</div>`;
  const mealLine = (name, food, done) => `<div style="display:flex;gap:8px;align-items:center;font:500 13px/1.2 var(--cc-font)"><span style="width:18px;height:18px;border-radius:50%;flex:none;display:grid;place-items:center;${done ? "background:#FF6A00;color:#0B0A09" : "border:1.5px solid #ABA6A0"}">${done ? `<svg class="i" aria-hidden="true" style="width:12px;height:12px;stroke-width:3"><use href="#i-check"/></svg>` : ""}</span><span style="color:${done ? "#F7F5F2" : "#ABA6A0"}">${name}</span><span style="color:#ABA6A0;margin-left:auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:110px">${food}</span></div>`;
  const mediumEd = W(364, 170, `${glow}<div style="position:relative;display:flex;gap:16px;align-items:center;height:100%">
      <div style="position:relative;width:120px;height:120px;flex:none">${ring(120, .66, 11)}<div style="position:absolute;inset:0;display:grid;place-items:center;text-align:center"><div><div style="font:700 17px/1.1 var(--cc-font)">On track</div><div style="font:500 11px var(--cc-font);color:#ABA6A0;margin-top:2px">2 of 3 meals</div></div></div></div>
      <div style="flex:1;display:flex;flex-direction:column;gap:9px;min-width:0">${mealLine("Breakfast", "Overnight oats", true)}${mealLine("Lunch", "Chicken rice bowl", true)}${mealLine("Dinner", "Next", false)}
        <a style="margin-top:2px;height:32px;border-radius:16px;background:#FF6A00;color:#0B0A09;display:flex;align-items:center;justify-content:center;gap:6px;font:600 13px var(--cc-font)">${ic("camera", "sm")}Scan a meal</a></div></div>`);
  const STEPS = ["Spotting the foods", "Finding each food", "Adding it up"];
  const laCard = (step) => `<div style="width:370px;border-radius:26px;background:rgba(20,18,16,.92);color:#F7F5F2;padding:16px 18px;box-shadow:0 10px 30px rgba(0,0,0,.25)">
      <div style="display:flex;align-items:center;gap:10px"><span style="width:28px;height:28px;border-radius:8px;background:#FF6A00;color:#0B0A09;display:grid;place-items:center">${ic("scan", "sm")}</span><b style="font:600 15px var(--cc-font);flex:1">Reading your plate</b><span style="font:500 13px var(--cc-font);color:#ABA6A0">step ${step} of 3</span></div>
      <div style="display:flex;gap:12px;align-items:center;margin-top:12px"><div class="ph-bowl" style="width:56px;height:56px;border-radius:14px;flex:none"></div>
        <div style="flex:1"><div style="font:600 17px var(--cc-font)">${STEPS[step - 1]}</div>
          <div style="display:flex;gap:4px;margin-top:10px" aria-hidden="true">${[1, 2, 3].map((i) => `<i style="flex:1;height:6px;border-radius:3px;background:${i < step ? "#FF6A00" : i === step ? "linear-gradient(90deg,#FF6A00 55%,#3A342F 55%)" : "#3A342F"}"></i>`).join("")}</div></div></div></div>`;
  const laFailed = `<div style="width:370px;border-radius:26px;background:rgba(20,18,16,.92);color:#F7F5F2;padding:16px 18px;box-shadow:0 10px 30px rgba(0,0,0,.25)">
      <div style="display:flex;align-items:center;gap:12px"><div class="ph-bowl" style="width:56px;height:56px;border-radius:14px;flex:none;filter:brightness(.45)"></div>
        <div style="flex:1"><div style="font:600 17px var(--cc-font)">Couldn't read this photo</div><div style="font:500 13px/1.35 var(--cc-font);color:#ABA6A0;margin-top:2px">Too dark to see the food. Retake it or describe it.</div></div>
        <a style="height:44px;padding:0 16px;border-radius:22px;background:#3A342F;color:#F7F5F2;display:grid;place-items:center;font:600 15px var(--cc-font)">Open</a></div></div>`;
  const islandExpanded = `<div style="width:370px;height:150px;border-radius:44px;background:#000;color:#F7F5F2;padding:18px 22px">
      <div style="display:flex;justify-content:space-between;align-items:center"><span style="display:flex;gap:8px;align-items:center;font:600 15px var(--cc-font)"><span style="width:28px;height:28px;border-radius:8px;background:#FF6A00;color:#0B0A09;display:grid;place-items:center">${ic("scan", "sm")}</span>Reading your plate</span><span style="font:500 13px var(--cc-font);color:#ABA6A0">step 2 of 3</span></div>
      <div style="font:600 17px var(--cc-font);margin-top:14px">Finding each food</div>
      <div style="display:flex;gap:4px;margin-top:10px" aria-hidden="true"><i style="flex:1;height:6px;border-radius:3px;background:#FF6A00"></i><i style="flex:1;height:6px;border-radius:3px;background:linear-gradient(90deg,#FF6A00 55%,#3A342F 55%)"></i><i style="flex:1;height:6px;border-radius:3px;background:#3A342F"></i></div></div>`;
  const compactProc = `<div style="width:250px;height:37px;border-radius:19px;background:#000;display:flex;align-items:center;justify-content:space-between;padding:0 10px"><span style="color:#FF6A00">${ic("scan", "sm")}</span><span style="font:600 13px var(--cc-font);color:#F7F5F2">2/3</span></div>`;
  put("glance2Row", [
    `<figure class="frame" id="w-medium-ed" data-frame="w-medium-ed">${mediumEd}<figcaption>Medium widget · ED-Safe<span>Same ring and Scan button as the medium widget. Macro grams are replaced by the meals logged today (name only, no numbers) and the next meal. Reads the ED-Safe flag from the app group, like the small widget.</span><i class="fix">ED-Safe widget</i></figcaption></figure>`,
    `<figure class="frame" id="la-steps" data-frame="la-steps" style="display:flex;flex-direction:column;gap:14px">${laCard(1)}${laCard(2)}${laCard(3)}<figcaption>Live Activity · processing (Lock Screen)<span>One step per server stage, in this order: 1 Spotting the foods (vision model), 2 Finding each food (food database lookup), 3 Adding it up (nutrition maths). ContentState carries <code>step</code> (1–3) and the label, so wording can change without an app update. No time estimate: steps are honest, seconds are not. Identical under ED-Safe (no numbers here). Ends as “Ready to review” (section 6).</span><i class="fix">real steps</i></figcaption></figure>`,
    `<figure class="frame" id="la-island-processing" data-frame="la-island-processing" style="display:flex;flex-direction:column;gap:18px;align-items:flex-start">${compactProc}${islandExpanded}<figcaption>Dynamic Island · processing<span>Compact: scan glyph and “2/3”. Expanded: the same title, step label and three-part bar as the Lock Screen. Minimal stays the progress ring from section 6.</span></figcaption></figure>`,
    `<figure class="frame" id="la-failed" data-frame="la-failed" style="display:flex;flex-direction:column;gap:14px">${laFailed}<figcaption>Live Activity · couldn't read<span>For a typed 422 (unreadable photo). The reason comes from the error code (too dark, no food found, blurry). Open goes back to the camera with Describe one tap away. The activity ends after 15 minutes or when the person opens it.</span></figcaption></figure>`,
  ].join(""));

  /* ======================= 17 · DARK: PROFILE, SETTINGS, SEARCH, MANUAL ======================= */
  const darkRow = document.getElementById("darkMoreRow");
  const src = document.querySelectorAll("#profile .row > figure.frame");
  if (darkRow && src.length) {
    const meta = [
      ["p-profile-dark", "Profile (dark)", "Cards on ccCard #1C1A18 over black. The avatar keeps its orange fill with a black initial. System icon tiles keep their colours."],
      ["p-settings-dark", "Settings (dark)", "The subscription card shows the real renewal price from StoreKit (<code>{price}</code>). Cancel uses the destructive tint #3A1219 with #FF7088 text (6.19:1)."],
      ["p-search-dark", "Food search (dark, ED-Safe)", "Search field and segment on ccFill. Add buttons use accent-tint #3A2312 with accent-ink #FF7A1F (5.64:1)."],
      ["p-manual-dark", "Manual log (dark, ED-Safe)", "Same rule as light: no kcal field under ED-Safe. The note card uses accent-tint."],
    ];
    darkRow.innerHTML = [...src].slice(0, 4).map((f, i) => {
      const c = f.cloneNode(true);
      c.id = meta[i][0]; c.dataset.frame = meta[i][0];
      c.querySelector(".phone").classList.add("dark");
      const cap = c.querySelector("figcaption");
      cap.innerHTML = `${meta[i][1]}<span>${meta[i][2]}</span>`;
      return c.outerHTML;
    }).join("");
  }
})();
