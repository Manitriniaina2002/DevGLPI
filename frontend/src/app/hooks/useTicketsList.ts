'use client'

import { useEffect, useMemo, useState } from 'react'
import { getApiBase } from './apiBase'

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
  offset?: number
  fetchAll?: boolean
  from?: string
  to?: string
  projet?: string
  acheteur?: string
  status?: number
  priority?: number
  urgent_only?: boolean
  late_only?: boolean
}

export function useTicketsList(params: UseTicketsListParams = {}) {
  const {
    year,
    from,
    to,
    per_page = 100,
    offset = 0,
    fetchAll = false,
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
    q.set('offset', String(offset))

    if (year) q.set('year', String(year))
    if (from) q.set('date_from', from)
    if (to) q.set('date_to', to)
    if (projet) q.set('projet', projet)
    if (acheteur) q.set('acheteur', acheteur)
    if (typeof status === 'number') q.set('status', String(status))
    if (typeof priority === 'number') q.set('priority', String(priority))
    if (typeof urgent_only === 'boolean') q.set('urgent_only', String(urgent_only))
    if (typeof late_only === 'boolean') q.set('late_only', String(late_only))

    return q.toString()
  }, [year, from, to, per_page, offset, projet, acheteur, status, priority, urgent_only, late_only])

  const requestQueryWithoutPagination = useMemo(() => {
    const q = new URLSearchParams()
    if (year) q.set('year', String(year))
    if (from) q.set('date_from', from)
    if (to) q.set('date_to', to)
    if (projet) q.set('projet', projet)
    if (acheteur) q.set('acheteur', acheteur)
    if (typeof status === 'number') q.set('status', String(status))
    if (typeof priority === 'number') q.set('priority', String(priority))
    if (typeof urgent_only === 'boolean') q.set('urgent_only', String(urgent_only))
    if (typeof late_only === 'boolean') q.set('late_only', String(late_only))
    return q
  }, [year, from, to, projet, acheteur, status, priority, urgent_only, late_only])

  useEffect(() => {
    let cancelled = false

    async function run() {
      setLoading(true)
      setError(null)
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
        const headers = {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        }

        async function fetchPage(pageLimit: number, pageOffset: number) {
          const API_BASE = getApiBase()
          const pageQuery = new URLSearchParams(requestQueryWithoutPagination)
          pageQuery.set('limit', String(pageLimit))
          pageQuery.set('offset', String(pageOffset))

          const res = await fetch(`${API_BASE}/api/tickets?${pageQuery.toString()}`, {
            method: 'GET',
            headers,
            credentials: 'include',
          })

          if (!res.ok) throw new Error(`HTTP ${res.status} - ${await res.text()}`)

          return extractTickets(await res.json())
        }

        let apiTickets: TicketListItem[] = []
        if (fetchAll) {
          const pageLimit = Math.min(Math.max(per_page, 1), 1000)
          let pageOffset = offset

          for (let page = 0; page < 100; page += 1) {
            const pageTickets = await fetchPage(pageLimit, pageOffset)
            apiTickets.push(...pageTickets)
            if (pageTickets.length < pageLimit) break
            pageOffset += pageLimit
          }
        } else {
          const API_BASE = getApiBase()
          const res = await fetch(`${API_BASE}/api/tickets?${query}`, {
            method: 'GET',
            headers,
            credentials: 'include',
          })

          if (!res.ok) throw new Error(`HTTP ${res.status} - ${await res.text()}`)
          apiTickets = extractTickets(await res.json())
        }

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
  }, [fetchAll, offset, per_page, query, requestQueryWithoutPagination])

  return { tickets, loading, error }
}

function extractTickets(data: unknown): TicketListItem[] {
  if (typeof data === 'string') {
    try {
      return extractTickets(JSON.parse(data))
    } catch {
      return []
    }
  }

  if (Array.isArray(data)) return data as TicketListItem[]
  if (!data || typeof data !== 'object') return []

  const record = data as Record<string, unknown>
  for (const key of ['tickets', 'items', 'results', 'data', 'rows']) {
    const value = record[key]
    if (Array.isArray(value)) return value as TicketListItem[]
    if (value && typeof value === 'object') {
      const nested = extractTickets(value)
      if (nested.length > 0) return nested
    }
  }

  const values = Object.values(record)
  if (values.length > 0 && values.every((value) => value && typeof value === 'object' && !Array.isArray(value))) {
    return values as TicketListItem[]
  }

  return []
}

