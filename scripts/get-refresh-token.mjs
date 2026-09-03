/**
 * 구글 refresh token 1회 발급 스크립트 (로컬 실행).
 * 사용법:
 *   node scripts/get-refresh-token.mjs <CLIENT_ID> <CLIENT_SECRET>
 * → 브라우저가 열리면 **한양 계정(rladkxh1004@hanyang.ac.kr)** 으로 로그인·허용.
 *   (한양 계정이 attoyd 캘린더 수정 권한을 이미 갖고 있어서 하나로 둘 다 커버)
 * → 터미널에 찍힌 refresh_token을 `npx wrangler secret put GOOGLE_REFRESH_TOKEN`에 붙여넣기.
 */
import http from "node:http";
import { exec } from "node:child_process";

const [id, secret] = process.argv.slice(2);
if (!id || !secret) { console.error("사용법: node scripts/get-refresh-token.mjs <CLIENT_ID> <CLIENT_SECRET>"); process.exit(1); }

const PORT = 53682;
const redirect = `http://127.0.0.1:${PORT}/cb`;
const scope = "https://www.googleapis.com/auth/calendar";
const authUrl = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
  client_id: id, redirect_uri: redirect, response_type: "code",
  scope, access_type: "offline", prompt: "consent",
});

http.createServer(async (req, res) => {
  const u = new URL(req.url, redirect);
  if (u.pathname !== "/cb") { res.end(); return; }
  const code = u.searchParams.get("code");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri: redirect, grant_type: "authorization_code" }),
  });
  const j = await r.json();
  res.end("완료 — 터미널을 보세요. 이 창은 닫아도 됩니다.");
  console.log("\n=== GOOGLE_REFRESH_TOKEN ===\n" + (j.refresh_token ?? "(없음 — 응답: " + JSON.stringify(j) + ")"));
  process.exit(0);
}).listen(PORT, () => {
  console.log("브라우저에서 한양 계정으로 로그인하세요...");
  exec(`start "" "${authUrl.replaceAll("&", "^&")}"`); // Windows
  console.log("자동으로 안 열리면 직접 열기:\n" + authUrl);
});
