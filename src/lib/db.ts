import type { AnalysisResult, Bid, NewBid, PreliminaryPrice } from './types'
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
    updated_at: new Date().toISOString(),
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

/** 적격심사 Bid 전체 조회 */
export async function getAllBids(): Promise<Bid[]> {
  const { data, error } = await getSupabase()
    .from('bids')
    .select()
    .eq('bid_method', '적격심사')
    .order('notice_date', { ascending: false })

  if (error) throw new Error(`getAllBids 실패: ${error.message}`)
  return (data as BidRow[]).map(rowToBid)
}

/** 오늘 날짜 기준 분석 결과 upsert */
export async function saveAnalysisResult(result: AnalysisResult): Promise<void> {
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const { error } = await getSupabase()
    .from('analysis_results')
    .upsert({ computed_date: today, result }, { onConflict: 'computed_date' })

  if (error) throw new Error(`saveAnalysisResult 실패: ${error.message}`)
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
