/**
 * 트랙의 테스트 참여(옵트인) 링크를 뽑는다.
 *   node scripts/play-optin-link.mjs 4699907832861231971
 */
import { chromium } from "playwright";
const track = process.argv[2] || "4699907832861231971";
const URL = `https://play.google.com/console/u/0/developers/7752557066842403074/app/4975077377149967436/tracks/${track}?tab=testers`;
const walk = (() => { const a=[]; const w=(r,d)=>{if(d>40)return;for(const e of r.querySelectorAll("*")){if(e.tagName!=="SCRIPT"&&e.tagName!=="STYLE")a.push(e);if(e.shadowRoot)w(e.shadowRoot,d+1);}}; w(document,0); return a; }).toString();
const browser = await chromium.connectOverCDP("http://localhost:9222");
const page = await browser.contexts()[0].newPage();
try {
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  // "링크 복사" 버튼은 클립보드에 값을 쓴다. readText() 는 권한 프롬프트에 걸려 멈추므로
  // 쓰기 쪽을 가로채서 값을 받는다.
  const clip = await page.evaluate(({ walk }) => {
    window.__copied = "";
    try {
      if (navigator.clipboard) navigator.clipboard.writeText = (t) => ((window.__copied = t), Promise.resolve());
    } catch {}
    const exec = document.execCommand?.bind(document);
    document.execCommand = (cmd, ...rest) => {
      if (cmd === "copy") {
        const sel = window.getSelection?.().toString();
        if (sel) window.__copied = sel;
      }
      return exec ? exec(cmd, ...rest) : false;
    };
    const all = eval(`(${walk})`)();
    const btn = all.find((e) => /^(BUTTON|A)$/.test(e.tagName) && /링크 복사/.test((e.textContent || "").trim()));
    if (!btn) return "링크 복사 버튼 없음";
    btn.click();
    return new Promise((res) => setTimeout(() => res(window.__copied || "(복사된 값 없음)"), 2000));
  }, { walk });
  console.log("링크 복사 결과:", clip);

  const links = await page.evaluate(({ walk }) => {
    const all = eval(`(${walk})`)();
    const out = new Set();
    for (const e of all) {
      const href = e.getAttribute?.("href") || "";
      if (/play\.google\.com\/apps\/(internal)?test/.test(href)) out.add(href);
      const t = (e.textContent || "").match(/https:\/\/play\.google\.com\/apps\/\S+/g);
      if (t) t.forEach((x) => out.add(x));
    }
    return [...out];
  }, { walk });
  console.log(links.length ? links.join("\n") : "링크가 화면에 안 보인다 (링크 복사 버튼을 눌러야 나올 수 있다)");
} finally { await page.close(); await browser.close(); }
