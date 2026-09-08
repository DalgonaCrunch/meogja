/**
 * 콘솔 화면을 열고 지정한 탭을 눌러 텍스트 + 체크박스 상태를 읽는다.
 * 열려 있는 창(CDP 9222)에 붙는다.
 *
 *   node scripts/play-tab.mjs <url> "국가/지역" /tmp/out
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const [url, tabName, prefix = "/tmp/play-tab"] = process.argv.slice(2);
if (!url) { console.error("url 이 필요하다"); process.exit(1); }

const browser = await chromium.connectOverCDP("http://localhost:9222");
const ctx = browser.contexts()[0];
const page = await ctx.newPage();
try {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);

  if (tabName) {
    const tab = page.getByRole("tab", { name: new RegExp(tabName.replace(/[/]/g, ".")) }).first();
    if (await tab.count()) { await tab.click(); await page.waitForTimeout(5000); console.log(`탭 "${tabName}" 클릭`); }
    else console.log(`⚠ 탭 "${tabName}" 없음`);
  }

  const info = await page.evaluate(() => {
    const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"]);
    const all = [];
    const walk = (root, d) => {
      if (d > 40) return;
      for (const el of root.querySelectorAll("*")) {
        if (!SKIP.has(el.tagName)) all.push(el);
        if (el.shadowRoot) walk(el.shadowRoot, d + 1);
      }
    };
    walk(document, 0);

    const seen = new Set();
    const lines = [];
    for (const el of all) {
      const own = Array.from(el.childNodes)
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join(" ");
      if (own && !seen.has(own)) { seen.add(own); lines.push(own); }
    }

    const checks = all
      .filter((el) => el.getAttribute?.("role") === "checkbox")
      .map((el) => {
        let row = el;
        for (let i = 0; i < 6 && row; i++) {
          if ((row.textContent || "").replace(/\s+/g, "").length > 2) break;
          row = row.parentElement;
        }
        return {
          checked: el.getAttribute("aria-checked"),
          label: (row?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 100),
        };
      });

    return { text: lines.join("\n"), checks };
  });

  writeFileSync(`${prefix}.txt`, info.text);
  writeFileSync(`${prefix}.checks.json`, JSON.stringify(info.checks, null, 2));
  await page.screenshot({ path: `${prefix}.png`, fullPage: true });
  console.log("URL:", page.url());
  console.log(JSON.stringify(info.checks, null, 2).slice(0, 2000));
  console.log(`텍스트 -> ${prefix}.txt / ${prefix}.png`);
} finally {
  await page.close();
  await browser.close();
}
