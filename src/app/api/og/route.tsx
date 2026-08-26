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
 *
 * `v` 로 시안을 고를 수 있다(a~d). 고르고 나면 안 쓰는 것은 지운다.
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
  const variant = (searchParams.get('v') || 'a').toLowerCase();

  const headline =
    type === 'result' ? (title || '오늘 메뉴') :
    type === 'group' ? (title || '같이 정해요') :
    type === 'battle' ? '메뉴 배틀 결과' :
    type === 'vote' ? '투표 결과' :
    type === 'worldcup' ? '내 최애 메뉴' :
    '오늘 뭐 먹지?';

  const kicker =
    type === 'result' ? (sub ? `${sub}의 선택` : '오늘의 선택') :
    type === 'group' ? '먹자냥 모임' : '먹자냥';

  const footer =
    type === 'result' ? '취향을 모아 정했어요 · 먹자냥' : '친구들과 메뉴 정하기 · 먹자냥';

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

  /* ── 시안 A: 큰 그림 + 큰 글씨 (밝고 단순) ───────────────────────── */
  const A = (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', fontFamily: font,
      background: 'linear-gradient(160deg,#FFF3EC 0%,#FFE3D5 55%,#FFD1C2 100%)',
      position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <div style={{ fontSize: 30, fontWeight: 800, color: '#FF5A2D' }}>{kicker}</div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={foodImg} alt="" width={300} height={300} style={{ objectFit: 'contain', margin: '4px 0 6px' }} />
      <div style={{ fontSize: headlineSize, fontWeight: 800, color: '#2A1A14', letterSpacing: '-0.03em' }}>
        {headline}
      </div>
      <div style={{ fontSize: 30, fontWeight: 500, color: '#8A6A5C', marginTop: 14 }}>{footer}</div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={mascotImg} alt="" width={150} height={150}
        style={{ position: 'absolute', right: 46, bottom: 30, objectFit: 'contain' }} />
    </div>
  );

  /* ── 시안 B: 폴라로이드 (기울어진 사진 카드) ─────────────────────── */
  /* 🔴 겹침 주의: 아래 문구를 absolute 로 띄웠다가 사진 캡션과 겹쳤다(실물 확인).
     세로로 쌓아서 겹칠 수 없게 만든다. */
  const B = (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 22,
      fontFamily: font, background: 'linear-gradient(135deg,#FF7A45 0%,#FF4E88 100%)',
    }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        background: '#fff', padding: '24px 24px 18px', borderRadius: 12,
        transform: 'rotate(-3deg)', boxShadow: '0 26px 60px rgba(0,0,0,.3)',
      }}>
        <div style={{
          width: 400, height: 268, background: '#FFF1EA', borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={foodImg} alt="" width={236} height={236} style={{ objectFit: 'contain' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
          <div style={{ fontSize: 58, fontWeight: 800, color: '#2A1A14', letterSpacing: '-0.03em' }}>{headline}</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mascotImg} alt="" width={72} height={72} style={{ objectFit: 'contain' }} />
        </div>
        <div style={{ fontSize: 22, color: '#9A7A6C', marginTop: 2, fontWeight: 500 }}>{kicker}</div>
      </div>
      <div style={{
        fontSize: 26, fontWeight: 800, color: '#fff',
        background: 'rgba(0,0,0,.18)', padding: '10px 22px', borderRadius: 999,
      }}>{footer}</div>
    </div>
  );

  /* ── 시안 C: 어두운 스포트라이트 (또렷하고 세련) ─────────────────── */
  const C = (
    <div style={{
      width: '100%', height: '100%', display: 'flex', alignItems: 'center', gap: 56,
      padding: '0 84px', fontFamily: font,
      background: 'radial-gradient(1000px 620px at 22% 40%, #3A2419 0%, #1B1310 70%)',
    }}>
      <div style={{
        width: 350, height: 350, borderRadius: 999, flexShrink: 0,
        background: 'radial-gradient(circle at 50% 45%, #FFD9C6 0%, #FFB08C 62%, rgba(255,138,92,0) 72%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={foodImg} alt="" width={250} height={250} style={{ objectFit: 'contain' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#FF8A5C', letterSpacing: '0.02em' }}>{kicker}</div>
        <div style={{ fontSize: headlineSize, fontWeight: 800, color: '#FFF8F4', marginTop: 10, letterSpacing: '-0.03em' }}>
          {headline}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 26 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mascotImg} alt="" width={78} height={78} style={{ objectFit: 'contain' }} />
          <div style={{ fontSize: 27, color: '#C9AFA2', fontWeight: 500 }}>{footer}</div>
        </div>
      </div>
    </div>
  );

  /* ── 시안 D: 먹자냥 말풍선 (캐릭터가 말하는 형태) ────────────────── */
  const D = (
    <div style={{
      width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 30, fontFamily: font, background: 'linear-gradient(150deg,#FFE9DC 0%,#FFD3E4 100%)', padding: 60,
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={mascotImg} alt="" width={300} height={300} style={{ objectFit: 'contain', flexShrink: 0 }} />
      <div style={{
        display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 44,
        padding: '40px 46px', boxShadow: '0 20px 50px rgba(0,0,0,.14)', flex: 1, minWidth: 0,
      }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#FF5A2D' }}>{kicker}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginTop: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={foodImg} alt="" width={170} height={170} style={{ objectFit: 'contain', flexShrink: 0 }} />
          <div style={{ fontSize: headline.length > 9 ? 70 : 84, fontWeight: 800, color: '#2A1A14', letterSpacing: '-0.03em' }}>
            {headline}
          </div>
        </div>
        <div style={{ fontSize: 27, color: '#8A6A5C', marginTop: 18, fontWeight: 500 }}>{footer}</div>
      </div>
    </div>
  );

  const picked = variant === 'b' ? B : variant === 'c' ? C : variant === 'd' ? D : A;

  return new ImageResponse(picked, { width: 1200, height: 630, fonts: fonts.length ? fonts : undefined });
}
