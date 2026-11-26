import { createApp } from './app';

describe('GET /health', () => {
  it('answers with ok', async () => {
    const res = await createApp().request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, service: 'coachcal-rn-spike-api' });
  });
});
