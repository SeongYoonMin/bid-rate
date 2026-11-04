import { fetchG2bBids, g2bDetailToBid as toBidWithNotice, toBidMethod, toRegion } from '../g2b'

/** 입찰공고 정보와 무관한 변환 검증용 */
const g2bDetailToBid = (
  rows: Parameters<typeof toBidWithNotice>[0],
  item: Parameters<typeof toBidWithNotice>[1],
) => toBidWithNotice(rows, item, { bidMethod: '적격심사', region: null })

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

/** 낙찰 목록(PPSSrch) 샘플 — 발주기관은 이 응답에만 있다 */
const searchItem = { dminsttCd: '4791000', dminsttNm: '전북특별자치도 부안군' }

describe('g2bDetailToBid', () => {
  it('발주기관은 낙찰 목록의 수요기관 값을 쓴다 (docs/domain.md)', () => {
    const bid = g2bDetailToBid(makeDetailRows(), searchItem)!

    expect(bid.org).toBe('전북특별자치도 부안군')
    expect(bid.orgCode).toBe('4791000')
  })

  it('15행을 NewBid로 변환한다', () => {
    const rows = makeDetailRows()
    const bid = g2bDetailToBid(rows, searchItem)

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
    const bid = g2bDetailToBid(rows, searchItem)!

    expect(bid.assessmentRate).toBeCloseTo(1773240950 / 1797931000, 10)
  })

  it('복수예비가격 15개를 파싱한다', () => {
    const rows = makeDetailRows()
    const bid = g2bDetailToBid(rows, searchItem)!

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
    const bid = g2bDetailToBid(rows, searchItem)!
    const drawnCount = bid.preliminaryPrices.filter((p) => p.drawn).length

    expect(drawnCount).toBe(4)
  })

  it('개찰일시에서 날짜를 추출한다', () => {
    const rows = makeDetailRows()
    const bid = g2bDetailToBid(rows, searchItem)!

    expect(bid.noticeDate).toBe('2026-07-01')
    expect(bid.openDate).toBe('2026-07-01 13:14:24')
  })

  it('빈 배열이면 null을 반환한다', () => {
    expect(g2bDetailToBid([], searchItem)).toBeNull()
  })

  it('기초금액이 없으면 null을 반환한다', () => {
    const rows = makeDetailRows({ bssamt: '' })
    expect(g2bDetailToBid(rows, searchItem)).toBeNull()
  })

  it('예정가격이 없으면 assessmentRate는 null이다', () => {
    const rows = makeDetailRows({ plnprc: '' })
    const bid = g2bDetailToBid(rows, searchItem)!

    expect(bid.predeterminedPrice).toBeNull()
    expect(bid.assessmentRate).toBeNull()
  })

  it('전달받은 낙찰방법과 지역을 저장한다', () => {
    const bid = toBidWithNotice(makeDetailRows(), searchItem, {
      bidMethod: '소액수의견적',
      region: '충청북도',
    })!

    expect(bid.region).toBe('충청북도')
    expect(bid.bidMethod).toBe('소액수의견적')
  })
})

describe('fetchG2bBids', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('요청에는 키를 쓰고 원본 저장 파라미터에는 넘기지 않는다', async () => {
    const requested: string[] = []
    vi.stubGlobal('fetch', async (url: string) => {
      requested.push(url)
      return {
        ok: true,
        json: async () => ({
          response: {
            header: { resultCode: '00', resultMsg: '정상' },
            body: {
              items: [{ bidNtceNo: 'R26BK00000001', dminsttCd: '1', dminsttNm: '기관' }],
              numOfRows: 100,
              pageNo: 1,
              totalCount: 1,
            },
          },
        }),
      }
    })
    const saved: unknown[] = []

    await fetchG2bBids('SECRET-A', 'SECRET-B', '202601010000', '202601022359', {
      onRawResponse: (_endpoint, params) => saved.push(params),
    })

    const urls = requested.join(' ')
    expect(urls).toContain('SECRET-A')
    expect(urls).toContain('SECRET-B')
    expect(saved).toHaveLength(3) // 목록, 예비가격상세, 입찰공고
    expect(JSON.stringify(saved)).not.toContain('SECRET')
  })
})

describe('toRegion', () => {
  it('공사현장 지역명의 첫 단어를 시도로 쓴다', () => {
    expect(toRegion('충청북도 청주시')).toBe('충청북도')
    expect(toRegion('부산광역시')).toBe('부산광역시')
  })

  it('값이 없으면 null이다', () => {
    expect(toRegion(undefined)).toBeNull()
    expect(toRegion('  ')).toBeNull()
  })
})

describe('toBidMethod', () => {
  it('실제 낙찰방법명의 앞부분으로 분류한다', () => {
    expect(
      toBidMethod(
        '적격심사제-추정가격이 2억원 미만인 입찰공사 평가기준 (실적제한 아님, 그 밖의 공사)',
      ),
    ).toBe('적격심사')
    expect(
      toBidMethod(
        '소액수의견적-소액수의견적(2인 이상 견적 제출)-국민연금보험료 등 합산액 감액 적용',
      ),
    ).toBe('소액수의견적')
    expect(toBidMethod('최저가낙찰제-최저가낙찰자')).toBe('최저가낙찰제')
  })

  it('이름이 없으면 미확인이다', () => {
    expect(toBidMethod(undefined)).toBe('미확인')
    expect(toBidMethod('')).toBe('미확인')
  })
})
