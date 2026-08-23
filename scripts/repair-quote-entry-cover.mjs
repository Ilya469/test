import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const quoteFile = path.join(rootDir, "projects/quote/index.html");
const coverFile = process.argv[2];

if (!coverFile || !fs.existsSync(coverFile)) {
  throw new Error("请传入可读取的报价平台入口封面图片路径");
}

const html = fs.readFileSync(quoteFile, "utf8");
const startToken = ',yp="data:image/';
const endToken = ',Vp="data:image/';
const start = html.indexOf(startToken, 6_000_000);
const end = html.indexOf(endToken, start + startToken.length);

if (start < 0 || end < 0) {
  throw new Error("未找到报价平台销售端入口封面资源边界");
}

const mime = path.extname(coverFile).toLowerCase() === ".png"
  ? "image/png"
  : "image/jpeg";
const dataUri = `data:${mime};base64,${fs.readFileSync(coverFile).toString("base64")}`;
const replacement = `,yp="${dataUri}"`;
const nextHtml = html.slice(0, start) + replacement + html.slice(end);

if (nextHtml.includes('yp="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABjIAAAPg')) {
  throw new Error("旧入口封面仍存在，拒绝写入");
}

fs.writeFileSync(quoteFile, nextHtml);
console.log(JSON.stringify({
  status: "PASS",
  quoteFile,
  coverFile,
  oldBytes: end - start,
  newBytes: replacement.length,
}, null, 2));
