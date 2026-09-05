/**
 * 플레이 스토어 그래픽 이미지(피처 그래픽) 1024×500 생성.
 *
 *   node scripts/feature-graphic.mjs   → store-assets/feature-graphic.png
 *
 * ### 왜 Playwright 로 그리나
 * 이 환경에 이미지 라이브러리(Pillow)가 없다. 그런데 브라우저는 이미 있고(확인 스크립트용)
 * HTML/CSS 는 이런 배치에 강하다. 새 의존성을 들이는 것보다 있는 도구를 쓰는 편이 낫다.
 *
 * ### 담는 것과 담지 않는 것
 * 스토어에서 이 그림은 **작게, 스쳐 지나가며** 보인다. 앱 이름과 "친구들과 메뉴를
 * 정한다"는 사실 하나만 남긴다. 설명 문구를 더 넣고 싶어지지만 그 크기에서는 읽히지
 * 않고 지저분해지기만 한다.
 *
 * 아이콘·마스코트·음식 그림은 앱에 실제로 쓰는 파일을 그대로 가져온다.
 * 스토어의 아이콘과 그림 속 아이콘이 다르면 같은 앱으로 안 읽힌다.
 * 배경·주황색은 globals.css 의 --bg / --primary 와 같은 값이다.
 */
import { readFileSync, mkdirSync } from "node:fs";
import { launchBrowser } from "./_browser.mjs";

const OUT = process.env.OUT || "store-assets";
mkdirSync(OUT, { recursive: true });

const b64 = (p) => readFileSync(p).toString("base64");
const icon = b64("public/icon-512.png");
const mascot = b64("public/mascot/poses/wave-01.png"); // 손 흔드는 전신 — 140×140 라 크게 못 키운다
const foods = ["삼겹살", "치킨", "초밥", "파스타", "떡볶이", "라멘"]
  .map((n) => {
    try { return b64(`public/food-icons/${n}.png`); } catch { return null; }
  })
  .filter(Boolean);

const html = `<!doctype html><html><head><meta charset="utf-8">
<style>
  /* 앱과 같은 방식으로 부른다(globals.css 1행과 동일). link 태그로 걸면
     setContent 의 networkidle 이 폰트 적용 전에 끝나 Jua 가 안 먹는다 — 실제로 당했다. */
  @import url('https://fonts.googleapis.com/css2?family=Jua&family=Noto+Sans+KR:wght@500;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box }
  body {
    width:1024px; height:500px; overflow:hidden; position:relative;
    background: radial-gradient(120% 150% at 16% 20%, #FFFDF9 0%, #FFF8F1 44%, #FFE3CE 100%);
    font-family:'Noto Sans KR', system-ui, sans-serif;
  }
  /* Play Games 카드에서는 가운데에 로고가 얹히는 경우가 있다.
     그래서 글자는 왼쪽, 그림은 오른쪽 끝으로 밀어 가운데를 비워 둔다. */
  .left { position:absolute; left:64px; top:50%; transform:translateY(-50%); }
  .row { display:flex; align-items:center; gap:22px; margin-bottom:18px }
  .icon { width:96px; height:96px; border-radius:24px; box-shadow:0 8px 24px rgba(74,44,29,.16) }
  .name { font-family:'Jua',sans-serif; font-size:60px; color:#2B2B2B; letter-spacing:-.02em; line-height:1 }
  .tag  { font-family:'Jua',sans-serif; font-size:34px; color:#E55E2B; line-height:1.35 }
  .tag b { color:#FF7A45 }

  /* 원본이 140×140 이다. 이보다 크게 키우면 뭉갠 티가 난다. */
  .mascot { position:absolute; right:78px; bottom:34px; width:190px; image-rendering:auto;
            filter:drop-shadow(0 10px 24px rgba(74,44,29,.18)) }

  /* 음식 그림을 오른쪽 위에 흩뿌린다. 가운데는 비워 둔다. */
  .food { position:absolute; filter:drop-shadow(0 6px 14px rgba(74,44,29,.14)) }
  .f0 { right:318px; top:44px;  width:104px; transform:rotate(-9deg) }
  .f1 { right:168px; top:16px;  width:86px;  transform:rotate(7deg) }
  .f2 { right:46px;  top:74px;  width:92px;  transform:rotate(-5deg) }
  .f3 { right:326px; top:198px; width:78px;  transform:rotate(11deg) }
  .f4 { right:214px; top:154px; width:68px;  transform:rotate(-14deg) }
</style></head><body>
  <div class="left">
    <div class="row">
      <img class="icon" src="data:image/png;base64,${icon}">
      <div class="name">오늘 뭐 먹지?</div>
    </div>
    <div class="tag">친구들과 <b>3분 만에</b><br>메뉴 정하기</div>
  </div>
  ${foods.slice(0, 5).map((f, i) => `<img class="food f${i}" src="data:image/png;base64,${f}">`).join("")}
  <img class="mascot" src="data:image/png;base64,${mascot}">
</body></html>`;

const { browser, close } = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.setContent(html, { waitUntil: "networkidle" });
// Jua 가 실제로 붙었는지 확인하고 찍는다. 안 붙으면 Noto 로 떨어져 앱과 다른 인상이 된다.
await page.evaluate(async () => {
  await document.fonts.load("60px Jua");
  await document.fonts.ready;
});
const juaOk = await page.evaluate(() => document.fonts.check("60px Jua"));
if (!juaOk) console.log("⚠️ Jua 폰트가 안 붙었다 — 앱 제목과 인상이 달라진다");
await page.waitForTimeout(600);
const file = `${OUT}/feature-graphic.png`;
await page.screenshot({ path: file });
await close();
console.log("찍음:", file, "(1024×500)");
