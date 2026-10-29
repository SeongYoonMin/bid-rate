import type { NewBid } from '../types'

// --- API 상수 ---

const BASE_URL = 'https://bigdata.kepco.co.kr/openapi/v1/electContract.do'

// --- 내부 타입 (API 응답) ---

interface KepcoItem {
  no: string // 공고번호
  name: string // 공고명
  placeName: string // 발주기관명
  companyId: string // 기관 코드 (COM01 등)
  itemType: string // Construction, Service, Product
  bidType: string // QualifiedEval, LimitedLowestPrice 등
  estimatedPriceBasicAmount?: number // 기초금액 (숫자)
  noticeDate: string // 공고일 (YYYYMMDD)
  endDatetime?: string // 입찰 종료일시
}

interface KepcoApiResponse {
  data: KepcoItem[]
}

// --- 공개 API ---

export interface KepcoFetchOptions {
  onRawResponse?: (endpoint: string, params: Record<string, string>, body: unknown) => void
}

/**
 * 한전 전자입찰에서 공사+적격심사 공고를 수집한다.
 * 한전은 예정가격·복수예비가격 없음 → predeterminedPrice: null, preliminaryPrices: []
 */
export async function fetchKepcoBids(
  apiKey: string,
  beginDate: string, // YYYYMMDD
  endDate: string, // YYYYMMDD
  options?: KepcoFetchOptions,
): Promise<NewBid[]> {
  const items = await fetchAllItems(apiKey, beginDate, endDate, options?.onRawResponse)

  // 공사 + 적격심사만 필터
  const filtered = items.filter(
    (item) => item.itemType === 'Construction' && item.bidType === 'QualifiedEval',
  )

  const bids: NewBid[] = []
  for (const item of filtered) {
    const bid = kepcoItemToBid(item)
    if (bid) bids.push(bid)
  }

  return bids
}

// --- 내부 함수 ---

async function fetchAllItems(
  apiKey: string,
  beginDate: string,
  endDate: string,
  onRawResponse?: KepcoFetchOptions['onRawResponse'],
): Promise<KepcoItem[]> {
  const params: Record<string, string> = {
    apiKey,
    noticeBeginDate: beginDate,
    noticeEndDate: endDate,
    returnType: 'json',
  }
  const url = buildUrl(params)

  const data = await fetchJson<KepcoApiResponse>(url)
  onRawResponse?.('electContract.do', params, data)
  return data.data
}

/**
 * 한전 API 아이템 → NewBid 변환.
 * 테스트를 위해 export.
 */
export function kepcoItemToBid(item: KepcoItem): NewBid | null {
  const baseAmount = item.estimatedPriceBasicAmount ?? null
  if (baseAmount === null) return null // 기초금액 없으면 변환 불가

  return {
    source: 'kepco',
    sourceId: item.no,
    name: item.name,
    org: item.placeName,
    orgCode: item.companyId,
    baseAmount,
    predeterminedPrice: null, // 한전 API에 예정가격 없음
    preliminaryPrices: [], // 한전은 복수예비가격 없음
    assessmentRate: null,
    noticeDate: formatDate(item.noticeDate), // YYYYMMDD → YYYY-MM-DD
    openDate: null,
    bidMethod: '적격심사',
  }
}

// --- 유틸 ---

function buildUrl(params: Record<string, string>): string {
  const url = new URL(BASE_URL)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  }
  const json = await res.json()

  // 한전 API 에러 응답 감지 (data 필드 없음 등)
  if (!json || typeof json !== 'object' || !('data' in json)) {
    throw new Error(`[kepco] 예상치 못한 응답 구조: ${JSON.stringify(json).slice(0, 200)}`)
  }

  return json as T
}

/** "20260810" → "2026-08-10" */
function formatDate(yyyymmdd: string): string {
  if (yyyymmdd.length !== 8) return yyyymmdd
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`
}
