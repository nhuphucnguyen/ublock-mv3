import { getTargets, CDPClient } from './cdp-client.js';

async function main() {
  const targets = await getTargets();
  console.log('Open Targets:');
  for (const t of targets) {
    console.log(`- [${t.type}] ${t.title || 'untitled'} (${t.url})`);
  }

  // Find the chrome://extensions page
  const extPage = targets.find(t => t.url && t.url.includes('extensions'));
  if (extPage) {
    const client = new CDPClient(extPage.webSocketDebuggerUrl);
    await client.connect();
    await client.send('Runtime.enable');
    const res = await client.send('Runtime.evaluate', {
      expression: `
        Array.from(document.querySelectorAll('extensions-item, extensions-manager'))
          .map(el => el.innerText || el.textContent)
          .join('\\n');
      `
    });
    console.log('Extensions page evaluation:');
    console.log(res);
    client.close();
  }
}

main().catch(console.error);
