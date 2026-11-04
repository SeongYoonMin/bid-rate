import type {
  AnalysisResult,
  AnalysisSnapshot,
  Bid,
  Distribution,
  Recommendation,
  RegionResult,
} from '../types'
import { blendDistributions } from './correction'
import { computeDistribution, computeDistributionByOrg } from './distribution'
import { computePrediction } from './prediction'

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

/** Bid[] → 시도별 분석 결과. 사정률이 없거나 지역을 모르는 공고는 빠진다. */
function computeRegions(bids: Bid[]): Record<string, RegionResult> {
  const groups = new Map<string, Bid[]>()
  for (const bid of bids) {
    if (bid.region === null || bid.assessmentRate == null) continue
    groups.set(bid.region, [...(groups.get(bid.region) ?? []), bid])
  }

  const regions: Record<string, RegionResult> = {}
  for (const [region, group] of groups) {
    const overall = computeDistribution(group)
    regions[region] = {
      overall,
      recommendations: computeRecommendations(overall),
      prediction: computePrediction(group),
    }
  }
  return regions
}

/** Bid[] → 낙찰방법별 분석 결과 (순수 함수). 대상이 아닌 낙찰방법은 빠진다. */
export function computeByMethod(bids: Bid[]): AnalysisSnapshot {
  const analyze = (method: string): AnalysisResult => {
    const target = bids.filter((b) => b.bidMethod === method)
    return {
      ...computeAll(target),
      prediction: computePrediction(target),
      regions: computeRegions(target),
    }
  }
  return { methods: { 적격심사: analyze('적격심사'), 소액수의견적: analyze('소액수의견적') } }
}
