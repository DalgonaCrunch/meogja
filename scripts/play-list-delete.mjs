/**
 * 이메일 목록을 삭제한다. 내부 테스트 트랙 → 테스터 탭 → 목록 세부정보 → 이메일 목록 삭제.
 *
 *   node scripts/play-list-delete.mjs "먹자냥 내부 테스터"
 *
 * ⚠ 되돌릴 수 없다. 지우기 전에 구성원을 먼저 읽어 두라(play-list-detail.mjs).
 */
import { chromium } from "playwright";

const listName = process.argv[2];
if (!listName) { console.error('목록 이름이 필요하다'); process.exit(1); }
const APP = "https://play.google.com/console/u/0/developers/7752557066842403074/app/4975077377149967436";

const browser = await chromium.connectOverCDP("http://localhost:9222");
const ctx = browser.contexts()[0];
const page = await ctx.newPage();
try {
  await page.goto(`${APP}/tracks/internal-testing`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  const tab = page.getByRole("tab", { name: /테스터/ }).first();
  if (await tab.count()) { await tab.click(); await page.waitForTimeout(4000); }

  const openDetail = await page.evaluate((name) => {
    const all = [];
    const walk = (root, d) => {
      if (d > 40) return;
      for (const el of root.querySelectorAll("*")) {
        if (el.tagName !== "SCRIPT" && el.tagName !== "STYLE") all.push(el);
        if (el.shadowRoot) walk(el.shadowRoot, d + 1);
      }
    };
    walk(document, 0);
    const nameEl = all.find((el) =>
      Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim() === name));
    if (!nameEl) return "이름 노드 없음";
    let row = nameEl;
    for (let i = 0; i < 8 && row; i++) {
      if ((row.textContent || "").includes("세부정보")) break;
      row = row.parentElement;
    }
    const target = Array.from(row?.querySelectorAll("a,button,[role=link],[role=button]") || [])
      .find((el) => (el.textContent || "").includes("세부정보"));
    if (!target) return "세부정보 링크 없음";
    target.click();
    return "ok";
  }, listName);
  console.log("세부정보:", openDetail);
  if (openDetail !== "ok") throw new Error(openDetail);
  await page.waitForTimeout(4000);

  // 세부정보 패널 안의 "이메일 목록 삭제"
  const del = page.getByText("이메일 목록 삭제", { exact: true }).first();
  await del.click();
  await page.waitForTimeout(2500);

  // 확인 팝업 — 겹친 요소가 포인터를 먹으므로 dialog 안에서 버튼을 찾아 직접 클릭한다
  const confirmed = await page.evaluate(() => {
    const all = [];
    const walk = (root, d) => {
      if (d > 40) return;
      for (const el of root.querySelectorAll("*")) {
        if (el.tagName !== "SCRIPT" && el.tagName !== "STYLE") all.push(el);
        if (el.shadowRoot) walk(el.shadowRoot, d + 1);
      }
    };
    walk(document, 0);
    const dialogs = all.filter(
      (el) => el.getAttribute?.("role") === "dialog" || el.tagName === "DIALOG",
    );
    // 확인 팝업이 나중에 붙는다 — 뒤에서부터, 그리고 "수정" 폼이 아닌 것을 먼저 본다
    dialogs.reverse();
    const ordered = [
      ...dialogs.filter((d) => !/이메일 목록 수정/.test(d.textContent || "")),
      ...dialogs,
    ];
    for (const dlg of ordered) {
      const btn = Array.from(dlg.querySelectorAll("button,[role=button]")).find((b) =>
        /삭제/.test((b.textContent || "").trim()),
      );
      if (btn) { btn.click(); return `팝업 삭제 클릭: ${(dlg.textContent||'').replace(/\s+/g,' ').slice(0,80)}`; }
    }
    return `팝업 ${dialogs.length}개, 삭제 버튼 없음`;
  });
  console.log(confirmed);
  await page.waitForTimeout(5000);
  await page.screenshot({ path: "/tmp/list-deleted.png", fullPage: true });
  console.log("URL:", page.url());
} finally {
  await page.close();
  await browser.close();
}
