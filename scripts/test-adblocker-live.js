import { CDPClient } from './cdp-client.js';
import http from 'node:http';
import fs from 'node:fs';

const PORT = 9333;

function getTargets() {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${PORT}/json/list`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

function createTab(url) {
  return new Promise((resolve, reject) => {
    const req = http.request(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('--- Testing Live Ad Blocking ---');
  const testUrl = 'https://adblock-tester.com/';
  console.log('Navigating to:', testUrl);

  const tab = await createTab(testUrl);
  console.log('Tab created:', tab.id);

  const client = new CDPClient(tab.webSocketDebuggerUrl);
  await client.connect();

  const networkRequests = [];
  const blockedRequests = [];

  await client.send('Page.enable');
  await client.send('DOM.enable');
  await client.send('Runtime.enable');
  await client.send('Network.enable');

  client.on('Network.requestWillBeSent', (params) => {
    networkRequests.push({
      url: params.request.url,
      type: params.type
    });
  });

  client.on('Network.loadingFailed', (params) => {
    if (params.blockedReason || params.errorText.includes('BLOCKED_BY_CLIENT')) {
      blockedRequests.push({
        requestId: params.requestId,
        reason: params.blockedReason || params.errorText
      });
      console.log(`[DNR BLOCKED] ${params.blockedReason || params.errorText}`);
    }
  });

  console.log('Waiting 10s for page to load tests and run analytics/ad scripts...');
  await new Promise(r => setTimeout(r, 10000));

  // Capture screenshot
  const screenshot = await client.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('/tmp/adblock-test-result.png', Buffer.from(screenshot.data, 'base64'));
  console.log('Saved screenshot to /tmp/adblock-test-result.png');

  // Check the score on adblock-tester.com
  const scoreRes = await client.send('Runtime.evaluate', {
    expression: `
      (() => {
        const scoreEl = document.querySelector('.score') || document.querySelector('[class*="score"]');
        const testItems = Array.from(document.querySelectorAll('.test-item, .item, tr, .test_item')).map(el => el.innerText.trim());
        return {
          score: scoreEl ? scoreEl.innerText : 'Unknown',
          textSample: document.body.innerText.slice(0, 800)
        };
      })()
    `,
    returnByValue: true
  });

  console.log('AdBlock Tester Results:');
  console.log(scoreRes.result.value);

  console.log(`Total network requests: ${networkRequests.length}`);
  console.log(`Blocked by client: ${blockedRequests.length}`);

  client.close();
}

run().catch(console.error);
