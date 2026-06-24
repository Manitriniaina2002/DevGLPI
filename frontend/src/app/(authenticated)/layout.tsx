'use client'

import { ReactNode, useEffect, useRef, useState } from 'react'
import { LogOut, Settings } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { HeaderActionsProvider } from '@/app/(authenticated)/header-actions-context'

export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [headerActions, setHeaderActions] = useState<ReactNode | null>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [pathname])

  const handleReturn = () => {
    window.location.href = 'https://154.126.56.85:1443/'
  }

  return (
    <HeaderActionsProvider value={{ setHeaderActions }}>
      <div className="h-dvh overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(76,139,64,0.14),transparent_20%)_top_left,_linear-gradient(180deg,_#f3f7f1_0%,_#eef3e8_100%)]">
        <div className="flex h-full min-w-0 flex-col overflow-hidden">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-sm">
            <div className="flex flex-col gap-3 px-3 py-3 sm:px-4 sm:grid sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:gap-3 sm:px-6">
              <div className="flex items-center gap-2">
                <img src="/logo-ades.png" alt="ADES" className="h-12 w-auto" />
                <div className="hidden sm:block">
                  {/* <h1 className="text-lg font-bold text-neutral-900">GLPI Dashboard</h1> */}
                </div>
              </div>

              <div className="flex flex-1 min-w-0 justify-center">
                {headerActions ? <div className="min-w-0 w-full max-w-[1150px]">{headerActions}</div> : null}
              </div>

              <div className="flex items-center justify-end gap-2">
                {/* <Link
                  href="/settings"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-neutral-900 shadow-sm transition hover:border-ades-green hover:bg-ades-green/10"
                >
                  <Settings className="w-4 h-4 text-ades-green" />
                </Link> */}

                <Button
                  variant="ghost"
                  className="rounded-xl text-red-600 hover:bg-red-50"
                  size="sm"
                  onClick={handleReturn}
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Retour</span>
                </Button>
              </div>
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 lg:px-6">
            <div ref={scrollRef} className="min-w-0 space-y-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </HeaderActionsProvider>
  )
}
