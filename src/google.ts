/** 구글 캘린더 클라이언트 — refresh token으로 access token 갱신 후 REST 호출.
 *  주의(실측): 종일 이벤트 날짜는 date 필드 사용, dateTime에 +09:00 주면 하루 밀림. */

export interface Env {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REFRESH_TOKEN: string;
  NOTION_TOKEN: string;
}

let cached: { token: string; exp: number } | null = null;

export async function accessToken(env: Env): Promise<string> {
  if (cached && Date.now() < cached.exp - 60_000) return cached.token;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: env.GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  if (!r.ok) throw new Error("token refresh 실패: " + (await r.text()));
  const j = (await r.json()) as { access_token: string; expires_in: number };
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return cached.token;
}

const BASE = "https://www.googleapis.com/calendar/v3";

export async function listEvents(env: Env, calId: string, updatedMinISO?: string) {
  const tok = await accessToken(env);
  const q = new URLSearchParams({
    maxResults: "250", singleEvents: "false", showDeleted: "false",
  });
  if (updatedMinISO) q.set("updatedMin", updatedMinISO);
  const r = await fetch(`${BASE}/calendars/${encodeURIComponent(calId)}/events?${q}`, {
    headers: { Authorization: `Bearer ${tok}` },
  });
  if (!r.ok) throw new Error(`listEvents ${calId}: ${await r.text()}`);
  return ((await r.json()) as { items?: any[] }).items ?? [];
}

/** 색만 칠한다 — P0의 유일한 자동 쓰기. 시각·삭제·생성은 승인 큐로만. */
export async function setColor(env: Env, calId: string, eventId: string, colorId: string) {
  const tok = await accessToken(env);
  const r = await fetch(
    `${BASE}/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify({ colorId }),
    },
  );
  if (!r.ok) throw new Error(`setColor: ${await r.text()}`);
}
