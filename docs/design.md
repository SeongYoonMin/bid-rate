# 설계

> 개발자가 직접 작성한다. 작성 후 design-reviewer로 리뷰한다.

## 1. 공통 공고 형식 (Bid)

```typescript
interface Bid {
  // 식별
  id: string                    // 내부 고유 ID (자동 생성)
  source: 'kepco' | 'g2b' | 'excel'
  sourceId: string              // 출처별 공고번호 (한전: no, 나라장터: bidNtceNo)

  // 공고 기본
  name: string                  // 공고명
  org: string                   // 발주기관명
  orgCode: string               // 기관 코드 (한전: COM01, 나라장터: dminsttCd)

  // 금액 (원 단위 정수)
  baseAmount: number            // 기초금액
  predeterminedPrice: number | null  // 예정가격 (한전은 없음 → null)

  // 복수예비가격 (나라장터만, 한전은 빈 배열)
  preliminaryPrices: {
    seq: number                 // 1~15
    price: number               // 개별 예비가격
    drawn: boolean              // 추첨 여부
  }[]

  // 사정률 (예정가격 있을 때만 계산, 저장)
  assessmentRate: number | null // predeterminedPrice / baseAmount

  // 일시
  noticeDate: string            // 공고일 (YYYY-MM-DD)
  openDate: string | null       // 개찰일시

  // 메타
  bidMethod: string             // 적격심사, 제한최저가 등
  createdAt: string             // 저장 시각
}
```

- `sourceId`는 유니크 키. 중복 수집 시 upsert.
- 사정률은 비율(1.007998)로 저장. 화면에서 (값-1)×100으로 % 변환.
- 사정률은 Bid 저장 시 계산하여 함께 저장한다. 예정가격이 없으면 null.
- 한전 데이터는 `predeterminedPrice: null`, `assessmentRate: null`. 엑셀 업로드로 나중에 채울 수 있다.
- 엑셀 업로드 시 `sourceId`로 기존 Bid 매칭(source 무관). 있으면 덮어쓰기, 없으면 새 Bid 삽입.
- 추후 필드 확장 가능성을 염두에 둔다.

## 2. 폴더 구조

```
src/
├── app/
│   ├── api/
│   │   ├── cron/          # 매일 수집+재계산 (Vercel Cron)
│   │   └── upload/        # 엑셀 업로드
│   ├── page.tsx           # 메인 (오늘의 추천)
│   ├── org/[code]/        # 발주처 분석
│   └── history/           # 적중 기록
├── lib/
│   ├── analysis/          # 순수 계산 로직 (DB/fetch/부수효과 금지)
│   │   ├── distribution.ts    # 분포 집계
│   │   ├── correction.ts      # 발주처 보정
│   │   └── recommend.ts       # 추천 지점 결정 (computeAll 포함)
│   ├── orchestrate.ts     # recomputeAll(): DB조회 → computeAll → DB저장
│   └── collect/           # 출처별 수집기 + toBid 변환
│       ├── kepco.ts
│       ├── g2b.ts
│       └── excel.ts
```

## 3. DB (Supabase — Postgres)

테이블:

| 테이블 | 역할 |
|---|---|
| `bids` | 공통 공고 형식 (Bid) 저장 |
| `raw_responses` | API 원본 응답 보관 (재처리·디버깅용) |
| `analysis_results` | 분석 결과 (발주처별 분포 + 추천 지점) |
| `upload_logs` | 엑셀 업로드 기록 (건수, 제외 사유) |

## 4. 분석 흐름

```
Bid[] → 분포 집계 → 발주처 보정 → 추천 지점 결정 → 결과 저장
```

| 항목 | 결정 |
|---|---|
| 구간 폭 | 0.25% (부모님이 보던 화면과 동일) |
| 집계 단위 | 전체 + 발주처별 |
| 보정 비중 | 발주처 건수 / (발주처 건수 + k), k는 백테스트로 결정 (초기값 30) |
| 추천 출력 | 최빈 구간(크게) + 상위 3개 구간(확률 순) |
| 계산 시점 | `recomputeAll()` 호출 시 |
| 데이터 범위 | 전체 기간 + 적격심사만 (기간 제한은 백테스트 후 조정) |

- `src/lib/analysis/`는 순수 함수만. DB, fetch, Date.now(), Math.random() 금지.
- `computeAll(bids: Bid[]): AnalysisResult` — 순수 함수 (analysis/ 내).
- `recomputeAll()` — DB조회 → computeAll → DB저장 오케스트레이션 (lib/orchestrate.ts).
- 시뮬레이션 난수는 seed 기반 RNG 주입.
- `analysis_results`는 날짜별 스냅샷으로 저장 (`computed_date` 포함).

## 5. 실행 흐름

```
[매일 08:00 KST = UTC 23:00]
  Vercel Cron → POST /api/cron (CRON_SECRET 검증)
    → 한전 API 수집 → toBid → 저장
    → 나라장터 API 수집 → toBid → 저장
    → recomputeAll()
    → 결과 저장

[엑셀 업로드]
  POST /api/upload (파일 수신)
    → 파싱 → toBid → 저장
    → recomputeAll()
    → 응답: 저장 건수, 제외 건수 + 사유

[수집 범위]
  매번 최근 N일을 고정 범위로 수집 + upsert (수집 상태 관리 불필요)

[실패 시]
  → 기존 분석 결과 유지 (덮어쓰지 않음)
  → 실패 로그 기록
  → 다음 실행에서 자동 복구 (고정 범위 재수집)
```

- 재계산 진입점은 `recomputeAll()` 하나. cron과 업로드가 같은 함수를 호출한다.
- 배포: Vercel
- 예약 실행: Vercel Cron

## 6. 화면

| 페이지 | 핵심 내용 |
|---|---|
| **메인 (오늘의 추천)** | 최빈 구간 크게 + 신뢰도 + 상위 3개 구간 |
| **발주처 분석** | 사정률 추이 차트 + 0.25% 구간 분포표 + 추천 |
| **적중 기록** | 과거 추천 vs 실제 사정률 비교 |
| **업로드** | 엑셀 파일 올리기 + 결과 표시 |

- 차트: Nivo (D3 기반, Next.js SSR 지원, 세련된 기본 디자인)
- 모바일 대응 기본, 큰 글씨, 화면당 핵심 숫자 하나를 크게 표시
- 차트 축·표 머리글에 단위(%, 원) 표시
