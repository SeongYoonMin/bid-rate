import type { Bid, BinCount, Distribution } from '../types'

export const DEFAULT_BIN_WIDTH = 0.25

/** 저장 비율 → 화면 표시값 (예: 1.007998 → 0.7998) */
export function toDisplayRate(assessmentRate: number): number {
  return (assessmentRate - 1) * 100
}

/** 화면 표시값 → 구간 시작값 (예: 0.7998 → 0.75, binWidth=0.25) */
export function toBinStart(displayRate: number, binWidth: number = DEFAULT_BIN_WIDTH): number {
  return Math.floor(displayRate / binWidth) * binWidth
}

/** Bid[] → 전체 분포 (assessmentRate가 있는 건만 집계) */
export function computeDistribution(
  bids: Bid[],
  binWidth: number = DEFAULT_BIN_WIDTH,
): Distribution {
  const counts = new Map<number, number>()
  let total = 0

  for (const bid of bids) {
    if (bid.assessmentRate == null) continue
    const display = toDisplayRate(bid.assessmentRate)
    const bin = toBinStart(display, binWidth)
    // 부동소수점 보정: 소수점 4자리 반올림
    const key = Math.round(bin * 10000) / 10000
    counts.set(key, (counts.get(key) ?? 0) + 1)
    total++
  }

  const bins: BinCount[] = [...counts.entries()]
    .map(([binStart, count]) => ({ binStart, count }))
    .sort((a, b) => a.binStart - b.binStart)

  return { bins, total }
}

/** Bid[] → 발주처(orgCode)별 분포 */
export function computeDistributionByOrg(
  bids: Bid[],
  binWidth: number = DEFAULT_BIN_WIDTH,
): Record<string, Distribution> {
  const groups = new Map<string, Bid[]>()

  for (const bid of bids) {
    if (bid.assessmentRate == null) continue
    const list = groups.get(bid.orgCode) ?? []
    list.push(bid)
    groups.set(bid.orgCode, list)
  }

  const result: Record<string, Distribution> = {}
  for (const [orgCode, orgBids] of groups) {
    result[orgCode] = computeDistribution(orgBids, binWidth)
  }
  return result
}
