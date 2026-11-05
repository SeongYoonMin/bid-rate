-- 공통 공고 데이터
CREATE TABLE bids (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source              text NOT NULL CHECK (source IN ('kepco','g2b','excel')),
  source_id           text UNIQUE NOT NULL,
  name                text NOT NULL,
  org                 text NOT NULL DEFAULT '',
  org_code            text NOT NULL DEFAULT '',
  base_amount         bigint NOT NULL,
  predetermined_price bigint,
  preliminary_prices  jsonb NOT NULL DEFAULT '[]',
  assessment_rate     double precision,
  notice_date         date NOT NULL,
  open_date           text,
  bid_method          text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bids_org_code    ON bids(org_code);
CREATE INDEX idx_bids_notice_date ON bids(notice_date);

-- API 원본 응답 보관
CREATE TABLE raw_responses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source        text NOT NULL,
  endpoint      text NOT NULL,
  params        jsonb,
  response_body jsonb NOT NULL,
  fetched_at    timestamptz NOT NULL DEFAULT now()
);

-- 분석 결과
CREATE TABLE analysis_results (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  computed_date date NOT NULL UNIQUE,
  result        jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
