/**
 * 트랙의 테스터 이메일 목록을 고르고 저장한다.
 *
 *   node scripts/play-select-tester.mjs 4699907832861231971 테스터1
 *   node scripts/play-select-tester.mjs internal-testing 테스터1
 *
 * 체크만 하고 저장을 안 누르면 반영되지 않는다.
 */
import { chromium } from "playwright";

const track = process.argv[2] || "4699907832861231971";
const names = process.argv.slice(3);
if (!names.length) { console.error("목록 이름이 필요하다"); process.exit(1); }
const APP = "https://play.google.com/console/u/0/developers/7752557066842403074/app/4975077377149967436";
const URL = `${APP}/tracks/${track}?tab=testers`;

const walkSrc = (() => {
  const a = [];
  const w = (r, d) => {
    if (d > 40) return;
    for (const e of r.querySelectorAll("*")) {
      if (e.tagName !== "SCRIPT" && e.tagName !== "STYLE") a.push(e);
      if (e.shadowRoot) w(e.shadowRoot, d + 1);
    }
  };
  w(document, 0);
  return a;
}).toString();

const browser = await chromium.connectOverCDP("http://localhost:9222");
const page = await browser.contexts()[0].newPage();
try {
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(7000);

  for (const name of names) {
    const res = await page.evaluate(
      ({ name, walkSrc }) => {
        const all = eval(`(${walkSrc})`)();
        const boxes = all.filter((e) => e.getAttribute?.("role") === "checkbox");
        for (const box of boxes) {
          let row = box;
          for (let i = 0; i < 7 && row; i++) {
            const t = (row.textContent || "").replace(/\s+/g, " ").trim();
            if (t.startsWith(name)) break;
            row = row.parentElement;
          }
          const t = (row?.textContent || "").replace(/\s+/g, " ").trim();
          if (t.startsWith(name)) {
            const before = box.getAttribute("aria-checked");
            if (before !== "true") box.click();
            return `이전=${before} 행="${t.slice(0, 50)}"`;
          }
        }
        return `"${name}" 행 없음`;
      },
      { name, walkSrc },
    );
    console.log(`체크 ${name}:`, res);
    if (/없음/.test(res)) throw new Error(res);
    await page.waitForTimeout(2000);
  }

  const saved = await page.evaluate(
    ({ walkSrc }) => {
      const all = eval(`(${walkSrc})`)();
      const btn = all.find(
        (e) =>
          /^(BUTTON|A)$/.test(e.tagName) &&
          (e.textContent || "").replace(/\s+/g, " ").trim() === "저장" &&
          e.offsetParent,
      );
      if (!btn) return "저장 버튼 없음";
      btn.click();
      return "ok";
    },
    { walkSrc },
  );
  console.log("저장:", saved);
  await page.waitForTimeout(7000);
  await page.screenshot({ path: "/tmp/tester-saved.png", fullPage: true });
} finally {
  await page.close();
  await browser.close();
}
