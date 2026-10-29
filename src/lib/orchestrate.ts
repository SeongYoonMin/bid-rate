import { computeAll } from './analysis/recommend'
import { fetchG2bBids } from './collect/g2b'
import { fetchKepcoBids } from './collect/kepco'
import { getAllBids, saveAnalysisResult, saveRawResponse, upsertBids } from './db'

const COLLECT_DAYS = 30

/** DB 전체 Bid 조회 → 분석 → 결과 저장 */
export async function recomputeAll(): Promise<void> {
  const bids = await getAllBids()
  const result = computeAll(bids)
  await saveAnalysisResult(result)
}

/** 한전+나라장터 수집 → upsert → 재분석 */
export async function collectAndRecompute(): Promise<{ bidsCount: number }> {
  const g2bKey = process.env.G2B_API_KEY
  const kepcoKey = process.env.KEPCO_API_KEY
  if (!g2bKey || !kepcoKey) {
    throw new Error('G2B_API_KEY와 KEPCO_API_KEY 환경변수가 필요합니다.')
  }

  const now = new Date()
  const begin = new Date(now)
  begin.setDate(begin.getDate() - COLLECT_DAYS)

  // 나라장터: YYYYMMDDHHmm
  const g2bBegin = formatG2bDate(begin)
  const g2bEnd = formatG2bDate(now)

  // 한전: YYYYMMDD
  const kepcoBegin = formatKepcoDate(begin)
  const kepcoEnd = formatKepcoDate(now)

  const g2bRaw = makeRawResponseCallback('g2b')
  const kepcoRaw = makeRawResponseCallback('kepco')

  const [g2bBids, kepcoBids] = await Promise.all([
    fetchG2bBids(g2bKey, g2bBegin, g2bEnd, { onRawResponse: g2bRaw }),
    fetchKepcoBids(kepcoKey, kepcoBegin, kepcoEnd, { onRawResponse: kepcoRaw }),
  ])

  const allNew = [...g2bBids, ...kepcoBids]
  await upsertBids(allNew)

  await recomputeAll()

  return { bidsCount: allNew.length }
}

// ── 원본 응답 저장 콜백 ──

export function makeRawResponseCallback(source: string) {
  return (endpoint: string, params: Record<string, unknown> | null, body: unknown) => {
    // fire-and-forget — 원본 저장 실패가 수집을 막지 않는다
    saveRawResponse(source, endpoint, params, body).catch((e) =>
      console.warn(`[${source}] 원본 응답 저장 실패:`, e),
    )
  }
}

// ── 날짜 포맷 ──

function formatG2bDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}${m}${day}${h}${min}`
}

function formatKepcoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}
