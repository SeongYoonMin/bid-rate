import Link from 'next/link'
import { ANALYSIS_METHODS, type AnalysisMethod } from '@/lib/types'

const LABELS: Record<AnalysisMethod, string> = {
  적격심사: '적격심사',
  소액수의견적: '소액수의 견적',
}

/** URL 값 → 낙찰방법. 없거나 모르는 값이면 적격심사. */
export function parseMethod(value: string | undefined): AnalysisMethod {
  return ANALYSIS_METHODS.find((m) => m === value) ?? '적격심사'
}

export function methodHref(path: string, method: AnalysisMethod): string {
  return `${path}?method=${encodeURIComponent(method)}`
}

export function MethodTabs({ path, method }: { path: string; method: AnalysisMethod }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {ANALYSIS_METHODS.map((m) => (
        <Link
          key={m}
          href={methodHref(path, m)}
          aria-current={m === method ? 'page' : undefined}
          className={`rounded-lg border p-3 text-center text-lg font-medium ${
            m === method
              ? 'border-blue-600 bg-blue-600 text-white'
              : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          {LABELS[m]}
        </Link>
      ))}
    </div>
  )
}
