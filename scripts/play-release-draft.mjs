/**
 * 비공개 테스트 트랙의 임시 버전에 라이브러리의 App Bundle 을 붙이고 임시보관함에 저장한다.
 *
 *   node scripts/play-release-draft.mjs 1.0.1 "첫 비공개 테스트 버전입니다."
 *
 * "다음"(미리보기)·"검토를 위해 전송"은 누르지 않는다. 임시 저장까지만 한다.
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const version = process.argv[2] || "1.0.1";
const notes = process.argv[3] || "";
const URL =
  "https://play.google.com/console/u/0/developers/7752557066842403074/app/4975077377149967436/tracks/4699907832861231971/releases/1/prepare";

const walk = (() => {
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

const clickBtn = (page, re, { visibleOnly = true } = {}) =>
  page.evaluate(
    ({ walk, src, visibleOnly }) => {
      const all = eval(`(${walk})`)();
      const rx = new RegExp(src);
      const btn = all.find(
        (e) =>
          /^(BUTTON|A)$/.test(e.tagName) &&
          rx.test((e.textContent || "").replace(/\s+/g, " ").trim()) &&
          (!visibleOnly || e.offsetParent),
      );
      if (!btn) return "버튼 없음";
      btn.click();
      return "ok";
    },
    { walk, src: re.source, visibleOnly },
  );

const dump = async (page, file) => {
  const t = await page.evaluate(
    ({ walk }) => {
      const all = eval(`(${walk})`)();
      const seen = new Set();
      const out = [];
      for (const e of all) {
        const own = Array.from(e.childNodes)
          .filter((n) => n.nodeType === 3)
          .map((n) => n.textContent.replace(/\s+/g, " ").trim())
          .filter(Boolean)
          .join(" ");
        if (own && !seen.has(own)) { seen.add(own); out.push(own); }
      }
      return out.join("\n");
    },
    { walk },
  );
  writeFileSync(file, t);
  return t;
};

const browser = await chromium.connectOverCDP("http://localhost:9222");
const page = await browser.contexts()[0].newPage();
try {
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(7000);

  // 이미 번들이 붙어 있으면 다시 붙이지 않는다
  const already = (await dump(page, "/tmp/rel-before.txt")).includes(`App bundle`) &&
    /버전 코드[\s\S]{0,40}2/.test(await page.evaluate(() => document.body.innerText || ""));

  console.log("라이브러리에서 추가:", await clickBtn(page, /라이브러리에서 추가/));
  await page.waitForTimeout(6000);

  const picked = await page.evaluate(
    ({ walk, version }) => {
      const all = eval(`(${walk})`)();
      const rows = all.filter((e) => e.classList?.contains("particle-table-row"));
      const row = rows.find((r) => (r.textContent || "").includes(version));
      if (!row) return `${version} 행 없음 (행 ${rows.length}개)`;
      const box = row.querySelector("[role=checkbox], [role=radio], input[type=checkbox]");
      if (!box) return "체크박스 없음";
      if (box.getAttribute("aria-checked") !== "true") box.click();
      return `선택: ${(row.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60)}`;
    },
    { walk, version },
  );
  console.log(picked);
  if (/없음/.test(picked)) throw new Error(picked);
  await page.waitForTimeout(2000);

  console.log("버전에 추가:", await clickBtn(page, /^버전에 추가$/));
  await page.waitForTimeout(8000);

  if (notes) {
    const wrote = await page.evaluate(
      ({ walk, notes }) => {
        const all = eval(`(${walk})`)();
        const ta = all.find((e) => e.tagName === "TEXTAREA" && e.offsetParent);
        if (!ta) return "출시 노트 입력란 없음";
        ta.focus();
        ta.value = notes.includes("<") ? notes : `<ko-KR>\n${notes}\n</ko-KR>`;
        ta.dispatchEvent(new Event("input", { bubbles: true }));
        ta.dispatchEvent(new Event("change", { bubbles: true }));
        return "ok";
      },
      { walk, notes },
    );
    console.log("출시 노트:", wrote);
    await page.waitForTimeout(2000);
  }

  console.log("임시보관함에 저장:", await clickBtn(page, /임시보관함에 저장/));
  await page.waitForTimeout(8000);
  const after = await dump(page, "/tmp/rel-after.txt");
  await page.screenshot({ path: "/tmp/rel-after.png", fullPage: true });
  console.log("URL:", page.url());
  console.log(after.split("\n").filter((l) => /1\.0|출시명|오류|저장|버전 코드/.test(l)).slice(0, 20).join("\n"));
} finally {
  await page.close();
  await browser.close();
}
