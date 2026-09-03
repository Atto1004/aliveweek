/**
 * AliVEWEEK 규칙 엔진 — 플래너 v2 기획서 §12–38의 코드화.
 * 원칙: 확실한 것만 자동(색·로그·휴강), 애매하면 노랑(5) + 승인 큐.
 *       시각 이동·삭제·생성은 언제나 승인 큐로만. (§7-3 확정)
 */

export const CAL = {
  attoyd: "attoyd1004@gmail.com",   // 생활·알바·돈·약속
  hanyang: "rladkxh1004@hanyang.ac.kr", // 수업·학사·시험·과제·근로
} as const;

/** 11색 — 부록 B 확정판 (2026-09-03) */
export const COLOR = {
  이동: "1", 약속모임: "2", 창업대외: "3", 운선: "4", 미분류: "5",
  노동근무: "6", 공부: "7", 돈: "8", 수업학사: "9", 건강몸: "10", 시험마감: "11",
} as const;

/** 2학기 정규 과목 — 제목 정확 매치 (출결 웹훅과 동일 키) */
export const SUBJECTS = [
  "미분적분학2", "공업수학1", "일반물리학2", "정역학",
  "아카데믹글쓰기", "CADD", "창업아이디어탐색", "피지컬AI 실습1",
];

type Rule = { re: RegExp; color: string; cal?: keyof typeof CAL; why: string };

/** 위에서부터 첫 매치 승. 매치 없으면 미분류(5) + 승인 큐. */
const RULES: Rule[] = [
  // 운선 — 아토 접두사가 유일한 근거 (§30). 아톰은 접두사를 붙이지도 지우지도 않는다.
  { re: /^운선/, color: COLOR.운선, cal: "attoyd", why: "운선 접두사" },

  // 시험·마감 (§22 D-7 트리거)
  { re: /(중간고사|기말고사|퀴즈|시험|마감|제출)/, color: COLOR.시험마감, cal: "hanyang", why: "시험·마감 키워드" },

  // 학사 일정
  { re: /(개강|종강|수강신청|정정기간|계절학기|S\/U|학점포기|성적|휴강)/, color: COLOR.수업학사, cal: "hanyang", why: "학사 키워드" },

  // 노동 — 알바·근로·대타
  { re: /(알바|근로장학|대타|근무)/, color: COLOR.노동근무, why: "노동 키워드" },
  { re: /파쓰쿠찌/, color: COLOR.노동근무, cal: "attoyd", why: "알바처명" },

  // 창업·대외·크리에이터 (강의는 아토가 파는 노동이지만 11색 체계에선 3번 — 부록 B)
  { re: /(클로드 강의|창업|면접|서포터즈|영화제|촬영|부트캠프|간담회)/, color: COLOR.창업대외, why: "창업·대외 키워드" },

  // 건강·몸
  { re: /(의원|병원|치과|제모|피부|매직|미용|클라이밍|헬스|크로스핏|운동)/, color: COLOR.건강몸, cal: "attoyd", why: "건강·몸 키워드" },

  // 돈 — 들어오는 것만 캘린더에 남는다 (§34: 납부는 할일 큐로)
  { re: /(월급|급여|주거급여|환급|\+.*만원|입금)/, color: COLOR.돈, cal: "attoyd", why: "수입 키워드" },

  // 이동
  { re: /^🚇|^이동[: ]/, color: COLOR.이동, cal: "attoyd", why: "이동 블록" },
];

export type Verdict =
  | { kind: "auto"; color: string; cal?: string; why: string }
  | { kind: "queue"; reason: string; proposal?: string };

export function classify(title: string, calendarId: string): Verdict {
  const t = title.trim();

  // 정규 과목 = 수업 (기준선은 서버가 만들지 않고 지키기만 한다)
  if (SUBJECTS.some((s) => t === s || t.startsWith(s + " ") || t.startsWith(s + "("))) {
    return { kind: "auto", color: COLOR.수업학사, cal: CAL.hanyang, why: "정규 과목" };
  }

  for (const r of RULES) {
    if (r.re.test(t)) {
      return { kind: "auto", color: r.color, cal: r.cal ? CAL[r.cal] : undefined, why: r.why };
    }
  }

  // §34 납부 — 캘린더가 아니라 할일 큐로 가야 함. 전환은 삭제를 동반하므로 승인 큐.
  if (/(납부|월세|요금|구독|카드값|-.*만원)/.test(t)) {
    return { kind: "queue", reason: "납부 항목 — 할일 큐·납부로 전환 제안 (§34)", proposal: "todo" };
  }

  // 판정 불가 → 미분류. 추측해서 칠하지 않는다 (§29).
  return { kind: "queue", reason: "분류 불가 — 노랑 경보" };
}

/** C′ (§27–28): 제목 첫머리의 시각. 분반 수식("11:00 분반")은 제외. 이동은 승인 큐로만 제안. */
export function titleTimeHint(title: string): { hm: string } | null {
  if (/분반/.test(title)) return null;
  const m = title.match(/^(\d{1,2}):(\d{2})\s/);
  if (!m) return null;
  let h = +m[1];
  if (h >= 1 && h <= 8) h += 12; // 관행: 1~8시는 오후로 해석해 제안 (확정은 아토)
  return { hm: `${String(h).padStart(2, "0")}:${m[2]}` };
}

/** R2 (§22): 종료가 늦고 다음날 첫 일정이 이르면 수면 경고 */
export function r2Warning(endISO: string, nextStartISO: string, needHours = 6): string | null {
  const gap = (new Date(nextStartISO).getTime() - new Date(endISO).getTime()) / 3.6e6;
  // 기상준비+이동 1.5h 가정
  return gap - 1.5 < needHours
    ? `수면 ${Math.max(0, gap - 1.5).toFixed(1)}h 예상 (필요 ${needHours}h)` : null;
}

/** §38 이동 모드 판정 */
export function travelMode(gapMin: number, travelMin: number): "tight" | "loose" {
  const buffered = Math.max(travelMin * 1.15, travelMin + 15);
  return gapMin <= buffered ? "tight" : "loose";
}
