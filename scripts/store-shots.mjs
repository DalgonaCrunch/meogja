/**
 * 플레이 스토어용 스크린샷 촬영 (1080×1920).
 *
 *   node scripts/store-shots.mjs                     # 프로덕션에서 찍는다
 *   BASE=http://localhost:3000 node scripts/store-shots.mjs
 *
 * 결과: store-assets/01..08-*.png  (저장소에서는 .gitignore 로 뺀다)
 *
 * ### 검사 스크립트(check-*.mjs)와 왜 따로 두나
 * 목적이 반대다. 검사는 **깨진 것을 찾으려고** 빈 목록·실패 화면을 일부러 만든다.
 * 여기서는 **가장 보기 좋은 순간**만 고른다. 한 파일에 두 목적을 섞으면 둘 다 나빠진다.
 *
 * ### 해상도
 * 플레이 스토어는 320px 이상이면 받지만, 프로모션 노출 조건이 "1080px 이상,
 * 16:9 또는 9:16, 3장 이상"이다. 어차피 찍는 김에 조건을 넘긴다.
 * 390×844 로 렌더하고 deviceScaleFactor 로 키운다 — 모바일 레이아웃 그대로 선명하게 나온다.
 *
 * ### 온보딩 투어
 * 첫 방문이면 6단계 투어가 화면을 덮는다. '건너뛰기'만 누른다.
 * '시작하기'를 누르면 투어가 진행돼 다음 팝업이 또 뜬다 — 실제로 한 번 당했다.
 */
import { mkdirSync } from "node:fs";
import { launchBrowser } from "./_browser.mjs";

const BASE = process.env.BASE || "https://meogja.vercel.app";
const OUT = process.env.OUT || "store-assets";
// 390×844(모바일 레이아웃) × 2.77 ≈ 1080×2338 → 9:16 보다 길어서 스토어가 잘라낸다.
// 1080×1920 정확히 맞추려면 렌더 크기를 9:16 로 잡고 배율만 올린다.
const W = 405, H = 720, SCALE = 1080 / W; // 1080×1920

mkdirSync(OUT, { recursive: true });

const { browser, close } = await launchBrowser();
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: SCALE,
  locale: "ko-KR",
  serviceWorkers: "block",
  geolocation: { latitude: 37.5665, longitude: 126.978 }, // 서울 시청
  permissions: ["geolocation"],
});
const page = await ctx.newPage();

const shots = [];
async function shot(name) {
  const file = `${OUT}/${String(shots.length + 1).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: file });
  shots.push(file);
  console.log("찍음:", file);
}

/**
 * 화면을 덮는 것을 눌러 치운다.
 *
 * ⚠️ 여기서는 일반 click 을 쓰지 않는다. 투어를 건너뛴 뒤에도 `z-index:200` 짜리
 * 고정 레이어가 남아 포인터 이벤트를 가로챈다(실제로 30초 타임아웃을 맞았다).
 * 스크린샷이 목적이므로 요소에 직접 click() 을 걸어 통과시킨다.
 */
async function jsClick(locator) {
  if (!(await locator.count().catch(() => 0))) return false;
  await locator.first().evaluate((el) => el.click()).catch(() => {});
  return true;
}

/** 투어 팝업만 닫는다. '시작하기'는 누르지 않는다(투어가 진행된다). */
async function skipTour() {
  for (let i = 0; i < 4; i++) {
    if (await jsClick(page.locator("text=건너뛰기"))) { await page.waitForTimeout(400); continue; }
    if (await jsClick(page.locator("text=나중에"))) { await page.waitForTimeout(400); continue; }
    break;
  }
}

async function go(path, wait = 2000) {
  await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(wait);
  await skipTour();
  await page.waitForTimeout(600);
}

// ── 1. 홈 ────────────────────────────────────────────────────────────────
await go("/");
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(400);
await shot("home");

// ── 2. 랜덤 룰렛 ─────────────────────────────────────────────────────────
// 홈의 "오늘 뭐 먹지?" 룰렛. 돌린 뒤 결과가 뜬 순간을 찍는다.
{
  if (await jsClick(page.locator("text=랜덤 추천"))) {
    await page.waitForTimeout(4500); // 룰렛이 돌아가는 시간
    await shot("roulette");
  } else {
    console.log("⚠️ '랜덤 추천' 버튼을 못 찾았다 — 홈 진입점이 바뀌었는지 확인할 것");
  }
}

// ── 3~4. 메뉴 월드컵 ─────────────────────────────────────────────────────
await go("/play", 1500);
{
  if (await jsClick(page.locator("text=16강"))) {
    await page.waitForTimeout(1800);
    await shot("worldcup-match");

    // 왼쪽만 계속 골라 끝까지 진행 → 우승 화면
    for (let i = 0; i < 20; i++) {
      const prompt = page.locator("text=더 먹고 싶은 걸 선택하세요");
      if (!(await prompt.count().catch(() => 0))) break;
      // 카드 두 장 중 왼쪽을 누른다. 좌표로 누르는 편이 구조 변경에 덜 흔들린다.
      await page.mouse.click(W * 0.28, H * 0.42);
      await page.waitForTimeout(900);
    }
    await page.waitForTimeout(1200);
    await shot("worldcup-winner");
  } else {
    console.log("⚠️ 월드컵 강 수 버튼을 못 찾았다");
  }
}

// ── 5. 랭킹 ──────────────────────────────────────────────────────────────
await go("/play", 1200);
{
  if (await jsClick(page.locator("text=랭킹"))) {
    // "집계 중..." 이 걸린 채로 찍으면 빈 화면이 나온다. 실제로 한 번 그렇게 찍혔다.
    await page
      .waitForFunction(() => !document.body.innerText.includes("집계 중"), null, { timeout: 20000 })
      .catch(() => console.log("⚠️ 랭킹 집계가 20초 안에 안 끝났다"));
    await page.waitForTimeout(1200);
    await shot("ranking");
  }
}

// ── 6. MBTI ──────────────────────────────────────────────────────────────
{
  if (await jsClick(page.locator("text=MBTI"))) {
    await page.waitForTimeout(1500);
    // 유형을 하나 고른 화면이 훨씬 낫다. 빈 격자는 "뭘 하는 화면인지" 가 안 보인다.
    await jsClick(page.getByRole("button", { name: "ENFP", exact: true }));
    await page.waitForTimeout(2000);
    await shot("mbti");
  }
}

/*
 * 배틀 탭과 모임 목록은 일부러 뺀다.
 *  - 배틀: 오늘 투표가 0표면 "50% / 0표"만 크게 보인다. 죽은 화면처럼 읽힌다
 *  - 모임: 실제 사용자들이 만든 모임 이름이 그대로 나온다. 남의 이름을
 *          스토어 홍보물에 박는 것은 하지 않는다
 */

// ── 7. 주변 맛집 ─────────────────────────────────────────────────────────
await go("/nearby", 3500);
await shot("nearby");

await close();
console.log(`\n✅ ${shots.length}장 — ${OUT}/`);
