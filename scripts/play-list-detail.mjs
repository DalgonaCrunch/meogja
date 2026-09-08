/**
 * 이메일 목록의 구성원을 읽는다. 내부 테스트 트랙 → 테스터 탭 → 목록의 "세부정보".
 *
 *   node scripts/play-list-detail.mjs "테스터1" /tmp/list-tester1
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const listName = process.argv[2] || "테스터1";
const prefix = process.argv[3] || "/tmp/list-detail";
const APP = "https://play.google.com/console/u/0/developers/7752557066842403074/app/4975077377149967436";

const dumpText = (page) =>
  page.evaluate(() => {
    const out = [];
    const seen = new Set();
    const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"]);
    const walk = (root, depth) => {
      if (depth > 40) return;
      for (const el of root.querySelectorAll("*")) {
        if (SKIP.has(el.tagName)) continue;
        const own = Array.from(el.childNodes)
          .filter((n) => n.nodeType === 3)
          .map((n) => n.textContent.replace(/\s+/g, " ").trim())
          .filter(Boolean)
          .join(" ");
        if (own && !seen.has(own)) { seen.add(own); out.push(own); }
        if (el.shadowRoot) walk(el.shadowRoot, depth + 1);
      }
    };
    walk(document, 0);
    return out.join("\n");
  });

const browser = await chromium.connectOverCDP("http://localhost:9222");
const ctx = browser.contexts()[0];
const page = await ctx.newPage();
try {
  await page.goto(`${APP}/tracks/internal-testing`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  if (!page.url().includes("internal-testing")) throw new Error(`트랙 페이지로 못 들어갔다: ${page.url()}`);

  const tab = page.getByRole("tab", { name: /테스터/ }).first();
  if (await tab.count()) { await tab.click(); await page.waitForTimeout(4000); }

  // 행이 tr 이 아니다. 목록 이름 노드에서 위로 올라가 "세부정보" 를 품은 조상을 찾고
  // 그 안의 세부정보 링크를 직접 누른다 (인덱스로 찾지 않는다).
  const clicked = await page.evaluate((name) => {
    const SKIP = new Set(["SCRIPT", "STYLE"]);
    const all = [];
    const walk = (root, depth) => {
      if (depth > 40) return;
      for (const el of root.querySelectorAll("*")) {
        if (!SKIP.has(el.tagName)) all.push(el);
        if (el.shadowRoot) walk(el.shadowRoot, depth + 1);
      }
    };
    walk(document, 0);
    const nameEl = all.find(
      (el) =>
        Array.from(el.childNodes).some(
          (n) => n.nodeType === 3 && n.textContent.trim() === name,
        ),
    );
    if (!nameEl) return "이름 노드 없음";
    let row = nameEl;
    for (let i = 0; i < 8 && row; i++) {
      if ((row.textContent || "").includes("세부정보")) break;
      row = row.parentElement || row.getRootNode()?.host;
    }
    if (!row) return "행 없음";
    const target = Array.from(row.querySelectorAll("a,button,[role=link],[role=button]")).find(
      (el) => (el.textContent || "").includes("세부정보"),
    );
    if (!target) return "세부정보 링크 없음";
    target.click();
    return "ok";
  }, listName);
  console.log("세부정보 클릭:", clicked);
  if (clicked !== "ok") throw new Error(clicked);
  await page.waitForTimeout(5000);

  const text = await dumpText(page);
  writeFileSync(`${prefix}.txt`, text);
  await page.screenshot({ path: `${prefix}.png`, fullPage: true });
  const emails = [...new Set(text.match(/[\w.+-]+@[\w.-]+\.\w+/g) || [])];
  console.log("URL:", page.url());
  console.log("이메일:", emails.join(", ") || "(없음)");
  console.log(`덤프 -> ${prefix}.txt / ${prefix}.png`);
} finally {
  await page.close();
  await browser.close();
}
