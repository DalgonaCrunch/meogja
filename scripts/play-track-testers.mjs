/**
 * 지정한 테스트 트랙(내부/비공개/공개)의 "테스터" 탭 상태를 읽는다.
 * 이메일 목록 행마다 체크 여부(role=checkbox 의 aria-checked)를 함께 뽑는다.
 *
 *   node scripts/play-track-testers.mjs "내부 테스트" /tmp/internal
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const navLabel = process.argv[2] || "내부 테스트";
const prefix = process.argv[3] || "/tmp/track-testers";
const APP = "https://play.google.com/console/u/0/developers/7752557066842403074/app/4975077377149967436";

const browser = await chromium.connectOverCDP("http://localhost:9222");
const ctx = browser.contexts()[0];
const page = await ctx.newPage();
try {
  const direct = navLabel.startsWith("http");
  await page.goto(direct ? navLabel : `${APP}/app-dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);

  // 왼쪽 메뉴에서 트랙 이름을 눌러 들어간다 (직행 URL 은 app-list 로 튕기는 경로가 있다)
  // 왼쪽 메뉴는 접혀 있다. 상위 항목을 펼친 뒤 트랙 이름을 누른다.
  const clickLabel = async (label) => {
    const loc = page.getByText(label, { exact: true }).first();
    if (!(await loc.count())) return false;
    if (await loc.isVisible()) { await loc.click(); return true; }
    // 보이지 않으면 클릭 가능한 조상을 찾아 직접 클릭 이벤트를 보낸다
    const ok = await loc.evaluate((el) => {
      let n = el;
      for (let i = 0; i < 6 && n; i++) {
        if (n.offsetParent || n.getClientRects?.().length) { n.click(); return true; }
        n = n.parentElement;
      }
      el.click();
      return true;
    });
    return ok;
  };

  for (const label of direct ? [] : ["테스트 및 출시", "테스트", navLabel]) {
    const ok = await clickLabel(label);
    console.log(`nav "${label}": ${ok ? "클릭" : "없음"}`);
    await page.waitForTimeout(2500);
  }
  await page.waitForTimeout(6000);
  console.log("트랙 URL:", page.url());

  const tab = page.getByRole("tab", { name: /테스터/ }).first();
  if (await tab.count()) { await tab.click(); await page.waitForTimeout(5000); }

  const info = await page.evaluate(() => {
    const rows = [];
    const walk = (root, depth) => {
      if (depth > 40) return;
      for (const el of root.querySelectorAll("*")) {
        if (el.getAttribute && el.getAttribute("role") === "checkbox") {
          let row = el.closest("tr") || el.parentElement?.closest("tr") || el.parentElement;
          for (let i = 0; i < 6 && row && !/\S/.test(row.textContent || ""); i++) row = row.parentElement;
          rows.push({
            checked: el.getAttribute("aria-checked"),
            label: (row?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120),
          });
        }
        if (el.shadowRoot) walk(el.shadowRoot, depth + 1);
      }
    };
    walk(document, 0);
    const title = document.title;
    return { title, rows };
  });

  writeFileSync(`${prefix}.json`, JSON.stringify(info, null, 2));
  await page.screenshot({ path: `${prefix}.png`, fullPage: true });
  console.log(JSON.stringify(info, null, 2).slice(0, 3000));
} finally {
  await page.close();
  await browser.close();
}
