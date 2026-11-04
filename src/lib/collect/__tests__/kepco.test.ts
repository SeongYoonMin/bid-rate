import { fetchKepcoBids, kepcoItemToBid } from '../kepco'

describe('fetchKepcoBids', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('요청에는 키를 쓰고 원본 저장 파라미터에는 넘기지 않는다', async () => {
    const requested: string[] = []
    vi.stubGlobal('fetch', async (url: string) => {
      requested.push(url)
      return { ok: true, json: async () => ({ data: [] }) }
    })
    const saved: unknown[] = []

    await fetchKepcoBids('SECRET-KEY', '20260101', '20260102', {
      onRawResponse: (_endpoint, params) => saved.push(params),
    })

    expect(requested[0]).toContain('SECRET-KEY')
    expect(saved).toHaveLength(1)
    expect(JSON.stringify(saved)).not.toContain('SECRET-KEY')
  })
})

function makeKepcoItem(overrides: Record<string, unknown> = {}) {
  return {
    no: 'KEPCO-2026-001',
    name: '테스트 한전 전기공사',
    placeName: '한국전력공사 서울지사',
    companyId: 'COM01',
    itemType: 'Construction',
    bidType: 'QualifiedEval',
    estimatedPriceBasicAmount: 500000000,
    noticeDate: '20260810',
    ...overrides,
  }
}

describe('kepcoItemToBid', () => {
  it('한전 아이템을 NewBid로 변환한다', () => {
    const bid = kepcoItemToBid(makeKepcoItem())

    expect(bid).not.toBeNull()
    expect(bid!.source).toBe('kepco')
    expect(bid!.sourceId).toBe('KEPCO-2026-001')
    expect(bid!.name).toBe('테스트 한전 전기공사')
    expect(bid!.org).toBe('한국전력공사 서울지사')
    expect(bid!.orgCode).toBe('COM01')
    expect(bid!.baseAmount).toBe(500000000)
    expect(bid!.bidMethod).toBe('적격심사')
  })

  it('예정가격·복수예비가격·사정률은 null/빈배열이다', () => {
    const bid = kepcoItemToBid(makeKepcoItem())!

    expect(bid.predeterminedPrice).toBeNull()
    expect(bid.preliminaryPrices).toEqual([])
    expect(bid.assessmentRate).toBeNull()
    expect(bid.openDate).toBeNull()
  })

  it('공고일을 YYYY-MM-DD로 변환한다', () => {
    const bid = kepcoItemToBid(makeKepcoItem())!

    expect(bid.noticeDate).toBe('2026-08-10')
  })

  it('기초금액이 없으면 null을 반환한다', () => {
    const bid = kepcoItemToBid(makeKepcoItem({ estimatedPriceBasicAmount: undefined }))

    expect(bid).toBeNull()
  })
})
