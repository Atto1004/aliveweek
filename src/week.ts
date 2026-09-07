/** 주차별 일정표 뷰 — P1 PWA의 최소 버전. 일요일 시작(캘린더의 "N주차" 마커와 동일 기준).
 *  D1을 거치지 않고 구글에서 항상 직접 읽는다 (원본이 구글이니 캐시 낄 이유 없음, §2-A). */
import { CAL, COLOR_META } from "./rules";
import { listEventsInRange, type Env } from "./google";

const CAL_LABEL: Record<string, string> = {
  [CAL.attoyd]: "attoyd",
  [CAL.hanyang]: "한양",
};

const WEEK1_START = "2026-08-30"; // 1주차 시작 (일) — 학사 캘린더의 "N주차" 마커와 동일 기준선

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function kstTodayStr(): string {
  return toDateStr(new Date(Date.now() + 9 * 3600 * 1000));
}
function sundayStrOf(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return toDateStr(d);
}
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return toDateStr(d);
}
function weekNumberOf(sundayStr: string): number {
  const a = new Date(WEEK1_START + "T00:00:00Z").getTime();
  const b = new Date(sundayStr + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86400000 / 7) + 1;
}
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function mmdd(dateStr: string): string {
  return dateStr.slice(5).replace("-", "/");
}

interface Card { start: string; end: string; allDay: boolean; title: string; loc?: string; color: string; cal: string; }

function cardHtml(c: Card): string {
  const hex = COLOR_META[c.color]?.hex ?? "#9aa0a6";
  const time = c.allDay ? "종일" : `${c.start}${c.end ? "–" + c.end : ""}`;
  return `<div class="card" style="--c:${hex}">
    <div class="time">${esc(time)}<span class="calTag">${esc(c.cal)}</span></div>
    <div class="title">${esc(c.title)}</div>
    ${c.loc ? `<div class="loc">${esc(c.loc)}</div>` : ""}
  </div>`;
}

export async function renderWeek(env: Env, startParam?: string): Promise<string> {
  const sunday = sundayStrOf(startParam && /^\d{4}-\d{2}-\d{2}$/.test(startParam) ? startParam : kstTodayStr());
  const nextSunday = addDays(sunday, 7);
  const prevSunday = addDays(sunday, -7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(sunday, i));
  const today = kstTodayStr();

  const buckets: Record<string, Card[]> = Object.fromEntries(days.map((d) => [d, []]));

  for (const calId of [CAL.attoyd, CAL.hanyang]) {
    const events = await listEventsInRange(env, calId, `${sunday}T00:00:00+09:00`, `${nextSunday}T00:00:00+09:00`);
    const calLabel = CAL_LABEL[calId] ?? calId;
    for (const ev of events) {
      if (ev.status === "cancelled") continue;
      const title: string = ev.summary ?? "(제목 없음)";
      const color: string = ev.colorId ?? "0";
      if (ev.start?.dateTime) {
        const dateKey = ev.start.dateTime.slice(0, 10);
        if (!buckets[dateKey]) continue;
        buckets[dateKey].push({
          start: ev.start.dateTime.slice(11, 16),
          end: ev.end?.dateTime?.slice(11, 16) ?? "",
          allDay: false, title, loc: ev.location, color, cal: calLabel,
        });
      } else if (ev.start?.date) {
        let d = ev.start.date as string;
        const end = (ev.end?.date as string) ?? addDays(d, 1);
        while (d < end) {
          if (buckets[d]) buckets[d].push({ start: "", end: "", allDay: true, title, loc: ev.location, color, cal: calLabel });
          d = addDays(d, 1);
        }
      }
    }
  }
  for (const d of days) {
    buckets[d].sort((a, b) => (a.allDay === b.allDay ? a.start.localeCompare(b.start) : a.allDay ? -1 : 1));
  }

  const legend = Object.values(COLOR_META)
    .map((m) => `<span class="chip" style="--c:${m.hex}">${esc(m.name)}</span>`)
    .join("");

  const cols = days.map((d) => {
    const dt = new Date(d + "T00:00:00Z");
    return { d, m: dt.getUTCMonth() + 1, day: dt.getUTCDate(), dow: DOW[dt.getUTCDay()] };
  });

  const weekBody = cols
    .map(
      (c) => `<section class="day${c.d === today ? " today" : ""}">
      <header><span>${c.m}/${c.day}</span><span class="dow">${c.dow}</span></header>
      <div class="cards">${buckets[c.d].map(cardHtml).join("") || '<p class="empty">일정 없음</p>'}</div>
    </section>`,
    )
    .join("");

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AliVEWEEK — ${weekNumberOf(sunday)}주차</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Malgun Gothic", sans-serif; background:#f4f5f7; color:#1c1e21; }
  @media (prefers-color-scheme: dark) { body { background:#15171a; color:#e7e9ea; } }
  header.top { display:flex; flex-wrap:wrap; gap:8px; align-items:center; justify-content:space-between; padding:14px 18px; background:#fff; border-bottom:1px solid #e2e4e8; position:sticky; top:0; z-index:2; }
  @media (prefers-color-scheme: dark) { header.top { background:#1d1f23; border-color:#2b2e33; } }
  header.top h1 { font-size:15px; margin:0; font-weight:600; }
  header.top .nav a { text-decoration:none; color:inherit; padding:6px 10px; border:1px solid #d7d9dd; border-radius:6px; margin-left:6px; font-size:13px; }
  @media (prefers-color-scheme: dark) { header.top .nav a { border-color:#3a3d43; } }
  .legend { display:flex; flex-wrap:wrap; gap:6px; padding:8px 18px; font-size:11px; }
  .chip { padding:2px 8px; border-radius:10px; background:var(--c); color:#fff; opacity:.85; }
  .week { display:grid; grid-template-columns: repeat(7, minmax(150px,1fr)); gap:10px; padding:12px; overflow-x:auto; }
  .day { background:#fff; border-radius:10px; padding:8px; min-height:120px; }
  @media (prefers-color-scheme: dark) { .day { background:#1d1f23; } }
  .day.today { outline:2px solid #3f51b5; outline-offset:-2px; }
  .day header { font-weight:600; font-size:13px; margin-bottom:6px; display:flex; justify-content:space-between; }
  .day header .dow { color:#8a8f98; font-weight:400; }
  .cards { display:flex; flex-direction:column; gap:6px; }
  .card { border-left:4px solid var(--c); background:color-mix(in srgb, var(--c) 14%, transparent); border-radius:4px; padding:5px 7px; font-size:12px; }
  .card .time { font-weight:600; font-variant-numeric: tabular-nums; display:flex; justify-content:space-between; gap:6px; }
  .card .calTag { font-weight:400; color:#8a8f98; font-size:10px; white-space:nowrap; }
  .card .title { margin-top:2px; }
  .card .loc { color:#8a8f98; font-size:11px; margin-top:1px; }
  .empty { color:#b0b4ba; font-size:12px; }
</style></head>
<body>
  <header class="top">
    <h1>AliVEWEEK · ${weekNumberOf(sunday)}주차 (${mmdd(sunday)}–${mmdd(addDays(sunday, 6))})</h1>
    <div class="nav">
      <a href="/week?start=${prevSunday}">← 이전</a>
      <a href="/week">이번주</a>
      <a href="/week?start=${nextSunday}">다음 →</a>
    </div>
  </header>
  <div class="legend">${legend}</div>
  <div class="week">${weekBody}</div>
</body></html>`;
}
