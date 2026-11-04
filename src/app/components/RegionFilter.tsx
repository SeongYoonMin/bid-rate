import Link from 'next/link'
import type { AnalysisMethod, RegionResult } from '@/lib/types'
import { methodHref } from './MethodTabs'

interface Props {
  method: AnalysisMethod
  region?: string
  regions: Record<string, RegionResult>
  total: number
}

const chip = (selected: boolean) =>
  `rounded-lg border px-3 py-2 text-center text-base ${
    selected
      ? 'border-blue-600 bg-blue-50 font-semibold text-blue-700'
      : 'text-gray-700 hover:bg-gray-50'
  }`

export function RegionFilter({ method, region, regions, total }: Props) {
  const entries = Object.entries(regions).sort((a, b) => b[1].overall.total - a[1].overall.total)
  const current = region ? `${region} ${regions[region]?.overall.total ?? 0}건` : `전체 ${total}건`

  return (
    // key: 지역을 고른 뒤 다시 접히도록 새로 그린다
    <details key={region ?? ''} className="rounded-lg border">
      <summary className="cursor-pointer p-3 text-lg font-medium">
        <span className="text-base font-normal text-gray-500">공사현장 지역: </span>
        {current}
      </summary>
      <div className="grid grid-cols-2 gap-2 p-3 pt-0 sm:grid-cols-4">
        <Link
          href={methodHref('/', method)}
          aria-current={region ? undefined : 'page'}
          className={chip(!region)}
        >
          전체 {total}건
        </Link>
        {entries.map(([name, result]) => (
          <Link
            key={name}
            href={methodHref('/', method, name)}
            aria-current={region === name ? 'page' : undefined}
            className={chip(region === name)}
          >
            {name} {result.overall.total}건
          </Link>
        ))}
      </div>
    </details>
  )
}
