import fs from 'node:fs';
import path from 'node:path';

const siteRoot = path.resolve(import.meta.dirname, '..');
const output = path.resolve(siteRoot, '../../deliverables/吴凯明_产品作品集_单文件离线版_v2.0.html');

const projects = [
  ['medical', 'projects/medical/index.html', 'XXX 医疗服务平台'],
  ['mall', 'projects/mall/index.html', 'XXX 商场小程序'],
  ['sports', 'projects/sports/index.html', 'XXX 体育场馆运营平台'],
  ['quote', 'projects/quote/index.html', 'XXX AI 智能报价平台'],
  ['hotel-supply', 'projects/hotel-supply/index.html', 'XXX 酒店供应链采购平台'],
  ['school', 'projects/school/index.html', 'XXX 国际学校招生 H5'],
  ['marathon', 'projects/marathon/index.html', 'XXX 马拉松现场服务平台'],
];

const mimeByExt = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.otf': 'font/otf',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
};

function read(relative) {
  return fs.readFileSync(path.join(siteRoot, relative));
}

function dataUrl(relative) {
  const file = path.join(siteRoot, relative);
  const mime = mimeByExt[path.extname(file).toLowerCase()] || 'application/octet-stream';
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}

function inlineHomepageAssets(html) {
  return html.replace(/(?:src|href)="(assets\/[^"#]+)"/g, (full, relative) => {
    const attr = full.startsWith('src=') ? 'src' : 'href';
    return `${attr}="${dataUrl(relative)}"`;
  });
}

function inlineProjectAssets(html, projectId) {
  const relativeAssets = new Map([
    ['../../assets/redacted/marathon-preview.svg', 'assets/redacted/marathon-preview.svg'],
    ['../../assets/redacted/medical-dashboard-preview.svg', 'assets/redacted/medical-dashboard-preview.svg'],
    ['../../assets/redacted/medical-mobile-preview.svg', 'assets/redacted/medical-mobile-preview.svg'],
    ['../../assets/school/xxx-international-school-logo-v1.png', 'assets/school/xxx-international-school-logo-v1.png'],
    ['../../assets/sports/xxx-sports-venue-cover-v1.png', 'assets/sports/xxx-sports-venue-cover-v1.png'],
  ]);

  for (const [needle, asset] of relativeAssets) {
    if (html.includes(needle)) html = html.split(needle).join(dataUrl(asset));
  }

  if (projectId === 'medical') {
    for (let index = 1; index <= 7; index += 1) {
      const filename = `font-${index}.otf`;
      html = html.split(`url(${filename}) format("opentype")`).join('local("PingFang SC")');
    }
  }

  const bridge = `<script data-single-file-portfolio-bridge>(function(){
    document.addEventListener('click',function(event){
      const link=event.target&&event.target.closest&&event.target.closest('#portfolio-home-return,[data-portfolio-home-return]');
      if(!link)return;
      event.preventDefault();event.stopImmediatePropagation();
      parent.postMessage({type:'portfolio-single-file-home'},'*');
    },true);
    parent.postMessage({type:'portfolio-single-file-ready',project:${JSON.stringify(projectId)},title:document.title},'*');
  })();<\/script>`;
  const closingBody = html.lastIndexOf('</body>');
  return closingBody >= 0
    ? `${html.slice(0, closingBody)}${bridge}${html.slice(closingBody)}`
    : `${html}${bridge}`;
}

let homepage = inlineHomepageAssets(read('index.html').toString('utf8'));
const resumePreview = read('resume-preview.html').toString('utf8');
const resumePayload = Buffer.from(resumePreview, 'utf8').toString('base64');
const resumeBlobExpression = `URL.createObjectURL(new Blob([new TextDecoder().decode(Uint8Array.from(atob(document.getElementById('single-file-resume-payload').textContent.trim()),character=>character.charCodeAt(0)))],{type:'text/html;charset=utf-8'}))`;
homepage = homepage
  .replace('if(!frame.src)frame.src=\'resume-preview.html\';', `if(!frame.src)frame.src=${resumeBlobExpression};`)
  .replace('href="resume-preview.html" target="_blank" rel="noopener"', 'href="#" data-single-file-resume-new-window');
for (const [id, relative] of projects) {
  homepage = homepage.replace(`href="${relative}"`, `href="#project-${id}" data-single-file-project="${id}"`);
}

const shellCss = `<style data-single-file-portfolio-shell>
  body.single-file-project-open{overflow:hidden}
  #single-file-project-shell{position:fixed;z-index:2147483000;inset:0;display:none;background:#f5f5f7}
  #single-file-project-shell[data-open="true"]{display:block}
  #single-file-project-frame{display:block;width:100%;height:100%;border:0;background:#f5f5f7}
  #single-file-project-loading{position:absolute;z-index:2;inset:0;display:grid;place-items:center;background:#f5f5f7;color:#181818;font:650 15px/1.5 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}
  #single-file-project-loading[hidden]{display:none}
  #single-file-shell-home{position:absolute;z-index:5;top:max(18px,env(safe-area-inset-top));right:22px;display:none;align-items:center;justify-content:center;height:42px;padding:0 18px;border:1px solid rgba(255,255,255,.45);border-radius:999px;background:rgba(20,20,22,.9);box-shadow:0 10px 30px rgba(0,0,0,.2);color:#fff;font:650 14px/1 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;cursor:pointer;backdrop-filter:blur(12px)}
  #single-file-project-shell[data-open="true"] #single-file-shell-home{display:flex}
  @media(max-width:680px){#single-file-shell-home{top:max(10px,env(safe-area-inset-top));right:10px;height:38px;padding:0 13px;font-size:12px}}
</style>`;

const payloads = projects.map(([id, relative, title]) => {
  const source = inlineProjectAssets(read(relative).toString('utf8'), id);
  return `<script type="application/octet-stream" id="single-file-project-${id}" data-title="${title}">${Buffer.from(source, 'utf8').toString('base64')}</script>`;
}).join('\n');

const shell = `<div id="single-file-project-shell" aria-hidden="true">
  <div id="single-file-project-loading">正在打开项目原型…</div>
  <button id="single-file-shell-home" type="button" aria-label="返回作品集首页">← 返回作品集</button>
  <iframe id="single-file-project-frame" title="项目原型"></iframe>
</div>
<script type="application/octet-stream" id="single-file-resume-payload">${resumePayload}</script>
${payloads}
<script data-single-file-portfolio-runtime>
(() => {
  const shell = document.getElementById('single-file-project-shell');
  const frame = document.getElementById('single-file-project-frame');
  const loading = document.getElementById('single-file-project-loading');
  const home = document.getElementById('single-file-shell-home');
  let activeUrl = '';

  const decode = (base64) => {
    const binary = atob(base64.trim());
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new TextDecoder().decode(bytes);
  };

  const closeProject = () => {
    frame.removeAttribute('src');
    if (activeUrl) URL.revokeObjectURL(activeUrl);
    activeUrl = '';
    shell.dataset.open = 'false';
    shell.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('single-file-project-open');
    loading.hidden = false;
    history.replaceState(null, '', location.href.split('#')[0] + '#projects');
    document.getElementById('projects')?.scrollIntoView({block:'start'});
  };

  const openProject = (id) => {
    const payload = document.getElementById('single-file-project-' + id);
    if (!payload) return;
    if (activeUrl) URL.revokeObjectURL(activeUrl);
    loading.hidden = false;
    shell.dataset.open = 'true';
    shell.setAttribute('aria-hidden', 'false');
    document.body.classList.add('single-file-project-open');
    frame.title = payload.dataset.title || '项目原型';
    activeUrl = URL.createObjectURL(new Blob([decode(payload.textContent)], {type:'text/html;charset=utf-8'}));
    frame.src = activeUrl + '#/';
    history.replaceState(null, '', location.href.split('#')[0] + '#project-' + id);
  };

  document.addEventListener('click', (event) => {
    const resumeLink = event.target.closest('[data-single-file-resume-new-window]');
    if (resumeLink) {
      event.preventDefault();
      const resumeFrame = document.getElementById('resumeFrame');
      if (!resumeFrame.src) resumeFrame.src = ${resumeBlobExpression};
      window.open(resumeFrame.src, '_blank', 'noopener');
      return;
    }
    const card = event.target.closest('[data-single-file-project]');
    if (!card) return;
    event.preventDefault();
    openProject(card.dataset.singleFileProject);
  });
  home.addEventListener('click', closeProject);
  frame.addEventListener('load', () => { loading.hidden = true; });
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'portfolio-single-file-home') closeProject();
    if (event.data?.type === 'portfolio-single-file-ready') loading.hidden = true;
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && shell.dataset.open === 'true') closeProject();
  });
  const initialProject = location.hash.match(/^#project-([a-z-]+)$/)?.[1];
  if (initialProject) setTimeout(() => openProject(initialProject), 0);
})();
</script>`;

homepage = homepage.replace('</head>', `${shellCss}</head>`).replace('</body>', `${shell}</body>`);

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, homepage);

console.log(JSON.stringify({
  status: 'BUILT',
  output,
  bytes: fs.statSync(output).size,
  projects: projects.length,
}, null, 2));
