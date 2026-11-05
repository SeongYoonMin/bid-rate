import {
  ANALYSIS_METHODS,
  type AnalysisMethod,
  type AnalysisSnapshot,
  type Bid,
  type NewBid,
  type PreliminaryPrice,
} from './types'
import { todayKst } from './date'
import { getSupabase } from './supabase'

// ── snake_case DB row 타입 ──

interface BidRow {
  id: string
  source: string
  source_id: string
  name: string
  org: string
  org_code: string
  base_amount: number
  predetermined_price: number | null
  preliminary_prices: PreliminaryPrice[]
  assessment_rate: number | null
  notice_date: string
  open_date: string | null
  bid_method: string
  region: string | null
  created_at: string
}

// ── 변환 ──

function rowToBid(row: BidRow): Bid {
  return {
    id: row.id,
    source: row.source as Bid['source'],
    sourceId: row.source_id,
    name: row.name,
    org: row.org,
    orgCode: row.org_code,
    baseAmount: row.base_amount,
    predeterminedPrice: row.predetermined_price,
    preliminaryPrices: row.preliminary_prices,
    assessmentRate: row.assessment_rate,
    noticeDate: row.notice_date,
    openDate: row.open_date,
    bidMethod: row.bid_method,
    region: row.region,
    createdAt: row.created_at,
  }
}

function newBidToRow(bid: NewBid) {
  return {
    source: bid.source,
    source_id: bid.sourceId,
    name: bid.name,
    org: bid.org,
    org_code: bid.orgCode,
    base_amount: bid.baseAmount,
    predetermined_price: bid.predeterminedPrice,
    preliminary_prices: bid.preliminaryPrices,
    assessment_rate: bid.assessmentRate,
    notice_date: bid.noticeDate,
    open_date: bid.openDate,
    bid_method: bid.bidMethod,
    region: bid.region,
    updated_at: new Date().toISOString(),
  }
}

// ── 조회 ──

const FETCH_PAGE_SIZE = 1000 // Supabase 기본 응답 상한

/** 응답 상한에서 잘리지 않도록 끝까지 페이지 단위로 읽는다. 쿼리는 정렬이 유일해야 한다. */
async function fetchAllRows<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  label: string,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += FETCH_PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + FETCH_PAGE_SIZE - 1)
    if (error) throw new Error(`${label} 실패: ${error.message}`)
    const page = data as T[]
    rows.push(...page)
    if (page.length < FETCH_PAGE_SIZE) return rows
  }
}

// ── 공개 API ──

/** source_id 기준 upsert. 새 건 삽입, 기존 건 갱신. */
export async function upsertBids(bids: NewBid[]): Promise<Bid[]> {
  if (bids.length === 0) return []

  // 같은 batch 내 source_id 중복 제거 (마지막 건 유지)
  const deduped = new Map<string, NewBid>()
  for (const bid of bids) deduped.set(bid.sourceId, bid)
  const rows = [...deduped.values()].map(newBidToRow)
  const { data, error } = await getSupabase()
    .from('bids')
    .upsert(rows, { onConflict: 'source_id' })
    .select()

  if (error) throw new Error(`upsertBids 실패: ${error.message}`)
  return (data as BidRow[]).map(rowToBid)
}

/** 분석 대상 낙찰방법의 Bid 전체 조회 */
export async function getAllBids(): Promise<Bid[]> {
  const rows = await fetchAllRows<BidRow>(
    (from, to) =>
      getSupabase()
        .from('bids')
        .select()
        .in('bid_method', [...ANALYSIS_METHODS])
        .order('notice_date', { ascending: false })
        .order('source_id')
        .range(from, to),
    'getAllBids',
  )
  return rows.map(rowToBid)
}

const ID_CHUNK_SIZE = 200 // URL 길이 제한 안에서 나눠 조회

async function collectBidIds(
  ids: string[],
  label: string,
  fetchChunk: (
    chunk: string[],
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<Set<string>> {
  const found = new Set<string>()
  for (let i = 0; i < ids.length; i += ID_CHUNK_SIZE) {
    const { data, error } = await fetchChunk(ids.slice(i, i + ID_CHUNK_SIZE))
    if (error) throw new Error(`${label} 실패: ${error.message}`)
    for (const row of data as { source_id: string }[]) found.add(row.source_id)
  }
  return found
}

/** 이미 저장된 공고번호 */
export function getExistingBidIds(ids: string[]): Promise<Set<string>> {
  return collectBidIds(ids, 'getExistingBidIds', (chunk) =>
    getSupabase().from('bids').select('source_id').in('source_id', chunk),
  )
}

/** 사정률과 낙찰방법까지 저장되어 다시 받을 필요가 없는 공고번호 */
export function getCompleteBidIds(ids: string[]): Promise<Set<string>> {
  return collectBidIds(ids, 'getCompleteBidIds', (chunk) =>
    getSupabase()
      .from('bids')
      .select('source_id')
      .in('source_id', chunk)
      .not('assessment_rate', 'is', null)
      .neq('bid_method', '미확인'),
  )
}

/** 오늘 날짜 기준 분석 결과 upsert */
export async function saveAnalysisResult(result: AnalysisSnapshot): Promise<void> {
  const { error } = await getSupabase()
    .from('analysis_results')
    .upsert({ computed_date: todayKst(), result }, { onConflict: 'computed_date' })

  if (error) throw new Error(`saveAnalysisResult 실패: ${error.message}`)
}

/** 최신 분석 결과 + 계산일 조회. 낙찰방법이 섞인 과거 형식의 스냅샷은 없는 것으로 본다. */
export async function getLatestAnalysisWithDate(): Promise<{
  snapshot: AnalysisSnapshot
  computedDate: string
} | null> {
  const { data, error } = await getSupabase()
    .from('analysis_results')
    .select('result, computed_date')
    .order('computed_date', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    // PGRST116 = no rows
    if (error.code === 'PGRST116') return null
    throw new Error(`getLatestAnalysisWithDate 실패: ${error.message}`)
  }

  const snapshot = data.result as AnalysisSnapshot
  if (!snapshot.methods) return null

  return { snapshot, computedDate: data.computed_date as string }
}

/** 사정률 추이 데이터 조회 (assessmentRate not null만) */
export async function getBidsForTrend(
  method: AnalysisMethod,
  filter: { orgCode?: string; region?: string } = {},
): Promise<{ date: string; rate: number; sourceId: string; name: string }[]> {
  const rows = await fetchAllRows<{
    notice_date: string
    assessment_rate: number
    source_id: string
    name: string
  }>((from, to) => {
    let query = getSupabase()
      .from('bids')
      .select('notice_date, assessment_rate, org_code, source_id, name')
      .not('assessment_rate', 'is', null)
      .eq('bid_method', method)

    if (filter.orgCode) {
      query = query.eq('org_code', filter.orgCode)
    }
    if (filter.region) {
      query = query.eq('region', filter.region)
    }

    return query.order('notice_date', { ascending: true }).order('source_id').range(from, to)
  }, 'getBidsForTrend')

  return rows.map((row) => ({
    date: row.notice_date,
    rate: row.assessment_rate,
    sourceId: row.source_id,
    name: row.name,
  }))
}

/** API 원본 응답 저장 */
export async function saveRawResponse(
  source: string,
  endpoint: string,
  params: Record<string, unknown> | null,
  body: unknown,
): Promise<void> {
  const { error } = await getSupabase()
    .from('raw_responses')
    .insert({ source, endpoint, params, response_body: body })

  if (error) throw new Error(`saveRawResponse 실패: ${error.message}`)
}
