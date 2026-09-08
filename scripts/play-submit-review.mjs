/**
 * 게시 개요에서 저장된 변경사항을 검토를 위해 Google 에 전송한다.
 *
 *   node scripts/play-submit-review.mjs          # 화면만 읽는다
 *   SUBMIT=1 node scripts/play-submit-review.mjs # 전송 (되돌릴 수 없다)
 *
 * `/publishing-overview` 직행은 app-list 로 튕긴다 → 대시보드에서 "게시 개요" 를 눌러 들어간다.
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const SUBMIT = process.env.SUBMIT === "1";
const APP = "https://play.google.com/console/u/0/developers/7752557066842403074/app/4975077377149967436";

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

const clickText = (page, re) =>
  page.evaluate(
    ({ walk, src }) => {
      const all = eval(`(${walk})`)();
      const rx = new RegExp(src);
      const btn = all.find(
        (e) =>
          /^(BUTTON|A)$/.test(e.tagName) &&
          rx.test((e.textContent || "").replace(/\s+/g, " ").trim()) &&
          e.offsetParent,
      );
      if (!btn) return "버튼 없음";
      btn.click();
      return "ok";
    },
    { walk, src: re.source },
  );

const browser = await chromium.connectOverCDP("http://localhost:9222");
const page = await browser.contexts()[0].newPage();
try {
  await page.goto(`${APP}/app-dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(7000);
  let nav = await clickText(page, /게시 개요로 이동/);
  if (nav !== "ok") nav = await clickText(page, /검토를 위해 Google에 버전 전송/);
  if (nav !== "ok") nav = await clickText(page, /게시 개요/);
  console.log("게시 개요:", nav);
  await page.waitForTimeout(8000);
  const t = await dump(page, "/tmp/pubov.txt");
  await page.screenshot({ path: "/tmp/pubov.png", fullPage: true });
  console.log("URL:", page.url());
  console.log(t.split("\n").filter((l) => /검토|전송|변경|버전|1\.0|테스터|국가/.test(l)).slice(0, 30).join("\n"));

  if (SUBMIT) {
    const r = await clickText(page, /검토를 위해 변경사항 .*제출|검토를 위해 전송|변경사항 전송/);
    console.log("전송 클릭:", r);
    if (r !== "ok") throw new Error("전송 버튼을 못 찾았다");
    await page.waitForTimeout(4000);
    const confirmed = await page.evaluate(
      ({ walk }) => {
        const all = eval(`(${walk})`)();
        const modals = all.filter(
          (e) =>
            e.getAttribute?.("role") === "dialog" ||
            e.tagName === "DIALOG" ||
            (e.classList?.contains("modal") && e.classList?.contains("visible")),
        );
        modals.reverse();
        const seen = [];
        for (const m of modals) {
          if (!/전송하시겠|검토를 위해 변경사항/.test(m.textContent || "")) continue;
          const btns = Array.from(m.querySelectorAll("button,[role=button]"));
          seen.push(...btns.map((b) => (b.textContent || "").replace(/\s+/g, " ").trim()));
          const btn = btns.find((b) => {
            const t = (b.textContent || "").replace(/\s+/g, " ").trim();
            return /전송|제출/.test(t) && !/취소|닫기/.test(t);
          });
          if (btn) { btn.click(); return `팝업 확인 클릭="${(btn.textContent || "").trim()}"`; }
        }
        return `확인 버튼 없음. 후보=${JSON.stringify(seen)}`;
      },
      { walk },
    );
    console.log(confirmed);
    await page.waitForTimeout(12000);
    const after = await dump(page, "/tmp/pubov-after.txt");
    await page.screenshot({ path: "/tmp/pubov-after.png", fullPage: true });
    console.log(after.split("\n").filter((l) => /검토|전송|대기|중/.test(l)).slice(0, 15).join("\n"));
  }
} finally {
  await page.close();
  await browser.close();
}
