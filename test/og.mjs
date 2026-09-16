/*
 * test/og.html → public/og.png (1200×630) 를 헤드리스 크롬으로 찍는다.
 *
 *   npm run og
 *
 * 셸 한 줄로 두지 않은 이유: 윈도우의 npm 은 스크립트를 cmd 로 돌려서
 * `${CHROME:-...}` 같은 bash 문법이 그대로 문자열이 된다. 그리고 크롬은
 * **상대 경로를 자기 작업 폴더 기준으로 푼다** — `--screenshot=public/og.png` 가
 * 「경로를 찾을 수 없습니다」로 죽는다. 둘 다 여기서 절대 경로로 막는다.
 *
 * 다른 크롬을 쓰려면 CHROME 환경변수로 실행 파일 경로를 준다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'test', 'og.html');
const out = path.join(root, 'public', 'og.png');

const candidates = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

const chrome = candidates.find((p) => fs.existsSync(p));
if (!chrome) {
  console.error('크롬을 찾지 못했다. CHROME=<실행 파일 경로> 로 알려줄 것.\n찾아본 곳:');
  for (const c of candidates) console.error('  ' + c);
  process.exit(1);
}

fs.mkdirSync(path.dirname(out), { recursive: true });
const r = spawnSync(chrome, [
  '--headless', '--disable-gpu', '--hide-scrollbars',
  '--window-size=1200,630',
  `--screenshot=${out}`,
  src,
], { stdio: 'inherit' });

if (r.status !== 0 || !fs.existsSync(out)) {
  console.error('og.png 를 만들지 못했다.');
  process.exit(1);
}
console.log(`og.png ${Math.round(fs.statSync(out).size / 1024)}KB — ${out}`);
