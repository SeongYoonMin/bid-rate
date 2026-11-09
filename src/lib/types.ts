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
  region: string | null // 공사현장 시도 (모르면 null)
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

/** 다음 사정률 예상 범위와 과거 적중 기록 (값 단위: %, 화면 표시값 기준) */
export interface Prediction {
  mean: number
  sd: number
  low: number // mean - sd × 배수
  high: number // mean + sd × 배수
  total: number
  backtest: {
    evaluated: number // 평가한 공고 수
    hits: number // 그때까지의 범위 안에 든 공고 수
    baselineHits: number // 같은 폭을 0% 중심으로 잡았을 때 든 공고 수
    meanAbsError: number | null
    baselineMeanAbsError: number | null // 항상 0으로 봤을 때
  }
}

/** 시도별 분석 결과 */
export interface RegionResult {
  overall: Distribution
  recommendations: Recommendation[]
  prediction: Prediction | null
}

/** 건수가 이보다 적으면 화면에 표본 부족을 표시한다 (docs/decisions.md) */
export const LOW_SAMPLE_THRESHOLD = 10

/** 화면에서 기본으로 보여 줄 공사현장 시도. 나머지 지역은 참고용 (docs/decisions.md) */
export const HOME_REGION = '전남광주통합특별시'

/** 지역 구분 없이 전체를 볼 때 URL의 region 값 */
export const ALL_REGIONS = '전체'

/** 분석 전체 결과 */
export interface AnalysisResult {
  prediction?: Prediction | null
  regions?: Record<string, RegionResult> // 시도별 (과거 스냅샷에는 없음)
  overall: Distribution
  byOrg: Record<string, Distribution>
  orgNames?: Record<string, string> // orgCode → 발주기관명 (과거 스냅샷에는 없음)
  recommendations: Record<string, Recommendation[]> // 'overall' + orgCode별
}

/** 분석 대상 낙찰방법 (나머지는 저장만 하고 분석에서 뺀다) */
export const ANALYSIS_METHODS = ['적격심사', '소액수의견적'] as const
export type AnalysisMethod = (typeof ANALYSIS_METHODS)[number]

/** 날짜별 스냅샷: 낙찰방법별 분석 결과 */
export interface AnalysisSnapshot {
  methods: Record<AnalysisMethod, AnalysisResult>
}
