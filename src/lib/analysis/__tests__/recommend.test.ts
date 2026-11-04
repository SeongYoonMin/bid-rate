import type { Bid, Distribution } from '../../types'
import { computeAll, computeRecommendations } from '../recommend'

function makeDist(bins: [number, number][], total?: number): Distribution {
  return {
    bins: bins.map(([binStart, count]) => ({ binStart, count })),
    total: total ?? bins.reduce((sum, [, c]) => sum + c, 0),
  }
}

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

describe('computeRecommendations', () => {
  it('빈 분포 → 빈 배열', () => {
    expect(computeRecommendations(makeDist([]))).toEqual([])
  })

  it('확률 순 내림차순 정렬', () => {
    const dist = makeDist([
      [0.25, 10],
      [0.5, 30],
      [0.75, 20],
    ])
    const result = computeRecommendations(dist)
    expect(result[0].binStart).toBe(0.5)
    expect(result[1].binStart).toBe(0.75)
    expect(result[2].binStart).toBe(0.25)
  })

  it('상위 N개만 반환 (기본 3개)', () => {
    const dist = makeDist([
      [0.0, 5],
      [0.25, 10],
      [0.5, 30],
      [0.75, 20],
    ])
    const result = computeRecommendations(dist)
    expect(result).toHaveLength(3)
  })

  it('topN 파라미터 동작', () => {
    const dist = makeDist([
      [0.25, 10],
      [0.5, 30],
    ])
    const result = computeRecommendations(dist, 1)
    expect(result).toHaveLength(1)
    expect(result[0].binStart).toBe(0.5)
  })

  it('probability = count / total', () => {
    const dist = makeDist([[0.5, 25]], 100)
    const result = computeRecommendations(dist)
    expect(result[0].probability).toBeCloseTo(0.25, 4)
  })

  it('모든 probability 합 ≤ 1', () => {
    const dist = makeDist([
      [0.25, 10],
      [0.5, 30],
      [0.75, 20],
    ])
    const result = computeRecommendations(dist)
    const sum = result.reduce((s, r) => s + r.probability, 0)
    expect(sum).toBeLessThanOrEqual(1.0001)
  })
})

describe('computeAll', () => {
  it('분포가 있는 발주처의 기관명만 orgNames에 담는다', () => {
    const result = computeAll([
      makeBid({ orgCode: 'A', org: '기관A', assessmentRate: 1.005 }),
      makeBid({ orgCode: 'B', org: '기관B', assessmentRate: null }),
    ])
    expect(result.orgNames).toEqual({ A: '기관A' })
  })

  it('빈 배열 → overall total 0, 빈 recommendations', () => {
    const result = computeAll([])
    expect(result.overall.total).toBe(0)
    expect(result.overall.bins).toEqual([])
    expect(result.recommendations['overall']).toEqual([])
    expect(Object.keys(result.byOrg)).toHaveLength(0)
  })

  it('결과 구조 검증: overall, byOrg, recommendations 키 존재', () => {
    const bids = [
      makeBid({ orgCode: 'A', assessmentRate: 1.005 }),
      makeBid({ orgCode: 'B', assessmentRate: 1.007 }),
    ]
    const result = computeAll(bids)
    expect(result).toHaveProperty('overall')
    expect(result).toHaveProperty('byOrg')
    expect(result).toHaveProperty('recommendations')
    expect(result.recommendations).toHaveProperty('overall')
    expect(result.recommendations).toHaveProperty('A')
    expect(result.recommendations).toHaveProperty('B')
  })

  it('assessmentRate가 null인 Bid만 있으면 빈 결과', () => {
    const bids = [makeBid({ assessmentRate: null })]
    const result = computeAll(bids)
    expect(result.overall.total).toBe(0)
  })

  it('recommendations의 각 항목은 probability 내림차순', () => {
    const bids = [
      makeBid({ orgCode: 'A', assessmentRate: 1.003 }),
      makeBid({ orgCode: 'A', assessmentRate: 1.005 }),
      makeBid({ orgCode: 'A', assessmentRate: 1.005 }),
      makeBid({ orgCode: 'A', assessmentRate: 1.008 }),
    ]
    const result = computeAll(bids)
    const recs = result.recommendations['A']
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i - 1].probability).toBeGreaterThanOrEqual(recs[i].probability)
    }
  })
})
