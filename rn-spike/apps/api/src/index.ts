import { serve } from '@hono/node-server';
import { createApp } from './app';

const port = Number(process.env.PORT ?? 8787);

serve({ fetch: createApp().fetch, port, hostname: '127.0.0.1' }, (info) => {
  console.log(`[api] coachcal spike sync API listening on http://127.0.0.1:${info.port}`);
});
