import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const svg = readFileSync(process.argv[2], 'utf8');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
await p.setContent(`<body style="margin:0">${svg}</body>`);
await p.locator('svg').screenshot({ path: process.argv[3], omitBackground: false });
await b.close();
console.log('rendered', process.argv[3]);
