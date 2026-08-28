/**
 * 확인 스크립트 공용 브라우저 런처.
 *
 * owner 지적: "playwright 로 테스트하고 나면 그 창은 닫아줘. 계속 남아있어.
 *              여기서 띄운 창만 닫히게 해. 생성 위치도 구석에 만들어 안 보이게."
 *
 * 그래서 이 헬퍼가 세 가지를 보장한다.
 *  1) 기본 headless — 창이 아예 뜨지 않는다
 *  2) HEADED=1 로 눈으로 볼 때도 화면 밖(-4000,-4000)에 띄운다
 *  3) 스크립트가 중간에 던져도(assert 실패·예외·Ctrl+C) 이 브라우저만 닫는다.
 *     ⚠️ 우리가 launch() 한 인스턴스만 닫는다. 사용자가 열어 둔 브라우저는 건드리지 않는다.
 */
import { chromium } from "playwright";

const HEADED = process.env.HEADED === "1";

export async function launchBrowser(opts = {}) {
  const browser = await chromium.launch({
    headless: !HEADED,
    // 화면 밖 구석에 띄운다 (headless 면 의미 없지만 HEADED=1 일 때 안 보이게)
    args: HEADED ? ["--window-position=-4000,-4000", "--window-size=420,900"] : [],
    ...opts,
  });

  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    await browser.close().catch(() => {});
  };

  // 정상 종료·예외·시그널 어디로 빠져도 이 브라우저는 닫는다
  process.once("exit", () => { if (!closed) { closed = true; browser.close().catch(() => {}); } });
  for (const sig of ["SIGINT", "SIGTERM"]) {
    process.once(sig, async () => { await close(); process.exit(130); });
  }
  process.once("uncaughtException", async (err) => { await close(); console.error(err); process.exit(1); });
  process.once("unhandledRejection", async (err) => { await close(); console.error(err); process.exit(1); });

  return { browser, close };
}

/** 검사 결과를 찍고 브라우저를 닫은 뒤 종료 코드를 맞춘다 */
export async function finish(close, problems, okMessage) {
  await close();
  if (problems.length) {
    console.error("\n❌ 문제\n" + problems.map((p) => " - " + p).join("\n"));
    process.exit(1);
  }
  console.log("\n" + okMessage);
}
