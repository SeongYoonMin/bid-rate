const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/** 한국 시간 기준 날짜 (YYYY-MM-DD). 서버 시간대와 무관하다. */
export function todayKst(now: Date = new Date()): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10)
}
