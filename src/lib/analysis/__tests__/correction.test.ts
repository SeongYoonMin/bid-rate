import type { Distribution } from '../../types'
import { blendDistributions } from '../correction'

function makeDist(bins: [number, number][], total?: number): Distribution {
  return {
    bins: bins.map(([binStart, count]) => ({ binStart, count })),
    total: total ?? bins.reduce((sum, [, c]) => sum + c, 0),
  }
}

describe('blendDistributions', () => {
  it('org가 빈 분포면 overall을 그대로 반환', () => {
    const overall = makeDist([
      [0.5, 10],
      [0.75, 5],
    ])
    const org = makeDist([])
    const result = blendDistributions(overall, org)
    expect(result).toBe(overall)
  })

  it('overall이 빈 분포면 org를 그대로 반환', () => {
    const overall = makeDist([])
    const org = makeDist([[0.5, 3]])
    const result = blendDistributions(overall, org)
    expect(result).toBe(org)
  })

  it('결과 total은 orgTotal + k', () => {
    const overall = makeDist([[0.5, 100]])
    const org = makeDist([[0.5, 10]])
    const result = blendDistributions(overall, org, 30)
    expect(result.total).toBe(40) // 10 + 30
  })

  it('합집합 구간을 포함한다', () => {
    const overall = makeDist([
      [0.25, 50],
      [0.5, 50],
    ])
    const org = makeDist([
      [0.5, 5],
      [0.75, 5],
    ])
    const result = blendDistributions(overall, org, 30)
    const binStarts = result.bins.map((b) => b.binStart)
    expect(binStarts).toContain(0.25)
    expect(binStarts).toContain(0.5)
    expect(binStarts).toContain(0.75)
  })

  it('확률 합이 약 1.0', () => {
    const overall = makeDist([
      [0.25, 30],
      [0.5, 40],
      [0.75, 30],
    ])
    const org = makeDist([
      [0.5, 8],
      [0.75, 2],
    ])
    const result = blendDistributions(overall, org, 30)
    const probSum = result.bins.reduce((s, b) => s + b.count / result.total, 0)
    expect(probSum).toBeCloseTo(1.0, 2)
  })

  it('k가 클수록 overall에 가까워진다', () => {
    const overall = makeDist([[0.5, 100]])
    const org = makeDist([[0.75, 10]])

    const smallK = blendDistributions(overall, org, 10)
    const largeK = blendDistributions(overall, org, 1000)

    // largeK에서 0.5 구간(overall 쪽) 비중이 더 큼
    const smallK_05 = smallK.bins.find((b) => b.binStart === 0.5)
    const largeK_05 = largeK.bins.find((b) => b.binStart === 0.5)
    expect(largeK_05!.count / largeK.total).toBeGreaterThan(smallK_05!.count / smallK.total)
  })

  it('bins는 binStart 오름차순 정렬', () => {
    const overall = makeDist([
      [0.75, 10],
      [0.25, 10],
    ])
    const org = makeDist([[0.5, 5]])
    const result = blendDistributions(overall, org)
    const starts = result.bins.map((b) => b.binStart)
    expect(starts).toEqual([...starts].sort((a, b) => a - b))
  })
})
