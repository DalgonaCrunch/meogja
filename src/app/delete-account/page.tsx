import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "계정 삭제 요청 — 오늘 뭐 먹지?",
  description: "오늘 뭐 먹지?(meogja) 계정과 데이터 삭제를 요청하는 방법을 안내합니다.",
};

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@meogja.app";

const wrap: React.CSSProperties = {
  maxWidth: 640,
  margin: "0 auto",
  padding: "32px 20px 64px",
  fontFamily: "var(--font-body)",
  color: "var(--text)",
  lineHeight: 1.8,
};

const h2: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 20,
  marginBottom: 12,
};

const card: React.CSSProperties = {
  background: "var(--card)",
  border: "var(--card-border)",
  borderRadius: "var(--card-radius)",
  boxShadow: "var(--card-shadow)",
  padding: "20px 18px",
  marginBottom: 14,
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 13,
  color: "var(--text-2)",
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 14,
  borderBottom: "1px solid var(--border)",
  verticalAlign: "top",
};

export default function DeleteAccountPage() {
  return (
    <div style={wrap}>
      <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 6 }}>
        오늘 뭐 먹지? (meogja) · 개발자 DalgonaCrunch
      </p>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, marginBottom: 8 }}>
        계정 삭제 요청
      </h1>
      <p style={{ fontSize: 14, color: "var(--text-2)", marginBottom: 32 }}>
        계정과 저장된 데이터를 삭제하는 방법입니다. 아래 두 가지 중 편한 쪽을 쓰세요.
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={h2}>방법 1. 앱에서 직접 (가장 빠름)</h2>
        <div style={card}>
          <ol style={{ paddingLeft: 20, margin: 0 }}>
            <li>오늘 뭐 먹지? 앱 또는 웹에서 로그인합니다.</li>
            <li>하단 메뉴에서 <strong>내 정보</strong>를 엽니다.</li>
            <li>화면 맨 아래 <strong>회원 탈퇴</strong>를 누릅니다.</li>
            <li>확인창에서 <strong>탈퇴</strong>를 누르면 즉시 처리됩니다.</li>
          </ol>
          <div style={{ marginTop: 16 }}>
            <Link
              href="/profile"
              style={{
                display: "inline-block",
                padding: "10px 18px",
                borderRadius: 999,
                background: "var(--primary)",
                color: "#fff",
                fontSize: 14,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              내 정보 열기
            </Link>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={h2}>방법 2. 이메일로 요청 (로그인이 안 될 때)</h2>
        <div style={card}>
          <p style={{ margin: "0 0 12px" }}>
            아래 주소로 <strong>가입에 사용한 이메일 주소 또는 닉네임</strong>과 함께
            &ldquo;계정 삭제 요청&rdquo;이라고 보내주세요.
          </p>
          <p style={{ margin: 0 }}>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("[meogja] 계정 삭제 요청")}`}
              style={{ color: "var(--primary)", fontWeight: 700, fontSize: 16 }}
            >
              {SUPPORT_EMAIL}
            </a>
          </p>
          <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--text-2)" }}>
            본인 확인 후 담당자가 직접 처리하고 회신드립니다.
            이 경로로 요청하시면 아래 &lsquo;보관되는 데이터&rsquo;까지 함께 삭제됩니다.
          </p>
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={h2}>삭제되는 데이터</h2>
        <p style={{ fontSize: 14, color: "var(--text-2)", marginTop: 0 }}>
          탈퇴 즉시 아래 항목이 서버에서 삭제됩니다.
        </p>
        <div style={{ ...card, padding: 0, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 380 }}>
            <thead>
              <tr>
                <th style={th}>데이터</th>
                <th style={th}>처리</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={td}>내가 만든 모임과 그 안의 투표·추천 기록</td>
                <td style={td}>즉시 삭제</td>
              </tr>
              <tr>
                <td style={td}>참여 중인 모임의 멤버십</td>
                <td style={td}>즉시 삭제</td>
              </tr>
              <tr>
                <td style={td}>음식 선호도 정보</td>
                <td style={td}>즉시 삭제</td>
              </tr>
              <tr>
                <td style={td}>푸시 알림 구독 정보</td>
                <td style={td}>즉시 삭제</td>
              </tr>
              <tr>
                <td style={td}>프로필 이미지</td>
                <td style={td}>즉시 삭제</td>
              </tr>
              <tr>
                <td style={{ ...td, borderBottom: "none" }}>브라우저에 저장된 설정(localStorage)</td>
                <td style={{ ...td, borderBottom: "none" }}>기기에서 직접 삭제 가능</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={h2}>보관되는 데이터와 기간</h2>
        <div style={card}>
          <p style={{ margin: "0 0 10px" }}>
            앱에서 탈퇴하면 계정은 <strong>비활성화</strong>되고, 다른 참여자에게는
            &lsquo;탈퇴한 사용자&rsquo;로 표시됩니다. 이때 아래 항목은 남습니다.
          </p>
          <ul style={{ paddingLeft: 20, margin: "0 0 12px" }}>
            <li>
              <strong>닉네임</strong> — 내가 참여했던 다른 사람의 모임 기록이 깨지지 않도록 남깁니다.
            </li>
            <li>
              <strong>탈퇴 처리 기록</strong>(탈퇴 일시) — 재가입 오남용을 막기 위해 남깁니다.
            </li>
            <li>
              <strong>로그인 계정 식별정보</strong>(소셜 로그인에 쓰인 이메일 주소) — 같은 주소로
              다시 가입할 때 기록이 충돌하지 않도록 남깁니다.
            </li>
          </ul>
          <p style={{ margin: "0 0 10px" }}>
            위 항목은 <strong>삭제 요청을 받을 때까지</strong> 보관하며, 요청이 오면 파기합니다.
            관련 법령에서 보관을 요구하는 경우 그 기간을 따릅니다.
          </p>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-2)" }}>
            이 항목까지 <strong>즉시 완전 삭제</strong>를 원하시면 위 &lsquo;방법 2&rsquo;로 요청해 주세요.
          </p>
        </div>
      </section>

      <p style={{ fontSize: 12, color: "var(--text-2)", borderTop: "1px solid var(--border)", paddingTop: 20 }}>
        개인정보 처리 전반에 대한 안내는{" "}
        <Link href="/privacy" style={{ color: "var(--primary)" }}>
          개인정보처리방침
        </Link>
        에서 확인할 수 있습니다.
        <br />
        최종 업데이트: 2026년 9월 5일
      </p>
    </div>
  );
}
