import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { getFoodIconUrl } from '@/lib/foodIcons';

export const runtime = 'edge';

/* 미리보기 이미지 = 우리 서비스의 첫인상. 링크를 받은 사람이 보는 건 앱이 아니라 이 한 장이다.
 *
 * 여기까지 오며 알게 된 것:
 * 🔴 **이모지를 그리지 마라.** 이 렌더러(satori)에는 색 이모지 글꼴이 없어서 🍽️ 가 흐릿한
 *    회색 덩어리로 나온다(실물 확인). 우리가 가진 음식 그림 PNG 를 쓴다.
 * 🔴 **글꼴을 넘겨야 한다.** 안 넘기면 기본 글꼴로 그려져 한글이 얇고 심심하다.
 *    Noto Sans KR 을 **필요한 글자만** 받아서 쓴다(Google Fonts 는 `text=` 로 부분집합을 준다.
 *    오래된 UA 로 요청하면 woff2 대신 **ttf** 를 주는데 satori 는 ttf 를 받는다).
 * 🔴 옅은 배경에 흰 글씨는 대비가 낮아 날아간다.
 */

const BASE_URL = 'https://meogja.vercel.app';

const FALLBACK_IMG: Record<string, string> = {
  battle: '/mascot/tabs/ranking.png',
  vote: '/mascot/tabs/community.png',
  worldcup: '/mascot/tabs/ranking.png',
  group: '/mascot/tabs/community.png',
  result: '/mascot/tabs/food.png',
  default: '/mascot/tabs/food.png',
};

/** 결과 카드에 함께 넣는 먹자냥 */
const MASCOT = '/mascot/avatars/cat-31.png';

/** 필요한 글자만 담은 글꼴을 받아 온다(전체 한글 글꼴은 수 MB 라 못 쓴다) */
async function loadFont(text: string, weight: 500 | 800): Promise<ArrayBuffer | null> {
  try {
    const uniq = Array.from(new Set(text.split(''))).join('');
    const cssUrl = `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@${weight}`
      + `&text=${encodeURIComponent(uniq)}`;
    // 오래된 UA → ttf 를 준다(기본 UA 는 woff2 를 주는데 satori 가 못 읽는다)
    const css = await fetch(cssUrl, { headers: { 'User-Agent': 'Mozilla/4.0' } }).then(r => r.text());
    const url = css.match(/src:\s*url\(([^)]+)\)/)?.[1];
    if (!url) return null;
    return await fetch(url).then(r => r.arrayBuffer());
  } catch {
    return null; // 글꼴을 못 받아도 그림은 나와야 한다
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const type = searchParams.get('type') || 'default';
  const title = (searchParams.get('title') || '').slice(0, 40);
  const sub = (searchParams.get('sub') || '').slice(0, 60);

  const headline =
    type === 'result' ? (title || '오늘 메뉴') :
    type === 'group' ? (title || '같이 정해요') :
    type === 'battle' ? '메뉴 배틀 결과' :
    type === 'vote' ? '투표 결과' :
    type === 'worldcup' ? '내 최애 메뉴' :
    '오늘 뭐 먹지?';

  /* 윗줄(kicker): 모임이 정한 것이면 누가 정했는지, 혼자 랜덤으로 뽑은 것이면 권하는 말투.
     "오늘은 ○○ 어때요?" 를 한 줄로 다 쓰면 메뉴가 작아지므로, 권하는 말은 위에 두고
     메뉴 이름은 크게 남긴다. */
  const kicker =
    type === 'result' ? (sub ? `${sub}의 선택` : '오늘은 이거 어때요?') :
    type === 'group' ? '먹자냥 모임' : '먹자냥';

  const footer =
    type === 'result' ? '먹자냥이 취향을 모아 정했어요' : '친구들과 메뉴 정하기 · 먹자냥';

  const iconPath = (type === 'result' && title ? getFoodIconUrl(title) : null)
    ?? FALLBACK_IMG[type] ?? FALLBACK_IMG.default;
  const foodImg = `${BASE_URL}${iconPath}`;
  const mascotImg = `${BASE_URL}${MASCOT}`;

  const allText = headline + kicker + footer + '먹자냥오늘 뭐 먹지?';
  const [bold, regular] = await Promise.all([loadFont(allText, 800), loadFont(allText, 500)]);
  const fonts = [
    ...(bold ? [{ name: 'NotoKR', data: bold, weight: 800 as const, style: 'normal' as const }] : []),
    ...(regular ? [{ name: 'NotoKR', data: regular, weight: 500 as const, style: 'normal' as const }] : []),
  ];
  const font = fonts.length ? 'NotoKR' : 'sans-serif';

  const headlineSize = headline.length > 14 ? 76 : headline.length > 9 ? 92 : 108;

  /* ── 결과 카드: 먹자냥 말풍선 ─────────────────────────────────────
     채팅처럼 왼쪽 아래에 꼬리를 달아 먹자냥이 말하는 것으로 보이게 한다.
     🔴 satori 에서 삼각형은 border 트릭이 잘 안 먹는다 → **정사각형을 45도 돌려** 쓴다. */
  const card = (
    <div style={{
      width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 26, fontFamily: font, background: 'linear-gradient(150deg,#FFE9DC 0%,#FFD3E4 100%)', padding: 52,
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={mascotImg} alt="" width={268} height={268} style={{ objectFit: 'contain', flexShrink: 0 }} />

      <div style={{ position: 'relative', display: 'flex', flex: 1, minWidth: 0 }}>
        {/* 말풍선 꼬리 — 왼쪽 아래에서 먹자냥을 향한다 */}
        <div style={{
          position: 'absolute', left: -38, bottom: 56, width: 68, height: 68,
          background: '#fff', transform: 'rotate(45deg)', borderRadius: 6,
        }} />
        <div style={{
          display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 40,
          padding: '36px 42px', boxShadow: '0 20px 50px rgba(0,0,0,.14)', flex: 1, minWidth: 0,
        }}>
          <div style={{ fontSize: 27, fontWeight: 800, color: '#FF5A2D' }}>{kicker}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={foodImg} alt="" width={156} height={156} style={{ objectFit: 'contain', flexShrink: 0 }} />
            <div style={{
              fontSize: headline.length > 9 ? 62 : headline.length > 5 ? 74 : 86,
              fontWeight: 800, color: '#2A1A14', letterSpacing: '-0.03em',
            }}>{headline}</div>
          </div>
          <div style={{ fontSize: 26, color: '#8A6A5C', marginTop: 16, fontWeight: 500 }}>{footer}</div>
        </div>
      </div>
    </div>
  );

  /* 가로를 조금 줄였다(1200 → 1080). 카톡·메신저 미리보기에서 너무 납작해 보이지 않는다. */
  return new ImageResponse(card, { width: 1080, height: 630, fonts: fonts.length ? fonts : undefined });
}
