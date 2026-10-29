const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.goto('file://' + process.cwd() + '/card.html'); await p.waitForTimeout(800); await p.screenshot({ path: 'previa.png' }); await b.close(); })();
