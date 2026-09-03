# AliVEWEEK

얼라이브위크 규칙 엔진의 상주 서버판. 기획: `Obsidian/20_얼라이브위크/얼라이브위크 서비스 기획서 v1.md`

**원칙**: 원본은 노션·옵시디언·깃허브. D1은 캐시. 자동 = 색·로그·휴강 / 승인 큐 = 시각이동·삭제·생성.

## 셋업 (1회)

### 1. 구글 열쇠 (아토, ~10분)
1. [console.cloud.google.com](https://console.cloud.google.com) — **한양 계정**으로 로그인 → 새 프로젝트 `aliveweek`
2. `API 및 서비스 → 라이브러리` → **Google Calendar API** 사용 설정
3. `OAuth 동의 화면` → External → 테스트 모드, 테스트 사용자에 한양 계정 추가
4. `사용자 인증 정보 → OAuth 클라이언트 ID → 데스크톱 앱` → ID/Secret 확보
5. `node scripts/get-refresh-token.mjs <ID> <SECRET>` → 브라우저 로그인(한양 계정) → refresh token 획득

### 2. 노션 열쇠 (아토, ~3분)
[notion.so/my-integrations](https://www.notion.so/my-integrations) → 새 내부 통합 `AliVEWEEK` → 토큰 복사
→ 노션에서 `얼라이브위크` 페이지 → ⋯ → 연결 → AliVEWEEK 추가 (하위 DB 접근 허용)

### 3. 배포
```bash
npm install
npx wrangler login                      # 브라우저로 Cloudflare 인증
npx wrangler d1 create aliveweek        # 나온 database_id를 wrangler.toml에
npx wrangler d1 execute aliveweek --file=schema.sql --remote
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put GOOGLE_REFRESH_TOKEN
npx wrangler secret put NOTION_TOKEN
npx wrangler deploy
```
확인: `https://aliveweek.<계정>.workers.dev/health` → `{"ok":true}`

## 구조
- `src/rules.ts` — 규칙 엔진 (11색 분류·라우팅·C′·R2·이동 모드)
- `src/index.ts` — 5분 크론: 변경분 → 분류 → 색 자동/승인 큐 → 노션 로그
- `src/google.ts` / `src/notion.ts` — API 클라이언트
- P0-b: 웹푸시 · P1: PWA · P2: 출결 웹훅 흡수·이동 블록 · P3: 배치 엔진·친구 층
