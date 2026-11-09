import Link from 'next/link'
import { ALL_REGIONS, HOME_REGION, type AnalysisMethod, type RegionResult } from '@/lib/types'
import { methodHref } from './MethodTabs'

interface Props {
  path: string
  method: AnalysisMethod
  region: string // 고른 지역. 기본은 HOME_REGION, 전체는 ALL_REGIONS
  regions: Record<string, RegionResult>
  total: number
}

const chip = (selected: boolean) =>
  `rounded-lg border px-3 py-2 text-center text-base ${
    selected
      ? 'border-blue-600 bg-blue-50 font-semibold text-blue-700'
      : 'text-gray-700 hover:bg-gray-50'
  }`

export function RegionFilter({ path, method, region, regions, total }: Props) {
  const count = (name: string) =>
    name === ALL_REGIONS ? total : (regions[name]?.overall.total ?? 0)
  const others = Object.entries(regions)
    .filter(([name]) => name !== HOME_REGION)
    .sort((a, b) => b[1].overall.total - a[1].overall.total)

  return (
    // key: 지역을 고른 뒤 다시 접히도록 새로 그린다
    <details key={region} className="rounded-lg border">
      <summary className="cursor-pointer p-3 text-lg font-medium">
        <span className="text-base font-normal text-gray-500">공사현장 지역: </span>
        {region} {count(region)}건
        {region === HOME_REGION && (
          <span className="text-base font-normal text-gray-500"> (기본)</span>
        )}
      </summary>
      <div className="flex flex-col gap-3 p-3 pt-0">
        <div>
          <p className="mb-2 text-sm text-gray-500">기본</p>
          <Link
            href={methodHref(path, method)}
            aria-current={region === HOME_REGION ? 'page' : undefined}
            className={`block ${chip(region === HOME_REGION)}`}
          >
            {HOME_REGION} {count(HOME_REGION)}건
          </Link>
        </div>
        <div>
          <p className="mb-2 text-sm text-gray-500">참고 지역</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Link
              href={methodHref(path, method, ALL_REGIONS)}
              aria-current={region === ALL_REGIONS ? 'page' : undefined}
              className={chip(region === ALL_REGIONS)}
            >
              {ALL_REGIONS} {total}건
            </Link>
            {others.map(([name, result]) => (
              <Link
                key={name}
                href={methodHref(path, method, name)}
                aria-current={region === name ? 'page' : undefined}
                className={chip(region === name)}
              >
                {name} {result.overall.total}건
              </Link>
            ))}
          </div>
        </div>
      </div>
    </details>
  )
}

/** 기본 지역이 아닌 자료를 보고 있을 때 띄우는 안내 */
export function RegionNotice({
  path,
  method,
  region,
}: {
  path: string
  method: AnalysisMethod
  region: string
}) {
  if (region === HOME_REGION) return null
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-gray-100 px-4 py-3">
      <p className="text-base text-gray-700">
        <span className="font-semibold">참고용</span>: 기본 지역({HOME_REGION})이 아닌{' '}
        {region === ALL_REGIONS ? '전체 지역' : region} 자료입니다
      </p>
      <Link
        href={methodHref(path, method)}
        className="shrink-0 rounded-lg border border-blue-600 bg-white px-3 py-2 text-base font-medium text-blue-700 hover:bg-blue-50"
      >
        {HOME_REGION}로
      </Link>
    </div>
  )
}
