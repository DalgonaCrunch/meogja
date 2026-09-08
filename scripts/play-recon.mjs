/**
 * Play Console 화면 정찰용. 로그인 프로필을 재사용해 지정 URL 을 열고
 * shadow DOM 을 재귀로 훑은 텍스트와 스크린샷을 남긴다.
 *
 *   node scripts/play-recon.mjs [url] [outPrefix]
 */
import { chromium } from "playwright";
import { homedir } from "node:os";
import { writeFileSync } from "node:fs";

const PROFILE = process.env.PLAY_PROFILE || `${homedir()}/.play-console-profile`;
const url = process.argv[2] || "https://play.google.com/console/developers";
const prefix = process.argv[3] || "/tmp/play-recon";

const ctx = await chromium.launchPersistentContext(PROFILE, {
  channel: "chrome",
  headless: false,
  viewport: { width: 1440, height: 1000 },
  args: ["--window-size=1440,1000", "--window-position=-4000,-4000", "--no-first-run", "--no-default-browser-check"],
});

try {
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  console.log("URL:", page.url());

  const text = await page.evaluate(() => {
    const out = [];
    const walk = (root) => {
      for (const el of root.querySelectorAll("*")) {
        if (el.shadowRoot) walk(el.shadowRoot);
      }
      const t = root.textContent;
      if (t) out.push(t);
    };
    const seen = new Set();
    const collect = (root, depth) => {
      if (depth > 30) return;
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
  await page.screenshot({ path: `${prefix}.png`, fullPage: false });
  console.log(`텍스트 ${text.length}자 -> ${prefix}.txt / 스크린샷 ${prefix}.png`);
} finally {
  await ctx.close();
}
