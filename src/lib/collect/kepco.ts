import type { NewBid } from '../types'

// --- API 상수 ---

const BASE_URL = 'https://bigdata.kepco.co.kr/openapi/v1/electContract.do'

const PAGE_SIZE = 100

// --- 내부 타입 (API 응답) ---

interface KepcoItem {
  no: string // 공고번호
  name: string // 공고명
  placeName: string // 발주기관명
  companyId: string // 기관 코드 (COM01 등)
  itemType: string // Construction, Goods 등
  bidType: string // QualifiedEval, LimitedLowestPrice 등
  estimatedPriceBasicAmount?: string // 기초금액
  noticeDate: string // 공고일 (YYYYMMDD)
  endDatetime?: string // 입찰 종료일시
}

interface KepcoApiResponse {
  paging: {
    page: number
    totalCount: number
    pageSize: number
  }
  data: KepcoItem[]
}

// --- 공개 API ---

/**
 * 한전 전자입찰에서 공사+적격심사 공고를 수집한다.
 * 한전은 예정가격·복수예비가격 없음 → predeterminedPrice: null, preliminaryPrices: []
 */
export async function fetchKepcoBids(
  apiKey: string,
  beginDate: string, // YYYYMMDD
  endDate: string, // YYYYMMDD
): Promise<NewBid[]> {
  const items = await fetchAllItems(apiKey, beginDate, endDate)

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
): Promise<KepcoItem[]> {
  const allItems: KepcoItem[] = []
  let page = 1

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const url = buildUrl({
      apiKey,
      noticeBeginDate: beginDate,
      noticeEndDate: endDate,
      returnType: 'json',
      pageSize: String(PAGE_SIZE),
      page: String(page),
    })

    const data = await fetchJson<KepcoApiResponse>(url)
    allItems.push(...data.data)

    if (page * data.paging.pageSize >= data.paging.totalCount) break
    page++
  }

  return allItems
}

/**
 * 한전 API 아이템 → NewBid 변환.
 * 테스트를 위해 export.
 */
export function kepcoItemToBid(item: KepcoItem): NewBid | null {
  const baseAmount = parseIntOrNull(item.estimatedPriceBasicAmount)
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
  return res.json() as Promise<T>
}

function parseIntOrNull(value: string | undefined): number | null {
  if (value === undefined || value === '') return null
  const n = parseInt(value, 10)
  return Number.isNaN(n) ? null : n
}

/** "20260810" → "2026-08-10" */
function formatDate(yyyymmdd: string): string {
  if (yyyymmdd.length !== 8) return yyyymmdd
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`
}
