import { createServer } from 'node:http';
import { appFor } from './app.mjs';

const port = Number(process.env.PORT ?? 4731);
const info = { env: process.env.APP_ENV, sha: process.env.APP_SHA, apiUrl: process.env.API_URL };
createServer(appFor(info)).listen(port, '127.0.0.1', () => console.log(`storefront on http://127.0.0.1:${port} (${info.env ?? 'dev'} ${info.sha?.slice(0, 7) ?? ''}) -> ${info.apiUrl ?? 'http://127.0.0.1:4721'}`));
