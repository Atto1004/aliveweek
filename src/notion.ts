/** 노션 클라이언트 — 변동 로그는 모든 쓰기에 강제 1행 (§G-1). 노션이 원본, D1은 캐시. */
import type { Env } from "./google";

const LOG_DS = "a31b7832-b3a5-4bf9-ac26-590d80d7ffdf"; // 스케줄 변동 로그

export interface LogRow {
  이벤트명: string;
  일시?: { start: string; end?: string; datetime?: boolean };
  캘린더: "attoyd" | "한양";
  이벤트ID: string;
  액션: "색부여" | "캘린더이동" | "제목정규화" | "시각이동" | "중복검출"
      | "규칙위반" | "생성" | "휴강처리" | "결석표시" | "미분류" | "할일전환" | "삭제요청";
  변경: string;   // 이전값→이후값
  분류?: string;
  신뢰도: "확실" | "추정" | "미분류";
  승인: boolean;  // false = 아토 확인 대기 (노션에서 체크하면 서버가 집행)
  비고?: string;
}

export async function writeLog(env: Env, row: LogRow) {
  const props: Record<string, unknown> = {
    이벤트명: { title: [{ text: { content: row.이벤트명 } }] },
    캘린더: { select: { name: row.캘린더 } },
    이벤트ID: { rich_text: [{ text: { content: row.이벤트ID } }] },
    액션: { select: { name: row.액션 } },
    "이전값→이후값": { rich_text: [{ text: { content: row.변경 } }] },
    신뢰도: { select: { name: row.신뢰도 } },
    승인: { checkbox: row.승인 },
  };
  if (row.분류) props["분류"] = { select: { name: row.분류 } };
  if (row.비고) props["비고"] = { rich_text: [{ text: { content: row.비고 } }] };
  if (row.일시) props["일시"] = { date: { start: row.일시.start, end: row.일시.end ?? null } };

  const r = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.NOTION_TOKEN}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ parent: { database_id: LOG_DS }, properties: props }),
  });
  if (!r.ok) throw new Error("notion writeLog: " + (await r.text()));
}
