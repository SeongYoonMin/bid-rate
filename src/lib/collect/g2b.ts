import type { NewBid, PreliminaryPrice } from '../types'

// --- API 상수 ---

const BASE_URL = 'https://apis.data.go.kr/1230000/as/ScsbidInfoService'
const BID_NOTICE_BASE_URL = 'https://apis.data.go.kr/1230000/ad/BidPublicInfoService02'
const BID_NOTICE_OPERATION = 'getBidPblancListInfoCnstwk02'
const BID_METHOD_UNKNOWN = '미확인'

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

/** 입찰공고 응답 아이템 (필요한 항목만) */
interface G2bNoticeItem {
  sucsfbidMthdNm?: string // 낙찰방법명
  cnstrtsiteRgnNm?: string // 공사현장지역명 ("충청북도 청주시")
}

/** 입찰공고에서 가져와 Bid에 넣는 값 */
export interface G2bNoticeInfo {
  bidMethod: string
  region: string | null
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

export interface G2bFetchOptions {
  onRawResponse?: (endpoint: string, params: Record<string, string>, body: unknown) => void
  /** 수집이 끝난 공고번호를 돌려준다. 이 공고는 상세 호출과 원본 저장을 건너뛴다. */
  getCompleteIds?: (ids: string[]) => Promise<Set<string>>
}

/**
 * 나라장터에서 전기공사 입찰 데이터를 수집한다.
 * 1) PPSSrch로 전기공사(0037) 공고번호 목록 전체 페이징
 * 2) 아직 수집이 끝나지 않은 공고번호로 예비가격상세와 낙찰방법 조회 → toBid 변환
 */
export async function fetchG2bBids(
  apiKey: string,
  bidNoticeApiKey: string,
  beginDate: string, // YYYYMMDDHHmm
  endDate: string, // YYYYMMDDHHmm
  options?: G2bFetchOptions,
): Promise<NewBid[]> {
  // 1단계: 전기공사 공고번호 목록
  const searchItems = await fetchAllSearchItems(apiKey, beginDate, endDate, options?.onRawResponse)

  // 중복 제거 (bidNtceNo 기준, 첫 등장 유지)
  const seen = new Set<string>()
  const unique: G2bSearchItem[] = []
  for (const item of searchItems) {
    if (!seen.has(item.bidNtceNo)) {
      seen.add(item.bidNtceNo)
      unique.push(item)
    }
  }

  const complete =
    (await options?.getCompleteIds?.(unique.map((item) => item.bidNtceNo))) ?? new Set<string>()
  const targets = unique.filter((item) => !complete.has(item.bidNtceNo))

  // 2단계: 각 공고번호로 예비가격상세 조회 (rate limit 방지 딜레이 포함)
  const bids: NewBid[] = []
  for (let idx = 0; idx < targets.length; idx++) {
    const item = targets[idx]
    if (idx > 0) await delay(200)
    try {
      const [detailItems, notice] = await Promise.all([
        fetchDetailItems(apiKey, item.bidNtceNo, options?.onRawResponse),
        fetchNoticeInfo(bidNoticeApiKey, item.bidNtceNo, options?.onRawResponse),
      ])
      if (detailItems.length < 15) continue // 15행 미만 제외
      const bid = g2bDetailToBid(detailItems, item, notice)
      if (bid) bids.push(bid)
    } catch (e) {
      console.warn(
        `[g2b] 공고 조회 실패, 이번 수집에서 건너뜀 (${item.bidNtceNo}):`,
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
  onRawResponse?: G2bFetchOptions['onRawResponse'],
): Promise<G2bSearchItem[]> {
  const allItems: G2bSearchItem[] = []
  let pageNo = 1

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // 원본과 함께 저장되므로 키를 넣지 않는다
    const params: Record<string, string> = {
      type: 'json',
      inqryDiv: '2', // 개찰일시 기준
      inqryBgnDt: beginDate,
      inqryEndDt: endDate,
      indstrytyCd: ELECTRIC_INDUSTRY_CODE,
      numOfRows: String(PAGE_SIZE),
      pageNo: String(pageNo),
    }
    const url = buildUrl('getScsbidListSttusCnstwkPPSSrch', { ...params, ServiceKey: apiKey })

    const data = await fetchJson<G2bApiResponse<G2bSearchItem>>(url)
    onRawResponse?.('getScsbidListSttusCnstwkPPSSrch', params, data)
    const body = data.response.body
    const items = body.items === '' ? [] : body.items
    allItems.push(...items)

    if (pageNo * body.numOfRows >= body.totalCount) break
    pageNo++
  }

  return allItems
}

async function fetchDetailItems(
  apiKey: string,
  bidNtceNo: string,
  onRawResponse?: G2bFetchOptions['onRawResponse'],
): Promise<G2bDetailItem[]> {
  // 원본과 함께 저장되므로 키를 넣지 않는다
  const params: Record<string, string> = {
    type: 'json',
    inqryDiv: '2', // 입찰공고번호 기준
    bidNtceNo,
    numOfRows: '15',
    pageNo: '1',
  }
  const url = buildUrl('getOpengResultListInfoCnstwkPreparPcDetail', {
    ...params,
    ServiceKey: apiKey,
  })

  const data = await fetchJson<G2bApiResponse<G2bDetailItem>>(url)
  onRawResponse?.('getOpengResultListInfoCnstwkPreparPcDetail', params, data)
  const items = data.response.body.items
  return items === '' ? [] : items
}

/** 조회에 실패하면 예외를 던진다. 이미 저장된 값을 덮어쓰지 않도록 그 공고는 이번 수집에서 건너뛴다. */
async function fetchNoticeInfo(
  apiKey: string,
  bidNtceNo: string,
  onRawResponse?: G2bFetchOptions['onRawResponse'],
): Promise<G2bNoticeInfo> {
  const params: Record<string, string> = {
    type: 'json',
    inqryDiv: '2', // 입찰공고번호 기준
    bidNtceNo,
    numOfRows: '20',
    pageNo: '1',
  }
  const url = buildUrl(BID_NOTICE_OPERATION, { ...params, serviceKey: apiKey }, BID_NOTICE_BASE_URL)
  const data = await fetchJson<G2bApiResponse<G2bNoticeItem>>(url)
  onRawResponse?.(BID_NOTICE_OPERATION, params, data)
  const items = data.response.body.items
  const latest = items === '' ? undefined : items.at(-1) // 마지막 차수
  return {
    bidMethod: toBidMethod(latest?.sucsfbidMthdNm),
    region: toRegion(latest?.cnstrtsiteRgnNm),
  }
}

/** "충청북도 청주시" → "충청북도" */
export function toRegion(siteName: string | undefined): string | null {
  return siteName?.trim().split(/\s+/)[0] || null
}

/** "적격심사제-추정가격이 ..." → "적격심사", "소액수의견적-..." → "소액수의견적" */
export function toBidMethod(methodName: string | undefined): string {
  const head = methodName?.split('-')[0].trim()
  if (!head) return BID_METHOD_UNKNOWN
  return head === '적격심사제' ? '적격심사' : head
}

/**
 * 예비가격상세 15행 + 낙찰 목록의 수요기관 + 입찰공고 정보 → NewBid 변환.
 * 테스트를 위해 export.
 */
export function g2bDetailToBid(
  rows: G2bDetailItem[],
  searchItem: Pick<G2bSearchItem, 'dminsttCd' | 'dminsttNm'>,
  notice: G2bNoticeInfo,
): NewBid | null {
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
    org: searchItem.dminsttNm, // 예비가격상세 응답에 발주기관 없음
    orgCode: searchItem.dminsttCd,
    baseAmount: bssamt,
    predeterminedPrice: plnprc,
    preliminaryPrices,
    assessmentRate,
    noticeDate: parseDate(first.rlOpengDt) ?? '',
    openDate: first.rlOpengDt ?? null,
    bidMethod: notice.bidMethod,
    region: notice.region,
  }
}

// --- 유틸 ---

function buildUrl(
  operation: string,
  params: Record<string, string>,
  baseUrl: string = BASE_URL,
): string {
  const url = new URL(`${baseUrl}/${operation}`)
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

  // 나라장터 에러 응답 감지 (200 OK지만 본문이 에러)
  const errHeader = (json as Record<string, unknown>)?.OpenAPI_ServiceResponse as
    { cmmMsgHeader?: { returnAuthMsg?: string; returnReasonCode?: string } } | undefined
  if (errHeader?.cmmMsgHeader) {
    const { returnAuthMsg, returnReasonCode } = errHeader.cmmMsgHeader
    throw new Error(`[g2b] API 에러 (code: ${returnReasonCode}): ${returnAuthMsg}`)
  }

  return json as T
}

function parseIntOrNull(value: string | undefined): number | null {
  if (value === undefined || value === '') return null
  const n = parseInt(value, 10)
  return Number.isNaN(n) ? null : n
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** "2025-07-01 13:14:24" → "2025-07-01" */
function parseDate(dt: string | undefined): string | null {
  if (!dt) return null
  const match = dt.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : null
}
