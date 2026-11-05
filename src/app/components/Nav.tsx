'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/', label: '오늘의 추천' },
  { href: '/org', label: '발주처 분석' },
  { href: '/history', label: '적중 기록' },
] as const

export function Nav() {
  const pathname = usePathname()

  return (
    <nav className="border-b bg-white">
      <div className="max-w-3xl mx-auto px-4 flex gap-1">
        {links.map(({ href, label }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`px-3 py-3 text-base font-medium border-b-2 ${
                active
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
