/**
 * AAB 를 Play 내부 테스트 트랙에 올린다. — 미검증(앱 생성 + 서비스 계정 이후 첫 실행에서 확인)
 *
 *   PLAY_SERVICE_ACCOUNT_JSON=~/meogja-signing/play-sa.json \
 *   node scripts/play-upload.mjs twa/app-release-bundle.aab [트랙]
 *
 * 트랙 기본값 internal (내부 테스트). alpha·beta·production 도 받는다.
 *
 * ⚠️ 이 API 로는 **앱을 만들 수 없다.** androidpublisher v3 에 applications.insert 가
 *    없다. 그리고 새 앱은 **첫 AAB 를 Play Console 에서 직접 올려야** 그 뒤부터 API 가
 *    받는다. 그래서 최초 1회는 사람이 하고, 이 스크립트는 2번째 버전부터 쓴다.
 *
 * 의존성을 새로 깔지 않는다. 서비스 계정 JWT 는 node:crypto 로 직접 서명한다
 * (googleapis 는 Next.js 앱에 넣기엔 크고, 이 스크립트 하나에만 필요하다).
 */
import { createSign } from "node:crypto";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";

const PKG = "com.dalgonacrunch.meogja";
const API = "https://androidpublisher.googleapis.com";
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";

const aabPath = process.argv[2] || "twa/app-release-bundle.aab";
const track = process.argv[3] || "internal";

const saPath = (process.env.PLAY_SERVICE_ACCOUNT_JSON || "~/meogja-signing/play-sa.json")
  .replace(/^~/, homedir());

const die = (msg) => { console.error("✗", msg); process.exit(1); };

/** 서비스 계정 JSON → OAuth 액세스 토큰 */
async function getToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: sa.client_email, scope: SCOPE, aud: sa.token_uri,
    exp: now + 3600, iat: now,
  })}`;
  const sig = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url");

  const res = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${sig}`,
    }),
  });
  const body = await res.json();
  if (!res.ok) die(`토큰 발급 실패 (${res.status}): ${JSON.stringify(body)}`);
  return body.access_token;
}

/** 실패를 삼키지 않는다 — 응답 본문을 그대로 보여준다 */
async function call(token, path, { method = "GET", body, raw, contentType } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(contentType ? { "content-type": contentType } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: raw ?? (body ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  if (!res.ok) die(`${method} ${path} → ${res.status}\n${text}`);
  return text ? JSON.parse(text) : {};
}

const sa = JSON.parse(await readFile(saPath, "utf8").catch(() =>
  die(`서비스 계정 JSON 을 못 읽었다: ${saPath}\n` +
      `Play Console → 설정 → API 액세스 에서 서비스 계정을 만들고 JSON 키를 저 위치에 두거나 ` +
      `PLAY_SERVICE_ACCOUNT_JSON 으로 경로를 넘겨라.`)));

const aab = await readFile(aabPath).catch(() => die(`AAB 를 못 읽었다: ${aabPath}`));
console.log(`AAB ${(aab.length / 1024 / 1024).toFixed(2)}MB · 트랙 ${track} · ${PKG}`);

const token = await getToken(sa);
console.log("토큰 발급 ✓");

const edit = await call(token, `/androidpublisher/v3/applications/${PKG}/edits`, { method: "POST" });
console.log("edit 생성 ✓", edit.id);

const up = await fetch(
  `${API}/upload/androidpublisher/v3/applications/${PKG}/edits/${edit.id}/bundles?uploadType=media`,
  { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/octet-stream" }, body: aab },
);
const upBody = await up.text();
if (!up.ok) die(`AAB 업로드 실패 (${up.status})\n${upBody}`);
const { versionCode } = JSON.parse(upBody);
console.log("업로드 ✓ versionCode", versionCode);

await call(token, `/androidpublisher/v3/applications/${PKG}/edits/${edit.id}/tracks/${track}`, {
  method: "PUT",
  body: { track, releases: [{ versionCodes: [String(versionCode)], status: "completed" }] },
});
console.log(`트랙 ${track} 지정 ✓`);

await call(token, `/androidpublisher/v3/applications/${PKG}/edits/${edit.id}:commit`, { method: "POST" });
console.log(`커밋 ✓ — versionCode ${versionCode} 가 ${track} 트랙에 올라갔다`);
