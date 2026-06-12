'use client'

import { useEffect, useMemo, useState } from 'react'

export type TicketStatusRaw = string

export interface TicketListItem {
  id: string
  titre?: string
  description?: string
  reference?: string
  acheteur?: string | null
  projet?: string
  statut?: TicketStatusRaw
  priorite?: string
  dateCreation?: string
  dateEcheance?: string
  enRetard?: boolean
  joursSansAction?: number

  // Keep it flexible: API may return additional fields.
  [key: string]: unknown
}

type UseTicketsListParams = {
  year?: number
  per_page?: number
  from?: string
  to?: string
  projet?: string
  acheteur?: string
  status?: number
  priority?: number
  urgent_only?: boolean
  late_only?: boolean
}

const API_BASE = 'http://localhost:9000'

export function useTicketsList(params: UseTicketsListParams = {}) {
  const {
    year,
    per_page = 100,
    projet,
    acheteur,
    status,
    priority,
    urgent_only,
    late_only,
  } = params

  const [tickets, setTickets] = useState<TicketListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const query = useMemo(() => {
    const q = new URLSearchParams()
    q.set('limit', String(per_page))

    if (year) q.set('year', String(year))
    if (projet) q.set('projet', projet)
    if (acheteur) q.set('acheteur', acheteur)
    if (typeof status === 'number') q.set('status', String(status))
    if (typeof priority === 'number') q.set('priority', String(priority))
    if (typeof urgent_only === 'boolean') q.set('urgent_only', String(urgent_only))
    if (typeof late_only === 'boolean') q.set('late_only', String(late_only))

    // offset left default
    return q.toString()
  }, [year, per_page, projet, acheteur, status, priority, urgent_only, late_only])

  useEffect(() => {
    let cancelled = false

    async function run() {
      setLoading(true)
      setError(null)
      try {
        const url = `${API_BASE}/api/tickets?${query}`
        const res = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        })

        if (!res.ok) throw new Error(`HTTP ${res.status} - ${await res.text()}`)

        const data = (await res.json()) as any

        const apiTickets: TicketListItem[] = Array.isArray(data?.tickets)
          ? (data.tickets as TicketListItem[])
          : Array.isArray(data)
            ? (data as TicketListItem[])
            : []

        if (!cancelled) setTickets(apiTickets)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e))
          setTickets([])
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

  return { tickets, loading, error }
}

