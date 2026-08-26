import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { getFoodIconUrl } from '@/lib/foodIcons';

export const runtime = 'edge';

/* 미리보기 이미지는 우리 서비스의 첫인상이다. 카톡·메신저에서 링크를 받은 사람이
   보는 건 앱이 아니라 **이 그림 한 장**이다.

   🔴 이모지를 그리지 마라. 이 렌더러(satori)에는 색 이모지 글꼴이 없어서 🍽️ 같은
   문자가 **흐릿한 회색 덩어리**로 나온다(실물에서 그렇게 나왔다). 대신 우리가 가진
   음식 그림 PNG 140장을 쓴다 — 어차피 그게 더 예쁘다.
   🔴 흰 글씨를 옅은 주황 위에 놓지 마라. 대비가 낮아 글씨가 날아간다. 흰 카드를
   깔고 그 위에 진한 글씨를 얹는다. */

const BASE_URL = 'https://meogja.vercel.app';

/** 종류별로 쓸 그림 (없으면 마스코트) */
const FALLBACK_IMG: Record<string, string> = {
  battle: '/mascot/tabs/ranking.png',
  vote: '/mascot/tabs/community.png',
  worldcup: '/mascot/tabs/ranking.png',
  group: '/mascot/tabs/community.png',
  result: '/mascot/tabs/food.png',
  default: '/mascot/tabs/food.png',
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const type = searchParams.get('type') || 'default';
  const title = (searchParams.get('title') || '').slice(0, 40);
  // result: 정해진 메뉴가 title, 모임 이름이나 고른 사람들이 sub 로 온다
  const sub = (searchParams.get('sub') || '').slice(0, 60);

  const headline =
    type === 'result' ? (title ? `오늘 메뉴는 ${title}!` : '오늘 메뉴 정했어요!')
    : type === 'group' ? (title || '오늘 뭐 먹을지 같이 정해요!')
    : type === 'battle' ? '오늘의 메뉴 배틀 결과'
    : type === 'vote' ? '투표 결과 나왔어요'
    : type === 'worldcup' ? '내 최애 메뉴는?'
    : '오늘 뭐 먹지?';

  const subLine =
    type === 'result'
      ? (sub ? `${sub} 취향으로 정했어요` : '취향을 모아 정했어요')
      : type === 'group' ? '같이 뭐 먹을지 정해봐요'
      : '먹자냥이 정해줄게요';

  /* 메뉴 이름이 우리 그림 사전에 있으면 그 그림을 쓴다(티라미수·초밥 …).
     없으면 종류별 마스코트로 떨어진다. */
  const iconPath = (type === 'result' && title ? getFoodIconUrl(title) : null)
    ?? FALLBACK_IMG[type] ?? FALLBACK_IMG.default;
  const imgUrl = `${BASE_URL}${iconPath}`;

  // 글자가 길면 줄여서 한 줄에 담는다(두 줄이 되면 카드가 무너진다)
  const headlineSize = headline.length > 22 ? 54 : headline.length > 16 ? 62 : 72;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #FF7A45 0%, #FF4E88 100%)',
          fontFamily: 'sans-serif',
          padding: 48,
        }}
      >
        {/* 흰 카드 — 글씨 대비를 확보하고, 음식 그림을 돋보이게 한다 */}
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 48,
            background: '#FFFDFB',
            display: 'flex',
            alignItems: 'center',
            gap: 44,
            padding: '48px 56px',
            boxShadow: '0 24px 60px rgba(0,0,0,0.18)',
          }}
        >
          {/* 음식 그림 */}
          <div
            style={{
              width: 300,
              height: 300,
              borderRadius: 40,
              background: '#FFF1EA',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgUrl} alt="" width={236} height={236} style={{ objectFit: 'contain' }} />
          </div>

          {/* 글자 */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: headlineSize,
                fontWeight: 800,
                color: '#2A1A14',
                lineHeight: 1.15,
                letterSpacing: '-0.02em',
              }}
            >
              {headline}
            </div>
            <div style={{ fontSize: 32, color: '#8A6A5C', marginTop: 18, fontWeight: 500 }}>
              {subLine}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 34 }}>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 800,
                  color: '#FF5A2D',
                  padding: '10px 20px',
                  borderRadius: 999,
                  background: '#FFEDE5',
                }}
              >
                먹자냥
              </div>
              <div style={{ fontSize: 24, color: '#A48B80', fontWeight: 600 }}>
                친구들과 메뉴 정하기
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
