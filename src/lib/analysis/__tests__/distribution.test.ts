import type { Bid } from '../../types'
import {
  computeDistribution,
  computeDistributionByOrg,
  toBinStart,
  toDisplayRate,
} from '../distribution'

/** 테스트용 최소 Bid 생성 */
function makeBid(overrides: Partial<Bid> = {}): Bid {
  return {
    id: '1',
    source: 'g2b',
    sourceId: 'TEST001',
    name: '테스트 공사',
    org: '테스트 기관',
    orgCode: 'ORG01',
    baseAmount: 100_000_000,
    predeterminedPrice: 100_799_800,
    preliminaryPrices: [],
    assessmentRate: 1.007998,
    noticeDate: '2026-01-01',
    openDate: null,
    bidMethod: '적격심사',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('toDisplayRate', () => {
  it('비율 1.007998 → 0.7998', () => {
    const result = toDisplayRate(1.007998)
    expect(result).toBeCloseTo(0.7998, 4)
  })

  it('비율 1.0 → 0.0', () => {
    expect(toDisplayRate(1.0)).toBeCloseTo(0, 4)
  })

  it('비율 0.995 → -0.5 (음수)', () => {
    expect(toDisplayRate(0.995)).toBeCloseTo(-0.5, 4)
  })
})

describe('toBinStart', () => {
  it('0.7998 → 0.75 (binWidth=0.25)', () => {
    expect(toBinStart(0.7998)).toBeCloseTo(0.75, 4)
  })

  it('0.25 → 0.25 (경계값)', () => {
    expect(toBinStart(0.25)).toBeCloseTo(0.25, 4)
  })

  it('음수: -0.3 → -0.5', () => {
    expect(toBinStart(-0.3)).toBeCloseTo(-0.5, 4)
  })

  it('커스텀 binWidth=0.5', () => {
    expect(toBinStart(0.7998, 0.5)).toBeCloseTo(0.5, 4)
  })
})

describe('computeDistribution', () => {
  it('빈 배열 → total 0, bins 빈 배열', () => {
    const result = computeDistribution([])
    expect(result.total).toBe(0)
    expect(result.bins).toEqual([])
  })

  it('assessmentRate가 null인 Bid는 제외', () => {
    const bids = [makeBid({ assessmentRate: null }), makeBid({ assessmentRate: 1.005 })]
    const result = computeDistribution(bids)
    expect(result.total).toBe(1)
  })

  it('같은 구간의 Bid는 하나의 bin으로 집계', () => {
    const bids = [
      makeBid({ assessmentRate: 1.006 }), // 0.6% → bin 0.5
      makeBid({ assessmentRate: 1.007 }), // 0.7% → bin 0.5
    ]
    const result = computeDistribution(bids)
    expect(result.total).toBe(2)
    expect(result.bins).toHaveLength(1)
    expect(result.bins[0].count).toBe(2)
  })

  it('다른 구간의 Bid는 별도 bin', () => {
    const bids = [
      makeBid({ assessmentRate: 1.006 }), // 0.6% → bin 0.5
      makeBid({ assessmentRate: 1.003 }), // 0.3% → bin 0.25
    ]
    const result = computeDistribution(bids)
    expect(result.total).toBe(2)
    expect(result.bins).toHaveLength(2)
  })

  it('bins는 binStart 오름차순 정렬', () => {
    const bids = [
      makeBid({ assessmentRate: 1.008 }), // bin 0.75
      makeBid({ assessmentRate: 1.003 }), // bin 0.25
      makeBid({ assessmentRate: 1.006 }), // bin 0.5
    ]
    const result = computeDistribution(bids)
    const starts = result.bins.map((b) => b.binStart)
    expect(starts).toEqual([...starts].sort((a, b) => a - b))
  })
})

describe('computeDistributionByOrg', () => {
  it('빈 배열 → 빈 객체', () => {
    expect(computeDistributionByOrg([])).toEqual({})
  })

  it('orgCode별로 분리 집계', () => {
    const bids = [
      makeBid({ orgCode: 'A', assessmentRate: 1.005 }),
      makeBid({ orgCode: 'A', assessmentRate: 1.006 }),
      makeBid({ orgCode: 'B', assessmentRate: 1.005 }),
    ]
    const result = computeDistributionByOrg(bids)
    expect(Object.keys(result)).toHaveLength(2)
    expect(result['A'].total).toBe(2)
    expect(result['B'].total).toBe(1)
  })

  it('assessmentRate가 null인 orgCode는 결과에 미포함', () => {
    const bids = [makeBid({ orgCode: 'A', assessmentRate: null })]
    const result = computeDistributionByOrg(bids)
    expect(Object.keys(result)).toHaveLength(0)
  })
})
