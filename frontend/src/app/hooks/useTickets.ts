'use client'

import { useEffect, useMemo, useState } from 'react'
import { getApiBase } from './apiBase'

export type TicketStatusRaw = string

export interface Ticket {
  id: string
  titre: string
  description?: string
  acheteur?: string | null
  projet?: string
  statut?: TicketStatusRaw
  priorite?: string
  dateCreation?: string
  dateEcheance?: string
  enRetard?: boolean
  joursSansAction?: number

  [key: string]: unknown
}

export type DashboardSummary = {
  [key: string]: unknown
}

type UseTicketsParams = {
  per_page?: number
  year?: number
  from?: string
  to?: string
}

// Next.js: l'API backend tourne à http://localhost:9000
export function useTickets(params: UseTicketsParams = { per_page: 100 }) {
  const { year } = params

  const [tickets, setTickets] = useState<Ticket[]>([])
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
        const API_BASE = getApiBase()
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

        const data = (await res.json()) as any

        if (!cancelled) {
          // En mode option B : /api/dashboard/summary ne sert qu'à fournir les KPI
          // On ne dépend plus d'un éventuel data.tickets.
          setTickets([])
          setSummary((data as DashboardSummary) || null)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e))
          setTickets([])
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

  return { tickets, summary, loading, error }
}


