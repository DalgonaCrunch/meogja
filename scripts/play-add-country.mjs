/**
 * 비공개 테스트 트랙에 국가/지역을 추가한다.
 *
 *   node scripts/play-add-country.mjs 대한민국
 *
 * 화면 구조(2026-09-08): "국가/지역 추가" 버튼 → 모달(role=dialog 가 아니다) 안의
 * `.particle-table-row` 목록. 행마다 `[role=checkbox]` 가 있고, 저장 버튼은 "저장" 하나뿐이다.
 */
import { chromium } from "playwright";

const country = process.argv[2] || "대한민국";
const TRACK =
  "https://play.google.com/console/u/0/developers/7752557066842403074/app/4975077377149967436/tracks/4699907832861231971?tab=countryAvailability";

const walkAll = () => {
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
};

const browser = await chromium.connectOverCDP("http://localhost:9222");
const page = await browser.contexts()[0].newPage();
try {
  await page.goto(TRACK, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);

  const opened = await page.evaluate(
    ({ walkSrc }) => {
      const all = eval(`(${walkSrc})`)();
      const btn = all.find(
        (e) => /^(BUTTON|A)$/.test(e.tagName) && /국가\/지역 추가/.test((e.textContent || "").trim()),
      );
      if (!btn) return "추가 버튼 없음";
      btn.click();
      return "ok";
    },
    { walkSrc: walkAll.toString() },
  );
  console.log("모달 열기:", opened);
  if (opened !== "ok") throw new Error(opened);
  await page.waitForTimeout(5000);

  const checked = await page.evaluate(
    ({ name, walkSrc }) => {
      const all = eval(`(${walkSrc})`)();
      const rows = all.filter((e) => e.classList?.contains("particle-table-row"));
      const row = rows.find((r) => {
        const t = (r.textContent || "").replace(/\s+/g, " ").trim();
        return t.startsWith(name) || t.includes(` ${name} `);
      });
      if (!row) return `"${name}" 행 없음 (행 ${rows.length}개)`;
      const box = row.querySelector("[role=checkbox], input[type=checkbox]");
      if (!box) return "행에 체크박스 없음";
      const before = box.getAttribute("aria-checked");
      if (before !== "true") box.click();
      return `행="${(row.textContent || "").replace(/\s+/g, " ").trim().slice(0, 50)}" 이전=${before}`;
    },
    { name: country, walkSrc: walkAll.toString() },
  );
  console.log("체크:", checked);
  if (/없음/.test(checked)) throw new Error(checked);
  await page.waitForTimeout(2500);

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
    { walkSrc: walkAll.toString() },
  );
  console.log("저장:", saved);
  await page.waitForTimeout(7000);
  await page.screenshot({ path: "/tmp/country-after.png", fullPage: true });
  console.log("URL:", page.url());
} finally {
  await page.close();
  await browser.close();
}
