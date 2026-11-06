// 앱 안 브라우저(카카오톡·네이버·인스타 등)에서 진짜 브라우저로 열기.
// 카카오톡은 intent:// 를 막거나 무시하는 경우가 많아서, 카톡 전용 주소(kakaotalk://web/openExternal)로
// 폰의 기본 브라우저(크롬·삼성인터넷·사파리)를 연다. 안드로이드의 다른 앱은 크롬 intent, 안 되면 같은 주소로 fallback.
// 처리했으면 true, 아이폰의 일반 인앱(카톡 아님)처럼 직접 열 수 없으면 false → 호출한 쪽에서 링크 복사/공유 안내.
export function openInExternalBrowser(url: string = window.location.href): boolean {
  const ua = navigator.userAgent;
  if (/KAKAOTALK/i.test(ua)) {
    window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
    return true;
  }
  if (/Android/i.test(ua)) {
    const u = url.replace(/^https?:\/\//, "");
    window.location.href = `intent://${u}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
    return true;
  }
  return false;
}
