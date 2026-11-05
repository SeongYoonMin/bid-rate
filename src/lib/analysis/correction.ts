import type { BinCount, Distribution } from '../types'

const DEFAULT_K = 30

/**
 * 전체 분포와 발주처 분포를 혼합한다.
 * 비중 w = orgTotal / (orgTotal + k)
 * 결과 = w * org + (1-w) * overall (구간별)
 */
export function blendDistributions(
  overall: Distribution,
  org: Distribution,
  k: number = DEFAULT_K,
): Distribution {
  if (org.total === 0) return overall
  if (overall.total === 0) return org

  const w = org.total / (org.total + k)

  // 합집합 구간 키 수집
  const allBins = new Set<number>()
  for (const b of overall.bins) allBins.add(b.binStart)
  for (const b of org.bins) allBins.add(b.binStart)

  const overallMap = new Map<number, number>()
  for (const b of overall.bins) overallMap.set(b.binStart, b.count)

  const orgMap = new Map<number, number>()
  for (const b of org.bins) orgMap.set(b.binStart, b.count)

  // 혼합 — 확률 기준으로 섞은 뒤 total을 곱해 count로 변환
  const blendedTotal = org.total + k // 실질 표본 크기
  const bins: BinCount[] = []

  for (const binStart of allBins) {
    const overallProb = (overallMap.get(binStart) ?? 0) / overall.total
    const orgProb = (orgMap.get(binStart) ?? 0) / org.total
    const blendedProb = w * orgProb + (1 - w) * overallProb
    const count = blendedProb * blendedTotal
    if (count > 0) {
      bins.push({ binStart, count: Math.round(count * 10000) / 10000 })
    }
  }

  bins.sort((a, b) => a.binStart - b.binStart)
  return { bins, total: blendedTotal }
}
