-- AliVEWEEK D1 — 캐시 전용 (§2-A). 날려도 원본(노션·구글)에서 재구축 가능해야 한다.
CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS snap (
  id TEXT PRIMARY KEY,      -- 구글 이벤트 id
  etag TEXT,                -- 변경 감지용
  updated TEXT
);
-- P0-b: 웹푸시 구독 (브라우저가 주는 endpoint — 이것도 재등록 가능하므로 캐시 취급)
CREATE TABLE IF NOT EXISTS push_subs (endpoint TEXT PRIMARY KEY, p256dh TEXT, auth TEXT);
