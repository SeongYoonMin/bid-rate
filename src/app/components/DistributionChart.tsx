'use client'

import { ResponsiveBar } from '@nivo/bar'
import type { BinCount, Recommendation } from '@/lib/types'

interface Props {
  bins: BinCount[]
  total: number
  recommendations?: Recommendation[]
}

export function DistributionChart({ bins, total, recommendations = [] }: Props) {
  const recBins = new Set(recommendations.map((r) => r.binStart))

  const data = bins.map((bin) => ({
    bin: `${bin.binStart.toFixed(2)}%`,
    binStart: bin.binStart,
    건수: bin.count,
  }))

  return (
    <div className="h-64 w-full">
      <ResponsiveBar
        data={data}
        keys={['건수']}
        indexBy="bin"
        margin={{ top: 8, right: 16, bottom: 56, left: 48 }}
        padding={0.2}
        colors={(bar) => {
          const d = bar.data as (typeof data)[number]
          return recBins.has(d.binStart) ? '#2563eb' : '#d1d5db'
        }}
        axisBottom={{
          tickRotation: -45,
          legend: '사정률 구간 (%)',
          legendPosition: 'middle',
          legendOffset: 48,
        }}
        axisLeft={{
          legend: '건수',
          legendPosition: 'middle',
          legendOffset: -40,
        }}
        tooltip={({ data: d, value }) => (
          <div className="bg-white px-3 py-2 rounded shadow text-sm border">
            <strong>{(d as (typeof data)[number]).bin}</strong>: {value}건 (
            {total > 0 ? ((value / total) * 100).toFixed(1) : 0}%)
          </div>
        )}
        enableLabel={false}
        animate={false}
      />
    </div>
  )
}
