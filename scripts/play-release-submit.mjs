/**
 * 임시보관함에 저장된 비공개 테스트 버전을 미리보기까지 넘기고(기본),
 * SUBMIT=1 이면 "출시 시작"(검토 전송)까지 누른다.
 *
 *   node scripts/play-release-submit.mjs            # 미리보기까지, 화면 덤프
 *   SUBMIT=1 node scripts/play-release-submit.mjs   # 검토 전송 (되돌릴 수 없다)
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const SUBMIT = process.env.SUBMIT === "1";
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

const clickExact = (page, label) =>
  page.evaluate(
    ({ walk, label }) => {
      const all = eval(`(${walk})`)();
      const btn = all.find(
        (e) =>
          /^(BUTTON|A)$/.test(e.tagName) &&
          (e.textContent || "").replace(/\s+/g, " ").trim() === label &&
          e.offsetParent,
      );
      if (!btn) return "버튼 없음";
      btn.click();
      return "ok";
    },
    { walk, label },
  );

const browser = await chromium.connectOverCDP("http://localhost:9222");
const page = await browser.contexts()[0].newPage();
try {
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(7000);

  console.log("다음:", await clickExact(page, "다음"));
  await page.waitForTimeout(9000);
  const preview = await dump(page, "/tmp/preview.txt");
  await page.screenshot({ path: "/tmp/preview.png", fullPage: true });
  console.log("URL:", page.url());
  console.log(
    preview
      .split("\n")
      .filter((l) => /출시|검토|오류|경고|버전|국가|테스터|1\.0/.test(l))
      .slice(0, 25)
      .join("\n"),
  );

  if (!SUBMIT) {
    console.log("\n(SUBMIT=1 을 주면 저장 → 검토 전송까지 누른다)");
  } else {
    // 미리보기 화면의 버튼은 "저장" 이다. 누르면 게시 개요에 담기고 전송 준비 상태가 된다.
    let r = await clickExact(page, "저장");
    if (r !== "ok") r = await clickExact(page, "출시 시작");
    console.log("미리보기 저장:", r);
    if (r !== "ok") throw new Error("저장 버튼을 못 찾았다");
    await page.waitForTimeout(4000);

    // 확인 팝업 — 나중에 뜬 모달부터 본다 (14장 함정)
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
        for (const m of modals) {
          const btn = Array.from(m.querySelectorAll("button,[role=button]")).find((b) =>
            /^(출시 시작|확인|전송|출시)$/.test((b.textContent || "").replace(/\s+/g, " ").trim()),
          );
          if (btn) {
            btn.click();
            return `팝업 확인: ${(m.textContent || "").replace(/\s+/g, " ").slice(0, 80)}`;
          }
        }
        return `팝업 ${modals.length}개, 확인 버튼 없음`;
      },
      { walk },
    );
    console.log(confirmed);
    await page.waitForTimeout(10000);
    await dump(page, "/tmp/submitted.txt");
    await page.screenshot({ path: "/tmp/submitted.png", fullPage: true });
    console.log("최종 URL:", page.url());
  }
} finally {
  await page.close();
  await browser.close();
}
