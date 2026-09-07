/** AliVEWEEK P0 — 심장. 5분마다: 변경분 가져오기 → 분류 → 색 자동/승인 큐 → 노션 로그. */
import { classify, titleTimeHint, CAL } from "./rules";
import { listEvents, setColor, type Env } from "./google";
import { writeLog } from "./notion";
import { renderWeek } from "./week";

export default {
  /** 상태 확인 + 주차별 일정표 뷰 */
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/health") {
      const c = await env.DB.prepare("SELECT v FROM kv WHERE k='lastSync'").first<{ v: string }>();
      return Response.json({ ok: true, service: "AliVEWEEK", lastSync: c?.v ?? null });
    }
    if (url.pathname === "/" || url.pathname === "/week") {
      const html = await renderWeek(env, url.searchParams.get("start") ?? undefined);
      return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
    }
    // TODO(P2): POST /attendance — 학습앱 출결 웹훅 수신 (GAS 은퇴)
    return new Response("Not found", { status: 404 });
  },

  async scheduled(_ev: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(sync(env));
  },
};

async function sync(env: Env) {
  const last = await env.DB.prepare("SELECT v FROM kv WHERE k='lastSync'").first<{ v: string }>();
  const since = last?.v ?? new Date(Date.now() - 3600_000).toISOString();
  const now = new Date().toISOString();

  for (const calId of [CAL.attoyd, CAL.hanyang]) {
    const events = await listEvents(env, calId, since);
    for (const ev of events) {
      if (ev.status === "cancelled" || ev.recurringEventId) continue; // 인스턴스는 마스터에서 처리
      const seen = await env.DB.prepare("SELECT etag FROM snap WHERE id=?").bind(ev.id).first<{ etag: string }>();
      if (seen?.etag === ev.etag) continue; // 변화 없음

      const calName = calId === CAL.attoyd ? "attoyd" : "한양";
      const when = ev.start?.dateTime
        ? { start: ev.start.dateTime, end: ev.end?.dateTime, datetime: true }
        : ev.start?.date ? { start: ev.start.date } : undefined;

      // 색이 이미 있으면 존중 (아토가 칠한 것) — 무색만 판정
      if (!ev.colorId) {
        const v = classify(ev.summary ?? "", calId);
        if (v.kind === "auto") {
          await setColor(env, calId, ev.id, v.color);
          await writeLog(env, {
            이벤트명: ev.summary ?? "(제목 없음)", 일시: when, 캘린더: calName,
            이벤트ID: ev.id, 액션: "색부여", 변경: `무색 → ${v.color} (${v.why})`,
            신뢰도: "확실", 승인: true,
          });
          // 라우팅 불일치(다른 캘린더로 가야 함)는 이동=생성+삭제라 승인 큐
          if (v.cal && v.cal !== calId) {
            await writeLog(env, {
              이벤트명: ev.summary ?? "", 일시: when, 캘린더: calName, 이벤트ID: ev.id,
              액션: "캘린더이동", 변경: `${calName} → ${v.cal === CAL.attoyd ? "attoyd" : "한양"} 제안`,
              신뢰도: "추정", 승인: false, 비고: "승인 시 서버가 이동 집행 (§7-3)",
            });
          }
        } else {
          await writeLog(env, {
            이벤트명: ev.summary ?? "(제목 없음)", 일시: when, 캘린더: calName,
            이벤트ID: ev.id, 액션: v.proposal === "todo" ? "할일전환" : "미분류",
            변경: v.reason, 분류: "5 미분류", 신뢰도: "미분류", 승인: false,
          });
          await setColor(env, calId, ev.id, "5"); // 노랑 경보는 자동 (§29)
          // TODO(P0-b): 웹푸시 발송
        }
      }

      // C′ 후보 — 이동은 제안만 (§27)
      const hint = titleTimeHint(ev.summary ?? "");
      if (hint && ev.start?.dateTime && !ev.start.dateTime.includes("T" + hint.hm)) {
        await writeLog(env, {
          이벤트명: ev.summary ?? "", 일시: when, 캘린더: calName, 이벤트ID: ev.id,
          액션: "시각이동", 변경: `제목 시각 ${hint.hm} ≠ 블록 위치 → 이동 제안`,
          신뢰도: "추정", 승인: false, 비고: "규칙 C′ — 승인 시 집행, 제목에서 시각 제거",
        });
      }

      await env.DB.prepare("INSERT OR REPLACE INTO snap(id,etag,updated) VALUES(?,?,?)")
        .bind(ev.id, ev.etag ?? "", ev.updated ?? now).run();
    }
  }
  await env.DB.prepare("INSERT OR REPLACE INTO kv(k,v) VALUES('lastSync',?)").bind(now).run();
}
