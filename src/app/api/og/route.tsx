import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const type = searchParams.get('type') || 'default';
  const title = searchParams.get('title') || '';
  // result: 정해진 메뉴가 title, 모임 이름이나 고른 사람들이 sub 로 온다
  const sub = searchParams.get('sub') || '';

  const emojiMap: Record<string, string> = {
    battle: '⚔️',
    vote: '🗳️',
    group: '🍽️',
    worldcup: '🏆',
    result: '🍽️',
    default: '😋',
  };

  const teaserMap: Record<string, string> = {
    battle: '오늘의 배틀 결과는?',
    vote: '투표 결과는?',
    worldcup: '나의 최애 메뉴는?',
    group: title || '오늘 뭐 먹을지 같이 정해요!',
    result: title ? `오늘 메뉴는 ${title}!` : '오늘 메뉴 정했어요!',
    default: '오늘 뭐 먹지?',
  };

  const displayTitle = type === 'group' && title ? title : teaserMap[type] || teaserMap.default;
  /* 결과 카드는 "누가 골랐나" 를 아래에 적는다 — 받는 사람이 눌러보는 이유가 거기서 나온다 */
  const subLine = type === 'result'
    ? (sub ? `${sub} 취향으로 정했어요 →` : '취향을 모아 정했어요 →')
    : type === 'group' && title ? '같이 뭐 먹을지 정해봐요 →' : 'meogja에서 확인해봐요 →';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #FF7A45 0%, #FFAB76 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 96, marginBottom: 16 }}>{emojiMap[type] || emojiMap.default}</div>
        <div
          style={{
            fontSize: title && title.length > 20 ? 44 : 52,
            color: '#fff',
            fontWeight: 800,
            textAlign: 'center',
            padding: '0 60px',
            lineHeight: 1.2,
            maxWidth: 1000,
          }}
        >
          {displayTitle}
        </div>
        <div
          style={{
            fontSize: 28,
            color: 'rgba(255,255,255,0.85)',
            marginTop: 20,
            fontWeight: 500,
          }}
        >
          {subLine}
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 36,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              fontSize: 22,
              color: 'rgba(255,255,255,0.7)',
              fontWeight: 600,
              letterSpacing: '0.04em',
            }}
          >
            meogja — 오늘 뭐 먹지?
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
