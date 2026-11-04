import type { Bid } from '../../types'
import { computePrediction } from '../prediction'

function makeBid(displayRate: number | null, openDate: string | null): Bid {
  return {
    id: '1',
    source: 'g2b',
    sourceId: 'TEST',
    name: '테스트',
    org: '기관',
    orgCode: 'ORG',
    baseAmount: 100_000_000,
    predeterminedPrice: null,
    preliminaryPrices: [],
    assessmentRate: displayRate === null ? null : 1 + displayRate / 100,
    noticeDate: '2026-01-01',
    openDate,
    bidMethod: '적격심사',
    region: null,
    createdAt: '2026-01-01T00:00:00Z',
  }
}

const day = (d: number) => `2026-01-${String(d).padStart(2, '0')} 10:00:00`

describe('computePrediction', () => {
  it('공고가 없으면 null이다', () => {
    expect(computePrediction([])).toBeNull()
    expect(computePrediction([makeBid(null, day(1)), makeBid(1, null)])).toBeNull()
  })

  it('범위는 평균 ± 표준편차 × 1.25다 (docs/decisions.md)', () => {
    const p = computePrediction([makeBid(0, day(1)), makeBid(2, day(2))])!

    expect(p.mean).toBeCloseTo(1)
    expect(p.sd).toBeCloseTo(1)
    expect(p.low).toBeCloseTo(-0.25)
    expect(p.high).toBeCloseTo(2.25)
    expect(p.total).toBe(2)
  })

  it('과거 공고가 부족하면 평가하지 않는다', () => {
    const p = computePrediction([makeBid(0, day(1)), makeBid(2, day(2))], 3)!

    expect(p.backtest.evaluated).toBe(0)
    expect(p.backtest.meanAbsError).toBeNull()
  })

  it('각 공고를 앞선 공고만으로 평가한다', () => {
    // 3번째 공고의 범위는 앞 두 건(0, 2)으로 만든 -0.25~2.25, 0 중심 범위는 -1.25~1.25
    const p = computePrediction([makeBid(1.5, day(3)), makeBid(0, day(1)), makeBid(2, day(2))], 2)!

    expect(p.backtest.evaluated).toBe(1)
    expect(p.backtest.hits).toBe(1)
    expect(p.backtest.meanAbsError).toBeCloseTo(0.5)
    expect(p.backtest.baselineMeanAbsError).toBeCloseTo(1.5)
    expect(p.backtest.baselineHits).toBe(0)
  })

  it('뒤에 온 공고는 앞선 공고의 평가를 바꾸지 않는다', () => {
    const base = [makeBid(0, day(1)), makeBid(2, day(2)), makeBid(1.5, day(3))]
    const before = computePrediction(base, 2)!
    const after = computePrediction([...base, makeBid(100, day(4))], 2)!

    expect(after.backtest.evaluated).toBe(2)
    expect(after.backtest.hits).toBe(before.backtest.hits) // 100은 범위 밖
  })

  it('개찰일시가 같은 공고끼리는 서로의 자료로 쓰지 않는다', () => {
    const p = computePrediction([makeBid(0, day(1)), makeBid(2, day(1)), makeBid(1, day(1))], 1)!

    expect(p.backtest.evaluated).toBe(0)
  })
})
