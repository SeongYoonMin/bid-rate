import { todayKst } from '../date'

describe('todayKst', () => {
  it('매일 08:00 KST 실행(UTC 23:00)은 한국 날짜로 저장한다', () => {
    expect(todayKst(new Date('2026-11-05T23:00:00Z'))).toBe('2026-11-06')
  })

  it('UTC와 한국 날짜가 같은 시간대는 그대로다', () => {
    expect(todayKst(new Date('2026-11-05T14:59:59Z'))).toBe('2026-11-05')
  })

  it('한국 자정에 날짜가 바뀐다', () => {
    expect(todayKst(new Date('2026-11-05T15:00:00Z'))).toBe('2026-11-06')
  })
})
