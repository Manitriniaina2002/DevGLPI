'use client'

import { ReactNode, useEffect, useRef } from 'react'
import { ArrowRight, LogOut, Settings, User } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [pathname])

  const handleLogout = () => {
    localStorage.removeItem('auth_token')
    window.location.href = '/auth/login'
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  return (
    <div className="h-dvh overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(76,139,64,0.14),transparent_20%)_top_left,_linear-gradient(180deg,_#f3f7f1_0%,_#eef3e8_100%)]">
      <div className="flex h-full min-w-0 overflow-hidden">
        {/* Sidebar */}
        <aside className="h-dvh w-72 shrink-0 bg-[#f8faf5] border-r border-slate-200 flex flex-col">
          <div className="p-6 border-b border-slate-200 bg-white">
            <div className="flex items-center gap-3">
              <div>
                <img src="/logo-ades.png" alt="ADES" className="h-14 w-auto" />
              </div>
              <div>
                {/* <p className="text-xs font-semibold uppercase tracking-[0.24em] text-ades-green">ADES</p> */}
                <h1 className="text-xl font-bold text-neutral-900">GLPI Dashboard</h1>
              </div>
            </div>
          </div>

          <div className="flex-1 px-4 py-6">
            <nav className="space-y-2">
              <Link
                href="/dashboard"
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-neutral-800 transition hover:bg-[rgba(76,139,64,0.12)] hover:text-black"
              >
                Dashboard
              </Link>
              <Link
                href="/tickets"
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-neutral-800 transition hover:bg-[rgba(76,139,64,0.12)] hover:text-black"
              >
                Tickets
              </Link>
              <Link
                href="/users"
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-neutral-800 transition hover:bg-[rgba(76,139,64,0.12)] hover:text-black"
              >
                Utilisateurs
              </Link>
              <a
                href={appUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-ades-green border border-ades-green/30 bg-white transition hover:bg-ades-green/10 hover:text-ades-green"
              >
                <span>Ouvrir l’application</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </nav>
          </div>

          <div className="mt-auto px-4 pb-6 pt-4 border-t border-slate-200 bg-white">
            <Link
              href="/settings"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-800 w-full hover:bg-[rgba(76,139,64,0.06)] transition"
              aria-label="Paramètres"
            >
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-ades-green/12 text-ades-green">
                <Settings className="w-4 h-4" />
              </span>
              <span>Paramètres</span>
            </Link>

            <Button
              variant="ghost"
              className="mt-3 w-full justify-start rounded-lg text-red-600 hover:bg-red-50"
              size="sm"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Déconnexion
            </Button>
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="sticky top-0 left-0 right-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-sm">
            <div className="max-w-[1440px] mx-auto flex flex-col gap-4 px-8 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-neutral-900">Bienvenue sur ADES GLPI</h2>
                <p className="mt-1 text-sm text-neutral-600">Pilotez vos tickets avec un tableau de bord moderne</p>
              </div>
                <div className="flex items-center gap-3">
              <Link
                href="/settings"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-neutral-900 shadow-sm transition hover:border-ades-green hover:bg-ades-green/10"
              >
                  <User className="w-4 h-4 text-ades-green" />
                  {/* <span>Mon Profil</span> */}
                </Link>
              </div>
            </div>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-8 py-6">
            <div className="mx-auto max-w-[1440px] min-w-0 space-y-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
