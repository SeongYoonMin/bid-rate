/** 복수예비가격 개별 항목 */
export interface PreliminaryPrice {
  seq: number // 1~15
  price: number // 개별 예비가격 (원)
  drawn: boolean // 추첨 여부
}

/** 공통 공고 형식 */
export interface Bid {
  // 식별
  id: string // 내부 고유 ID (DB 자동 생성)
  source: 'kepco' | 'g2b' | 'excel'
  sourceId: string // 출처별 공고번호

  // 공고 기본
  name: string // 공고명
  org: string // 발주기관명
  orgCode: string // 기관 코드

  // 금액 (원 단위 정수)
  baseAmount: number // 기초금액
  predeterminedPrice: number | null // 예정가격 (한전은 null)

  // 복수예비가격 (나라장터만, 한전은 빈 배열)
  preliminaryPrices: PreliminaryPrice[]

  // 사정률 (예정가격 있을 때만 계산)
  assessmentRate: number | null // predeterminedPrice / baseAmount

  // 일시
  noticeDate: string // 공고일 (YYYY-MM-DD)
  openDate: string | null // 개찰일시

  // 메타
  bidMethod: string // 적격심사, 제한최저가 등
  createdAt: string // 저장 시각 (DB 자동 생성)
}

/** 수집기가 반환하는 타입 (id, createdAt은 DB가 생성) */
export type NewBid = Omit<Bid, 'id' | 'createdAt'>

// ── 분석 결과 타입 ──

/** 0.25% 구간별 건수 */
export interface BinCount {
  binStart: number // 구간 시작값 (displayRate 기준, 예: 0.5 → 0.5%~0.75%)
  count: number
}

/** 분포 */
export interface Distribution {
  bins: BinCount[]
  total: number // assessmentRate가 있는 Bid 건수
}

/** 추천 지점 */
export interface Recommendation {
  binStart: number
  probability: number // count / total (0~1)
}

/** 분석 전체 결과 */
export interface AnalysisResult {
  overall: Distribution
  byOrg: Record<string, Distribution>
  recommendations: Record<string, Recommendation[]> // 'overall' + orgCode별
}
