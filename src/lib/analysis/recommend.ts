import type { AnalysisResult, AnalysisSnapshot, Bid, Distribution, Recommendation } from '../types'
import { blendDistributions } from './correction'
import { computeDistribution, computeDistributionByOrg } from './distribution'

const DEFAULT_TOP_N = 3

/** 분포 → 확률 순 상위 N개 추천 */
export function computeRecommendations(
  dist: Distribution,
  topN: number = DEFAULT_TOP_N,
): Recommendation[] {
  if (dist.total === 0) return []

  return dist.bins
    .map((b) => ({
      binStart: b.binStart,
      probability: b.count / dist.total,
    }))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, topN)
}

/** Bid[] → 전체 분석 결과 (순수 함수) */
export function computeAll(bids: Bid[]): AnalysisResult {
  const overall = computeDistribution(bids)
  const byOrg = computeDistributionByOrg(bids)

  const recommendations: Record<string, Recommendation[]> = {
    overall: computeRecommendations(overall),
  }

  for (const [orgCode, orgDist] of Object.entries(byOrg)) {
    const blended = blendDistributions(overall, orgDist)
    recommendations[orgCode] = computeRecommendations(blended)
  }

  const orgNames: Record<string, string> = {}
  for (const bid of bids) {
    if (bid.orgCode in byOrg && !(bid.orgCode in orgNames)) orgNames[bid.orgCode] = bid.org
  }

  return { overall, byOrg, orgNames, recommendations }
}

/** Bid[] → 낙찰방법별 분석 결과 (순수 함수). 대상이 아닌 낙찰방법은 빠진다. */
export function computeByMethod(bids: Bid[]): AnalysisSnapshot {
  return {
    methods: {
      적격심사: computeAll(bids.filter((b) => b.bidMethod === '적격심사')),
      소액수의견적: computeAll(bids.filter((b) => b.bidMethod === '소액수의견적')),
    },
  }
}
