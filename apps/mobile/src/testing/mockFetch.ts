/**
 * A recording `fetch` double for the client tests. It has no dependency on Jest: the tests wrap it
 * where they need call assertions. Replies are consumed in order (the last one repeats), or a
 * function decides per request. The reply object implements only what `apiRequest` reads
 * (`status`, `ok`, `text()`).
 */
export type MockReply = {
  status?: number;
  json?: unknown;
  text?: string;
  /** The request fails before any response, like a dropped connection. */
  networkError?: string;
};

export type RecordedRequest = {
  url: string;
  path: string;
  method: string;
  /** Header names are lower-cased. */
  headers: Record<string, string>;
  body: unknown;
};

export type MockFetch = typeof fetch & { calls: RecordedRequest[] };

export function createMockFetch(replies: MockReply | MockReply[] | ((request: RecordedRequest) => MockReply)): MockFetch {
  const calls: RecordedRequest[] = [];
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    const headers: Record<string, string> = {};
    for (const [name, value] of Object.entries((init?.headers ?? {}) as Record<string, string>)) {
      headers[name.toLowerCase()] = value;
    }
    const rawBody = typeof init?.body === 'string' ? init.body : undefined;
    const request: RecordedRequest = {
      url,
      path: url.replace(/^https?:\/\/[^/]+/, ''),
      method: init?.method ?? 'GET',
      headers,
      body: rawBody === undefined ? undefined : JSON.parse(rawBody),
    };
    calls.push(request);

    const reply =
      typeof replies === 'function'
        ? replies(request)
        : Array.isArray(replies)
          ? (replies[Math.min(calls.length - 1, replies.length - 1)] as MockReply)
          : replies;
    if (reply.networkError !== undefined) throw new TypeError(reply.networkError);

    const status = reply.status ?? 200;
    const text = reply.text ?? (reply.json === undefined ? '' : JSON.stringify(reply.json));
    return { status, ok: status >= 200 && status < 300, text: async () => text } as Response;
  };
  return Object.assign(fetchImpl, { calls }) as MockFetch;
}
