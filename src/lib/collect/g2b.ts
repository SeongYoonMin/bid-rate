import type { NewBid, PreliminaryPrice } from '../types'

// --- API 상수 ---

const BASE_URL = 'https://apis.data.go.kr/1230000/as/ScsbidInfoService'

const ELECTRIC_INDUSTRY_CODE = '0037'
const PAGE_SIZE = 100

// --- 내부 타입 (API 응답) ---

/** PPSSrch 응답 아이템 */
interface G2bSearchItem {
  bidNtceNo: string
  bidNtceOrd: string
  bidNtceNm: string
  dminsttCd: string
  dminsttNm: string
  rlOpengDt?: string
  sucsfbidRate?: string
}

/** 예비가격상세 응답 아이템 (1건당 15행) */
interface G2bDetailItem {
  bidNtceNo: string
  bidNtceOrd: string
  bidNtceNm: string
  plnprc?: string // 예정가격
  bssamt?: string // 기초금액
  totRsrvtnPrceNum?: string // 총예가건수
  compnoRsrvtnPrceSno: string // 복수예가순번 (1~15)
  bsisPlnprc?: string // 기초예정가격 (개별 예비가격)
  drwtYn: string // 추첨여부 (Y/N)
  rlOpengDt?: string // 실개찰일시
}

interface G2bApiResponse<T> {
  response: {
    header: { resultCode: string; resultMsg: string }
    body: {
      items: T[] | ''
      numOfRows: number
      pageNo: number
      totalCount: number
    }
  }
}

// --- 공개 API ---

/**
 * 나라장터에서 전기공사 입찰 데이터를 수집한다.
 * 1) PPSSrch로 전기공사(0037) 공고번호 목록 전체 페이징
 * 2) 각 공고번호로 예비가격상세 조회 → toBid 변환
 */
export async function fetchG2bBids(
  apiKey: string,
  beginDate: string, // YYYYMMDDHHmm
  endDate: string, // YYYYMMDDHHmm
): Promise<NewBid[]> {
  // 1단계: 전기공사 공고번호 목록
  const searchItems = await fetchAllSearchItems(apiKey, beginDate, endDate)

  // 중복 제거 (bidNtceNo 기준, 첫 등장 유지)
  const seen = new Set<string>()
  const unique: G2bSearchItem[] = []
  for (const item of searchItems) {
    if (!seen.has(item.bidNtceNo)) {
      seen.add(item.bidNtceNo)
      unique.push(item)
    }
  }

  // 2단계: 각 공고번호로 예비가격상세 조회
  const bids: NewBid[] = []
  for (const item of unique) {
    try {
      const detailItems = await fetchDetailItems(apiKey, item.bidNtceNo)
      if (detailItems.length < 15) continue // 15행 미만 제외
      const bid = g2bDetailToBid(detailItems)
      if (bid) bids.push(bid)
    } catch (e) {
      console.warn(
        `[g2b] 예비가격상세 조회 실패 (${item.bidNtceNo}):`,
        e instanceof Error ? e.message : e,
      )
    }
  }

  return bids
}

// --- 내부 함수 ---

async function fetchAllSearchItems(
  apiKey: string,
  beginDate: string,
  endDate: string,
): Promise<G2bSearchItem[]> {
  const allItems: G2bSearchItem[] = []
  let pageNo = 1

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const url = buildUrl('getScsbidListSttusCnstwkPPSSrch', {
      ServiceKey: apiKey,
      type: 'json',
      inqryDiv: '2', // 개찰일시 기준
      inqryBgnDt: beginDate,
      inqryEndDt: endDate,
      indstrytyCd: ELECTRIC_INDUSTRY_CODE,
      numOfRows: String(PAGE_SIZE),
      pageNo: String(pageNo),
    })

    const data = await fetchJson<G2bApiResponse<G2bSearchItem>>(url)
    const body = data.response.body
    const items = body.items === '' ? [] : body.items
    allItems.push(...items)

    if (pageNo * body.numOfRows >= body.totalCount) break
    pageNo++
  }

  return allItems
}

async function fetchDetailItems(apiKey: string, bidNtceNo: string): Promise<G2bDetailItem[]> {
  const url = buildUrl('getOpengResultListInfoCnstwkPreparPcDetail', {
    ServiceKey: apiKey,
    type: 'json',
    inqryDiv: '2', // 입찰공고번호 기준
    bidNtceNo,
    numOfRows: '15',
    pageNo: '1',
  })

  const data = await fetchJson<G2bApiResponse<G2bDetailItem>>(url)
  const items = data.response.body.items
  return items === '' ? [] : items
}

/**
 * 예비가격상세 15행 → NewBid 변환.
 * 테스트를 위해 export.
 */
export function g2bDetailToBid(rows: G2bDetailItem[]): NewBid | null {
  if (rows.length === 0) return null

  const first = rows[0]
  const bssamt = parseIntOrNull(first.bssamt)
  const plnprc = parseIntOrNull(first.plnprc)

  if (bssamt === null) return null // 기초금액 없으면 변환 불가

  const preliminaryPrices: PreliminaryPrice[] = rows.map((row) => ({
    seq: parseInt(row.compnoRsrvtnPrceSno, 10),
    price: parseIntOrNull(row.bsisPlnprc) ?? 0,
    drawn: row.drwtYn === 'Y',
  }))

  const assessmentRate = plnprc !== null && bssamt !== 0 ? plnprc / bssamt : null

  return {
    source: 'g2b',
    sourceId: first.bidNtceNo,
    name: first.bidNtceNm,
    org: '', // 예비가격상세 응답에 발주기관 없음
    orgCode: '',
    baseAmount: bssamt,
    predeterminedPrice: plnprc,
    preliminaryPrices,
    assessmentRate,
    noticeDate: parseDate(first.rlOpengDt) ?? '',
    openDate: first.rlOpengDt ?? null,
    bidMethod: '적격심사',
  }
}

// --- 유틸 ---

function buildUrl(operation: string, params: Record<string, string>): string {
  const url = new URL(`${BASE_URL}/${operation}`)
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

/** "2025-07-01 13:14:24" → "2025-07-01" */
function parseDate(dt: string | undefined): string | null {
  if (!dt) return null
  const match = dt.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : null
}
