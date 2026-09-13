#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const environment = process['env'];
const supabaseURL = (environment.SUPABASE_URL ?? 'http://127.0.0.1:54321').replace(/\/$/, '');
const anonKey = environment.SUPABASE_ANON_KEY ?? requireEnv('ANON_KEY');
const email = requireEnv('TEST_EMAIL');
const password = requireEnv('TEST_PASSWORD');
const outputDirectory = environment.FIXTURE_OUTPUT_DIR
  ?? 'native/Modules/CoachCalNetworking/Tests/CoachCalNetworkingTests/Fixtures';

await capture();

function requireEnv(name) {
  const value = environment[name];
  if (!value) throw new Error(`${name} must be set`);
  return value;
}

async function capture() {
  const signIn = await request('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const accessToken = signIn.access_token;
  if (!accessToken) throw new Error('Sign-in response did not contain an access token');

  const operationID = randomUUID();
  const pushedAt = new Date().toISOString();
  const operations = [{
    opId: operationID,
    table: 'diary_entries',
    recordId: operationID,
    kind: 'upsert',
    snapshot: {
      id: operationID,
      displayText: 'Golden fixture',
      deletedAt: null,
      serverVersion: 0,
      acceptedOpId: null,
    },
    clientTimestamp: pushedAt,
  }];

  const push = await request('/rest/v1/rpc/sync_push', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ p_ops: operations }),
  });
  const pull = await request('/rest/v1/rpc/sync_pull', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ p_cursor: 0 }),
  });

  if (!Array.isArray(push.accepted) || push.accepted.length !== operations.length) {
    throw new Error('Unexpected sync_push response shape');
  }
  if (!Array.isArray(pull.rows) || typeof pull.cursor !== 'number') {
    throw new Error('Unexpected sync_pull response shape');
  }

  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFixture('sync_push_request', { operations }),
    writeFixture('sync_push_response', push),
    writeFixture('sync_pull_response', pull),
  ]);
}

async function request(pathname, init) {
  const response = await fetch(new URL(pathname, supabaseURL), {
    ...init,
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...init?.headers,
    },
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`${pathname} failed with HTTP ${response.status}: ${body.message ?? 'unknown error'}`);
  }
  return body;
}

async function writeFixture(name, value) {
  const destination = path.join(outputDirectory, `${name}.golden.json`);
  await writeFile(destination, `${JSON.stringify(value, null, 2)}\n`);
}
