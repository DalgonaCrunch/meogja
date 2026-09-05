export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px", fontFamily: "var(--font-body)", color: "var(--text)", lineHeight: 1.8 }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, marginBottom: 8 }}>개인정보처리방침</h1>
      <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 32 }}>최종 업데이트: 2026년 9월 5일</p>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, marginBottom: 12 }}>1. 수집하는 개인정보</h2>
        <p>meogja(오늘 뭐 먹지?)는 서비스 제공을 위해 아래 정보를 수집합니다.</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li>소셜 로그인 시: 이름, 이메일 주소 (Google/Naver/Kakao OAuth 제공)</li>
          <li>게스트 이용 시: 직접 입력한 닉네임</li>
          <li>서비스 이용 중: 음식 선호도 정보, 모임 참여 기록</li>
          <li>문의 시: 이메일 주소 (선택)</li>
        </ul>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, marginBottom: 12 }}>2. 수집 목적</h2>
        <ul style={{ paddingLeft: 20 }}>
          <li>모임 기반 메뉴 추천 서비스 제공</li>
          <li>회원 식별 및 서비스 접근 관리</li>
          <li>문의 답변 및 서비스 개선</li>
        </ul>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, marginBottom: 12 }}>3. 보관 기간</h2>
        <p>회원 탈퇴 시 모임·투표 기록, 음식 선호도, 푸시 구독 정보, 프로필 이미지는 즉시 삭제합니다.</p>
        <p style={{ marginTop: 8 }}>다만 다른 참여자의 모임 기록이 깨지지 않도록 <strong>닉네임, 탈퇴 처리 기록, 소셜 로그인에 쓰인 이메일 주소는 계속 보관</strong>합니다. 이 항목까지 삭제를 원하시면 <a href="/delete-account" style={{ color: "var(--primary)" }}>계정 삭제 요청</a> 페이지의 이메일 경로로 요청해 주세요.</p>
        <p style={{ marginTop: 8 }}>관련 법령에서 더 긴 보관을 요구하는 경우 해당 기간 동안 보관합니다.</p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, marginBottom: 12 }}>4. 제3자 제공</h2>
        <p>수집한 개인정보는 원칙적으로 외부에 제공하지 않습니다. 단, 아래 서비스를 통해 처리됩니다.</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li>Supabase (데이터베이스 저장, 미국)</li>
          <li>Vercel (서비스 호스팅, 미국)</li>
          <li>Google OAuth / Naver OAuth / Kakao OAuth (소셜 로그인)</li>
          <li>Naver / Kakao 지역 검색 API (맛집 검색)</li>
        </ul>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, marginBottom: 12 }}>5. 이용자 권리</h2>
        <p>이용자는 언제든지 자신의 개인정보를 조회, 수정, 삭제할 수 있습니다. 서비스 내 프로필 페이지에서 계정 정보를 관리하거나, 아래 연락처로 요청할 수 있습니다.</p>
        <p style={{ marginTop: 8 }}>계정 삭제 절차는 <a href="/delete-account" style={{ color: "var(--primary)" }}>계정 삭제 요청</a> 페이지에 자세히 안내되어 있습니다.</p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, marginBottom: 12 }}>6. 쿠키 및 유사 기술</h2>
        <p>서비스 이용 편의를 위해 브라우저 localStorage를 사용합니다. 이는 서비스 기능 제공 목적으로만 사용됩니다.</p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, marginBottom: 12 }}>7. 문의</h2>
        <p>개인정보 관련 문의는 <a href="mailto:doublesweeet@gmail.com" style={{ color: "var(--primary)" }}>doublesweeet@gmail.com</a> 으로 보내주세요.</p>
        <p style={{ marginTop: 8 }}>서비스 URL: <a href="https://meogja.vercel.app" style={{ color: "var(--primary)" }}>https://meogja.vercel.app</a></p>
      </section>

      <p style={{ fontSize: 12, color: "var(--text-2)", borderTop: "1px solid var(--border)", paddingTop: 20, marginTop: 20 }}>
        본 방침은 서비스 변경에 따라 업데이트될 수 있으며, 변경 시 서비스 내 공지합니다.
      </p>
    </div>
  );
}
