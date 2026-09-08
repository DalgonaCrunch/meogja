/**
 * 이미 열려 있는 Play Console 창(CDP 9222)에 붙어 화면을 읽는다.
 *
 *   node scripts/play-cdp.mjs <url> <outPrefix>
 *
 * 사람이 열어 둔 창을 닫지 않는다. 내가 만든 탭만 닫는다.
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const url = process.argv[2];
const prefix = process.argv[3] || "/tmp/play-cdp";
if (!url) { console.error("url 이 필요하다"); process.exit(1); }

const browser = await chromium.connectOverCDP("http://localhost:9222");
const ctx = browser.contexts()[0];
const page = await ctx.newPage();
try {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(7000);
  console.log("URL:", page.url());

  const text = await page.evaluate(() => {
    const out = [];
    const seen = new Set();
    const collect = (root, depth) => {
      if (depth > 40) return;
      for (const el of root.querySelectorAll("*")) {
        const own = Array.from(el.childNodes)
          .filter((n) => n.nodeType === 3)
          .map((n) => n.textContent.trim())
          .filter(Boolean)
          .join(" ");
        if (own && !seen.has(own)) { seen.add(own); out.push(own); }
        if (el.shadowRoot) collect(el.shadowRoot, depth + 1);
      }
    };
    collect(document, 0);
    return out.join("\n");
  });
  writeFileSync(`${prefix}.txt`, text);
  await page.screenshot({ path: `${prefix}.png` });
  console.log(`텍스트 ${text.length}자 -> ${prefix}.txt / ${prefix}.png`);
} finally {
  await page.close();
  await browser.close();
}
