'use client'

import { useEffect, useMemo, useState } from 'react'

export type DashboardSummary = {
  period?: { from?: string | null; to?: string | null }
  mode?: string
  kpis?: {
    total_tickets?: number
    resolved?: number
    open?: number
    late?: number
    urgent?: number
    rejected?: number
    taux_realisation_pct?: number
    taux_retard_pct?: number
    taux_rejet_pct?: number
    taux_urgence_pct?: number
    delai_moyen_jours?: number
  }
  ytd?: {
    year?: number
    monthly?: Array<{ month: string; received: number; resolved: number }>
  }
  top_buyers?: Array<{ name: string; count: number }>
  top_projects?: Array<{ name: string; count: number }>

  [key: string]: unknown
}

type UseDashboardSummaryParams = {
  year?: number
}

const API_BASE = 'http://localhost:9000'

export function useDashboardSummary(params: UseDashboardSummaryParams = {}) {
  const { year } = params

  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const query = useMemo(() => {
    const q = new URLSearchParams()
    if (year) q.set('year', String(year))
    return q.toString()
  }, [year])

  useEffect(() => {
    let cancelled = false

    async function run() {
      setLoading(true)
      setError(null)

      try {
        const url = `${API_BASE}/api/dashboard/summary${query ? `?${query}` : ''}`
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: 'include',
        })

        if (!res.ok) throw new Error(`HTTP ${res.status} - ${await res.text()}`)

        const data = (await res.json()) as DashboardSummary
        if (!cancelled) setSummary(data)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e))
          setSummary(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [query])

  return { summary, loading, error }
}

