import type { Bid, Prediction } from '../types'
import { toDisplayRate } from './distribution'

/** 적중 검증을 시작하기 전에 필요한 과거 공고 수 */
export const MIN_BACKTEST_HISTORY = 100

/** 예상 범위 폭: 평균 ± 표준편차 × 이 배수 (docs/decisions.md) */
export const RANGE_SD_MULTIPLE = 1.25

const meanOf = (n: number, sum: number) => sum / n
const sdOf = (n: number, sum: number, sumSq: number) =>
  Math.sqrt(Math.max(0, sumSq / n - (sum / n) ** 2))

/**
 * 다음 사정률 예상 범위(평균 ± 표준편차 × 배수)와 과거 적중 기록.
 * 각 공고는 개찰일시가 그보다 앞선 공고만으로 평가한다.
 */
export function computePrediction(
  bids: Bid[],
  minHistory: number = MIN_BACKTEST_HISTORY,
): Prediction | null {
  const points = bids
    .filter((b) => b.assessmentRate != null && b.openDate != null)
    .map((b) => ({ at: b.openDate as string, rate: toDisplayRate(b.assessmentRate as number) }))
    .sort((a, b) => a.at.localeCompare(b.at))
  if (points.length === 0) return null

  let n = 0
  let sum = 0
  let sumSq = 0
  let next = 0
  let evaluated = 0
  let hits = 0
  let baselineHits = 0
  let absError = 0
  let baselineAbsError = 0

  for (const { at, rate } of points) {
    while (points[next].at < at) {
      const past = points[next].rate
      n++
      sum += past
      sumSq += past * past
      next++
    }
    if (n < minHistory) continue

    const mean = meanOf(n, sum)
    const halfWidth = sdOf(n, sum, sumSq) * RANGE_SD_MULTIPLE
    evaluated++
    if (Math.abs(rate - mean) <= halfWidth) hits++
    if (Math.abs(rate) <= halfWidth) baselineHits++
    absError += Math.abs(rate - mean)
    baselineAbsError += Math.abs(rate)
  }

  const total = points.length
  const allSum = points.reduce((s, p) => s + p.rate, 0)
  const allSumSq = points.reduce((s, p) => s + p.rate * p.rate, 0)
  const mean = meanOf(total, allSum)
  const sd = sdOf(total, allSum, allSumSq)

  return {
    mean,
    sd,
    low: mean - sd * RANGE_SD_MULTIPLE,
    high: mean + sd * RANGE_SD_MULTIPLE,
    total,
    backtest: {
      evaluated,
      hits,
      baselineHits,
      meanAbsError: evaluated ? absError / evaluated : null,
      baselineMeanAbsError: evaluated ? baselineAbsError / evaluated : null,
    },
  }
}
