import { g2bDetailToBid } from '../g2b'

/** 15행 예비가격상세 샘플 생성 */
function makeDetailRows(overrides: Record<string, string> = {}) {
  return Array.from({ length: 15 }, (_, i) => ({
    bidNtceNo: 'R26BK01642721',
    bidNtceOrd: '000',
    bidNtceNm: '테스트 전기공사',
    plnprc: '1773240950',
    bssamt: '1797931000',
    totRsrvtnPrceNum: '15',
    compnoRsrvtnPrceSno: String(i + 1),
    bsisPlnprc: String(1770000000 + i * 1000000),
    drwtYn: i < 4 ? 'Y' : 'N', // 처음 4개 추첨
    rlOpengDt: '2026-07-01 13:14:24',
    ...overrides,
  }))
}

describe('g2bDetailToBid', () => {
  it('15행을 NewBid로 변환한다', () => {
    const rows = makeDetailRows()
    const bid = g2bDetailToBid(rows)

    expect(bid).not.toBeNull()
    expect(bid!.source).toBe('g2b')
    expect(bid!.sourceId).toBe('R26BK01642721')
    expect(bid!.name).toBe('테스트 전기공사')
    expect(bid!.baseAmount).toBe(1797931000)
    expect(bid!.predeterminedPrice).toBe(1773240950)
    expect(bid!.bidMethod).toBe('적격심사')
  })

  it('사정률을 계산한다 (predeterminedPrice / baseAmount)', () => {
    const rows = makeDetailRows()
    const bid = g2bDetailToBid(rows)!

    expect(bid.assessmentRate).toBeCloseTo(1773240950 / 1797931000, 10)
  })

  it('복수예비가격 15개를 파싱한다', () => {
    const rows = makeDetailRows()
    const bid = g2bDetailToBid(rows)!

    expect(bid.preliminaryPrices).toHaveLength(15)
    expect(bid.preliminaryPrices[0]).toEqual({
      seq: 1,
      price: 1770000000,
      drawn: true,
    })
    expect(bid.preliminaryPrices[4]).toEqual({
      seq: 5,
      price: 1774000000,
      drawn: false,
    })
  })

  it('추첨된 항목이 정확히 4개다', () => {
    const rows = makeDetailRows()
    const bid = g2bDetailToBid(rows)!
    const drawnCount = bid.preliminaryPrices.filter((p) => p.drawn).length

    expect(drawnCount).toBe(4)
  })

  it('개찰일시에서 날짜를 추출한다', () => {
    const rows = makeDetailRows()
    const bid = g2bDetailToBid(rows)!

    expect(bid.noticeDate).toBe('2026-07-01')
    expect(bid.openDate).toBe('2026-07-01 13:14:24')
  })

  it('빈 배열이면 null을 반환한다', () => {
    expect(g2bDetailToBid([])).toBeNull()
  })

  it('기초금액이 없으면 null을 반환한다', () => {
    const rows = makeDetailRows({ bssamt: '' })
    expect(g2bDetailToBid(rows)).toBeNull()
  })

  it('예정가격이 없으면 assessmentRate는 null이다', () => {
    const rows = makeDetailRows({ plnprc: '' })
    const bid = g2bDetailToBid(rows)!

    expect(bid.predeterminedPrice).toBeNull()
    expect(bid.assessmentRate).toBeNull()
  })
})
