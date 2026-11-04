import { DEFAULT_BIN_WIDTH } from '@/lib/analysis/distribution'
import type { BinCount, Recommendation } from '@/lib/types'

interface Props {
  bins: BinCount[]
  total: number
  recommendations?: Recommendation[]
}

export function DistributionTable({ bins, total, recommendations = [] }: Props) {
  const recBins = new Set(recommendations.map((r) => r.binStart))

  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-base">
        <thead className="bg-gray-50 text-sm text-gray-500">
          <tr>
            <th className="px-4 py-2 text-left font-medium">구간 (%)</th>
            <th className="px-4 py-2 text-right font-medium">건수 (건)</th>
            <th className="px-4 py-2 text-right font-medium">비율 (%)</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {bins.map(({ binStart, count }) => (
            <tr key={binStart} className={recBins.has(binStart) ? 'bg-blue-50 font-semibold' : ''}>
              <td className="px-4 py-2">
                {binStart.toFixed(2)} ~ {(binStart + DEFAULT_BIN_WIDTH).toFixed(2)}
              </td>
              <td className="px-4 py-2 text-right">{count}</td>
              <td className="px-4 py-2 text-right">{((count / total) * 100).toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
