import { spawn } from 'node:child_process';

async function test() {
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9447',
    '--headless=new',
    '--disable-gpu',
    '--window-size=1440,900'
  ]);
  await new Promise(r => setTimeout(r, 1000));
  const ver = await (await fetch('http://127.0.0.1:9447/json/version')).json();
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  let id = 1;
  const send = (m, p={}) => new Promise(res => {
    const cur = id++;
    const handler = (e) => {
      const d = JSON.parse(e.data);
      if (d.id === cur) { ws.removeEventListener('message', handler); res(d); }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: cur, method: m, params: p }));
  });
  const t = await send('Target.createTarget', { url: 'http://localhost:5174/preview/living-portal' });
  const s = await send('Target.attachToTarget', { targetId: t.result.targetId, flatten: true });
  const sId = s.result.sessionId;
  const sendS = (m, p={}) => new Promise(res => {
    const cur = id++;
    const handler = (e) => {
      const d = JSON.parse(e.data);
      if (d.id === cur) { ws.removeEventListener('message', handler); res(d); }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: cur, sessionId: sId, method: m, params: p }));
  });
  await new Promise(r => setTimeout(r, 1500));
  
  // Inject style fix
  await sendS('Runtime.evaluate', {
    expression: `(() => {
      document.documentElement.classList.add('living-portal-active');
      const style = document.createElement('style');
      style.id = 'fix-scroll';
      style.textContent = \`
        html.living-portal-active {
          overflow-y: scroll !important;
          overflow-x: clip !important;
          height: auto !important;
          min-height: 100% !important;
          touch-action: pan-y !important;
          overscroll-behavior-y: auto !important;
        }
        body.living-portal-active {
          overflow: visible !important;
          overflow-x: visible !important;
          overflow-y: visible !important;
          height: auto !important;
          min-height: 100% !important;
          touch-action: pan-y !important;
          overscroll-behavior-y: auto !important;
        }
        .living-portal-root {
          overflow: visible !important;
          touch-action: pan-y !important;
          height: auto !important;
        }
      \`;
      document.head.appendChild(style);
    })()`
  });

  await new Promise(r => setTimeout(r, 400));

  // Test synthesizeScrollGesture after fix
  console.log('Sending synthesizeScrollGesture yDistance: -600 (scroll down)...');
  await sendS('Input.synthesizeScrollGesture', {
    x: 500,
    y: 400,
    xDistance: 0,
    yDistance: -600
  });
  await new Promise(r => setTimeout(r, 800));

  const sY = await sendS('Runtime.evaluate', { expression: 'window.scrollY', returnByValue: true });
  console.log('ScrollY after synthesizeScrollGesture WITH FIX:', sY.result.result.value);

  // Test scroll back up
  console.log('Sending synthesizeScrollGesture yDistance: 400 (scroll back up)...');
  await sendS('Input.synthesizeScrollGesture', {
    x: 500,
    y: 400,
    xDistance: 0,
    yDistance: 400
  });
  await new Promise(r => setTimeout(r, 800));
  const sYUp = await sendS('Runtime.evaluate', { expression: 'window.scrollY', returnByValue: true });
  console.log('ScrollY after scrolling BACK UP:', sYUp.result.result.value);

  ws.close();
  chrome.kill();
}
test();
