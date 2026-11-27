#!/usr/bin/env node
// Release-surface check for a built CoachCal.app (the RN replacement of native/scripts/check-artifact-compliance.sh).
//
//   node scripts/rn/check-artifact-compliance.mjs <path to CoachCal.app>
//
// Needs macOS (`plutil`, `codesign`). Exit 0 and "COMPLIANCE-OK" when every check passes, exit 1 and the
// list of failed checks otherwise. Prints one line per check so the output is the evidence.
//
// What it asserts (all taken from what the SwiftUI app shipped with):
//   entitlements  HealthKit, HealthKit background delivery, Sign in with Apple, App Group
//   Info.plist    bundle id, camera string, the two Health strings, URL scheme `coachcal`, Live Activities flag
//   privacy       PrivacyInfo.xcprivacy: tracking false, the 3 collected data types
//   secrets       no .p8 .p12 .pem .jks .mobileprovision .env inside the bundle
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BUNDLE_ID = 'com.nextlabs.coachcal';
const APP_GROUP = 'group.com.nextlabs.coachcal';
const URL_SCHEME = 'coachcal';
const COLLECTED_TYPES = [
  'NSPrivacyCollectedDataTypeEmailAddress',
  'NSPrivacyCollectedDataTypeHealth',
  'NSPrivacyCollectedDataTypePhotosorVideos',
];
const FORBIDDEN_FILES = /\.(p8|p12|pem|jks|mobileprovision)$|^\.env(\.|$)/;

const app = process.argv[2];
if (!app || !app.endsWith('.app') || !existsSync(app)) {
  console.error('usage: node scripts/rn/check-artifact-compliance.mjs <path to CoachCal.app>');
  process.exit(2);
}

/** @type {string[]} */
const failures = [];
/** @param {boolean} ok @param {string} label @param {string} [detail] */
function check(ok, label, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures.push(label);
}

/** plist file -> JSON object, through plutil (reads binary and XML plists alike). */
function readPlist(path) {
  try {
    return JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', path], { encoding: 'utf8' }));
  } catch {
    return null;
  }
}

/** Entitlements embedded in the signature, as an object. A simulator build is ad-hoc signed and carries them. */
function readEntitlements(appPath) {
  try {
    const xml = execFileSync('codesign', ['-d', '--entitlements', ':-', appPath], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    if (!xml.trim()) return null;
    return JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', '-'], { encoding: 'utf8', input: xml }));
  } catch {
    return null;
  }
}

function walk(dir, found = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, found);
    else found.push(path);
  }
  return found;
}

console.log(`checking ${app}`);

// ---- Info.plist
const info = readPlist(join(app, 'Info.plist'));
check(info !== null, 'Info.plist is readable');
if (info) {
  check(info.CFBundleIdentifier === BUNDLE_ID, `bundle id is ${BUNDLE_ID}`, String(info.CFBundleIdentifier));
  check(
    typeof info.NSCameraUsageDescription === 'string' && info.NSCameraUsageDescription.length > 0,
    'NSCameraUsageDescription is set',
  );
  check(
    typeof info.NSHealthShareUsageDescription === 'string' && info.NSHealthShareUsageDescription.length > 0,
    'NSHealthShareUsageDescription is set',
  );
  check(
    typeof info.NSHealthUpdateUsageDescription === 'string' && info.NSHealthUpdateUsageDescription.length > 0,
    'NSHealthUpdateUsageDescription is set',
  );
  const schemes = (info.CFBundleURLTypes ?? []).flatMap((t) => t.CFBundleURLSchemes ?? []);
  check(schemes.includes(URL_SCHEME), `CFBundleURLSchemes contains ${URL_SCHEME}`, schemes.join(', '));
  check(info.NSSupportsLiveActivities === true, 'NSSupportsLiveActivities is true');
  check(info.ITSAppUsesNonExemptEncryption === false, 'ITSAppUsesNonExemptEncryption is false');
}

// ---- Entitlements
const ent = readEntitlements(app);
check(ent !== null, 'entitlements are embedded in the signature');
if (ent) {
  check(ent['com.apple.developer.healthkit'] === true, 'entitlement com.apple.developer.healthkit');
  check(
    ent['com.apple.developer.healthkit.background-delivery'] === true,
    'entitlement com.apple.developer.healthkit.background-delivery',
  );
  check(Array.isArray(ent['com.apple.developer.applesignin']), 'entitlement com.apple.developer.applesignin');
  const groups = ent['com.apple.security.application-groups'] ?? [];
  check(groups.includes(APP_GROUP), `App Group ${APP_GROUP}`, groups.join(', '));
}

// ---- Privacy manifest
const privacy = readPlist(join(app, 'PrivacyInfo.xcprivacy'));
check(privacy !== null, 'PrivacyInfo.xcprivacy exists and is a valid plist');
if (privacy) {
  check(privacy.NSPrivacyTracking === false, 'NSPrivacyTracking is false');
  const types = (privacy.NSPrivacyCollectedDataTypes ?? []).map((t) => t.NSPrivacyCollectedDataType);
  check(
    COLLECTED_TYPES.every((t) => types.includes(t)) && types.length === COLLECTED_TYPES.length,
    `NSPrivacyCollectedDataTypes are exactly ${COLLECTED_TYPES.length} (email, health, photos)`,
    types.map((t) => t.replace('NSPrivacyCollectedDataType', '')).join(', '),
  );
}

// ---- No secrets in the bundle
const leaked = walk(app).filter((p) => FORBIDDEN_FILES.test(p.split('/').pop() ?? ''));
check(leaked.length === 0, 'no .p8 .p12 .pem .jks .mobileprovision .env file in the bundle', leaked.join(', '));

if (failures.length > 0) {
  console.log(`COMPLIANCE-FAILED: ${failures.length} check(s)`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`COMPLIANCE-OK: ${info?.CFBundleIdentifier} ${info?.CFBundleShortVersionString}(${info?.CFBundleVersion})`);
