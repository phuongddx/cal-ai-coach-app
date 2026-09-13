import { z } from 'npm:zod';
import type { ErrorCode } from './contracts/errors.ts';

/**
 * HTTP envelope — the ONLY way an edge function builds a response body.
 * Every success and every typed error crosses the boundary through here so
 * CORS headers and the ErrorEnvelope shape stay uniform.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

export function errorJson(status: number, code: ErrorCode, details?: string[]): Response {
  return json(status, details ? { error: { code, details } } : { error: { code } });
}

/** Maps a ZodError to detail strings: dotted paths, or the message for pathless issues. */
export function zodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => issue.path.join('.') || issue.message);
}

/** Answers a CORS preflight, or returns null for non-preflight requests. */
export function preflight(req: Request): Response | null {
  if (req.method !== 'OPTIONS') return null;
  return new Response('ok', { headers: CORS_HEADERS });
}
