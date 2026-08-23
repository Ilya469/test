import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const file = path.resolve(import.meta.dirname, '../../../deliverables/吴凯明_产品作品集_单文件离线版_v2.0.html');
const url = pathToFileURL(file).href;
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-single-file-cdp-'));
const chrome = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--allow-file-access-from-files',
  '--no-first-run',
  '--no-default-browser-check',
  '--remote-debugging-port=0',
  `--user-data-dir=${profile}`,
  'about:blank',
], { stdio: 'ignore' });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readDebugPort() {
  const portFile = path.join(profile, 'DevToolsActivePort');
  for (let index = 0; index < 160; index += 1) {
    if (fs.existsSync(portFile)) return fs.readFileSync(portFile, 'utf8').trim().split('\n')[0];
    await wait(50);
  }
  throw new Error('Chrome DevToolsActivePort 未生成');
}

async function main() {
  const port = await readDebugPort();
  const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
  const target = pages.find((page) => page.type === 'page' && !page.url.startsWith('chrome-extension://'));
  assert.ok(target, '未找到 Chrome 页面目标');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  let requestId = 0;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const operation = pending.get(message.id);
    pending.delete(message.id);
    message.error ? operation.reject(new Error(message.error.message)) : operation.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    requestId += 1;
    pending.set(requestId, { resolve, reject });
    ws.send(JSON.stringify({ id: requestId, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = async (expression, timeout = 90000) => {
    const started = Date.now();
    let lastReport = 0;
    while (Date.now() - started < timeout) {
      if (await evaluate(expression)) return;
      if (Date.now() - lastReport > 10000) {
        lastReport = Date.now();
        const state = await evaluate(`(() => { const frame=document.getElementById('single-file-project-frame'),doc=frame?.contentDocument; return {href:location.href,title:document.title,ready:document.readyState,body:document.body?.innerText.slice(0,80),cards:document.querySelectorAll?.('[data-single-file-project]').length,frameSrc:frame?.src,frameReady:doc?.readyState,frameTitle:doc?.title,frameText:doc?.body?.innerText.slice(0,100),frameReturn:!!doc?.querySelector('#portfolio-home-return,[data-portfolio-home-return]')}; })()`);
        console.error('WAIT_STATE', state);
      }
      await wait(300);
    }
    throw new Error(`等待超时：${expression}`);
  };

  await send('Page.enable');
  await send('Runtime.enable');
  const navigation = await send('Page.navigate', { url });
  console.error('NAVIGATION', navigation);
  await waitFor(`document.readyState === 'complete' && document.querySelectorAll('[data-single-file-project]').length === 7 && document.querySelectorAll('script[id^="single-file-project-"]').length === 7`);

  const home = await evaluate(`({
    title: document.title,
    cards: document.querySelectorAll('[data-single-file-project]').length,
    payloads: document.querySelectorAll('script[id^="single-file-project-"]').length,
    images: [...document.images].map(image => ({complete:image.complete,width:image.naturalWidth}))
  })`);
  assert.equal(home.title, '吴凯明 · 产品作品集');
  assert.equal(home.cards, 7);
  assert.equal(home.payloads, 7);
  assert.equal(home.images.every((image) => image.complete && image.width > 0), true, '首页存在未加载图片');

  await evaluate(`document.getElementById('aboutResumeBtn').click()`);
  await waitFor(`(() => { const modal=document.getElementById('resumeModal'),doc=document.getElementById('resumeFrame')?.contentDocument; return modal?.classList.contains('is-open') && doc?.querySelector('.portrait')?.naturalWidth>0 && doc.body.innerText.includes('GrowthBud新加坡家庭成长与 AI 分析平台｜ 产品助理'); })()`);
  const resume = await evaluate(`(() => { const doc=document.getElementById('resumeFrame').contentDocument; return {title:doc.title,photoWidth:doc.querySelector('.portrait')?.naturalWidth||0,text:doc.body.innerText.slice(0,120)}; })()`);
  assert.ok(resume.photoWidth > 0, '简历证件照未加载');
  await evaluate(`document.getElementById('resumeCloseBtn').click()`);

  const ids = process.env.PROJECT_ID ? [process.env.PROJECT_ID] : ['medical', 'mall', 'sports', 'quote', 'hotel-supply', 'school', 'marathon'];
  const results = [];
  for (const id of ids) {
    await evaluate(`document.querySelector('[data-single-file-project="${id}"]').click()`);
    await waitFor(`(() => {
      const shell=document.getElementById('single-file-project-shell');
      const frame=document.getElementById('single-file-project-frame');
      const doc=frame.contentDocument;
      return shell?.dataset.open==='true' && doc?.body?.innerText.trim().length>20 && doc.querySelector('#portfolio-home-return,[data-portfolio-home-return]');
    })()`);
    const opened = await evaluate(`(() => {
      const frame=document.getElementById('single-file-project-frame');
      const doc=frame.contentDocument;
      return {id:${JSON.stringify(id)},title:doc.title,text:doc.body.innerText.slice(0,120),returnButton:!!doc.querySelector('#portfolio-home-return,[data-portfolio-home-return]')};
    })()`);
    assert.equal(opened.returnButton, true, `${id} 缺少返回作品集按钮`);
    assert.ok(opened.title, `${id} 项目标题为空`);
    results.push(opened);
    await evaluate(`document.getElementById('single-file-project-frame').contentDocument.querySelector('#portfolio-home-return,[data-portfolio-home-return]').click()`);
    await waitFor(`document.getElementById('single-file-project-shell').dataset.open === 'false'`);
  }

  console.log(JSON.stringify({ status: 'PASS', file, bytes: fs.statSync(file).size, home, resume, projects: results }, null, 2));
  ws.close();
}

try {
  await main();
} finally {
  chrome.kill('SIGTERM');
  await Promise.race([new Promise((resolve) => chrome.once('exit', resolve)), wait(1200)]);
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
