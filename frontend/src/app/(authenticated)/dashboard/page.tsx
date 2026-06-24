'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Archive,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  Filter,
  FileText,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingCart,
  UserCheck,
} from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Card, CardContent, CardHeader } from '@/app/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog'
import { Input } from '@/app/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select'
import { Skeleton } from '@/app/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip'
import { useHeaderActions } from '@/app/(authenticated)/header-actions-context'
import { useDashboardSummary } from '@/app/hooks/useDashboardSummary'
import { useTicketsList } from '@/app/hooks/useTicketsList'
import { getApiBase } from '@/app/hooks/apiBase'
import { isTicketRejected, resolveTicketBusinessStatus, type TicketBusinessStatus } from '@/app/lib/ticket-business-status'

type QuickTicketFilter = 'all' | 'rejected' | 'late'
type TimelineStepState = 'done' | 'current' | 'pending' | 'rejected'
type PerformanceSort = 'score' | 'avg' | 'count'
type ActorRankingSort = 'volume' | 'speed'
const WORKFLOW_SOURCE_FLAG = '__workflow_source'
const WORKFLOW_TIMELINE_LABELS = [
  { key: 'creation', label: 'Création de la demande' },
  { key: 'validation', label: 'Validation' },
  { key: 'assignation', label: 'Assignation à un acheteur' },
  { key: 'achat', label: 'Traitement' },
  { key: 'cloture', label: 'Livraison' },
]

interface DashboardTicket {
  id: string
  reference: string
  name: string
  projet: string
  acheteur: string
  statut: string
  statutCode: number
  priorite: string
  prioriteCode: number
  dateCreation: string
  dateCreationRaw?: unknown
  dateEcheance: string
  dateEcheanceRaw?: unknown
  dateResolutionRaw?: unknown
  isLate: boolean
  raw: Record<string, unknown>
}

type WorkflowData = Record<string, unknown>

interface TimelineStep {
  key: string
  renderKey?: string
  label: string
  date: string
  user: string
  assignedBuyer?: string
  detail?: string
  state: TimelineStepState
  duration: string | null
  durationMinutes: number | null
}

interface StageMetric {
  key: string
  label: string
  averageDays: number | null
  minDays: number | null
  maxDays: number | null
  share: number
  count: number
  tone: 'green' | 'blue' | 'amber' | 'red' | 'slate'
}

interface ActorPerformance {
  name: string
  total: number
  processedCount: number
  totalDays: number
  averageDays: number | null
  averageMinutes: number | null
  completed: number
  inProgress: number
  slaRate: number
  lateCount: number
  score: number
}

interface BlockedTicket {
  id: string
  name: string
  owner: string
  reason: string
  ageDays: number
  tone: 'amber' | 'red' | 'slate'
}

interface ProcessAnalysis {
  global: Array<{
    key: string
    label: string
    value: number | null
    description: string
    tone: 'green' | 'blue' | 'amber' | 'red' | 'slate'
  }>
  stages: StageMetric[]
  buyers: ActorPerformance[]
  validators: ActorPerformance[]
  blockers: BlockedTicket[]
  summary: {
    totalTickets: number
    lateTickets: number
    blockedTickets: number
  }
}

interface WorkflowKpi {
  key: 'to_validate' | 'to_assign' | 'to_buy' | 'received' | 'rejected'
  label: string
  description: string
  count: number
  tone: 'green' | 'blue' | 'amber' | 'red' | 'slate'
  progressWeight: number
  icon: typeof ShieldCheck
}

interface WorkflowProgressSummary {
  percentage: number
  count: number
  total: number
  detail: string
  suffix: string
}

const ticketPageSizeOptions = [10, 25, 50, 100] as const
const QUICK_FILTER_OPTIONS: Array<{ value: QuickTicketFilter; label: string }> = [
  { value: 'all', label: 'Tous' },
  { value: 'rejected', label: 'Rejetés' },
  { value: 'late', label: 'En retard' },
] as const

export default function DashboardPage() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [project, setProject] = useState('all')
  const [buyer, setBuyer] = useState('all')
  const [quickFilter, setQuickFilter] = useState<QuickTicketFilter>('all')
  const [search, setSearch] = useState('')
  const [selectedTicket, setSelectedTicket] = useState<DashboardTicket | null>(null)
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowData | null>(null)
  const [workflowLoading, setWorkflowLoading] = useState(false)
  const [workflowError, setWorkflowError] = useState<string | null>(null)
  const [workflowTicketStatuses, setWorkflowTicketStatuses] = useState<Record<string, TicketBusinessStatus>>({})
  const [processWorkflows, setProcessWorkflows] = useState<Record<string, WorkflowData>>({})
  const [activeDashboardTab, setActiveDashboardTab] = useState('process')
  const [ticketPage, setTicketPage] = useState(1)
  const [ticketPageSize, setTicketPageSize] = useState<(typeof ticketPageSizeOptions)[number]>(25)
  const [projectOptions, setProjectOptions] = useState<string[]>([])
  const [buyerOptions, setBuyerOptions] = useState<string[]>([])
  const [buyerSort, setBuyerSort] = useState<ActorRankingSort>('speed')
  const [validatorSort, setValidatorSort] = useState<ActorRankingSort>('speed')
  const { setHeaderActions } = useHeaderActions()

  const { summary, loading, error } = useDashboardSummary({
    from: dateFrom || undefined,
    to: dateTo || undefined,
  })
  const { tickets: apiTickets, loading: ticketsLoading, error: ticketsError } = useTicketsList({
    per_page: 1000,
    fetchAll: true,
    from: dateFrom || undefined,
    to: dateTo || undefined,
    projet: project === 'all' ? undefined : project,
    acheteur: buyer === 'all' ? undefined : buyer,
  })
  const { tickets: scopedApiTickets } = useTicketsList({
    per_page: 1000,
    fetchAll: true,
    from: dateFrom || undefined,
    to: dateTo || undefined,
    projet: project === 'all' ? undefined : project,
    acheteur: buyer === 'all' ? undefined : buyer,
  })

  const tickets = useMemo<DashboardTicket[]>(
    () => apiTickets.map((ticket: any) => mapDashboardTicket(ticket)),
    [apiTickets],
  )
  const scopedTickets = useMemo<DashboardTicket[]>(
    () => scopedApiTickets.map((ticket: any) => mapDashboardTicket(ticket)),
    [scopedApiTickets],
  )

  const projects = useMemo(() => uniqueSorted(tickets.map((ticket) => ticket.projet)), [tickets])
  const buyers = useMemo(() => uniqueSorted(tickets.map((ticket) => ticket.acheteur)), [tickets])
  useEffect(() => {
    const candidates = scopedTickets.filter((ticket) => ticket.statutCode === 6)
    if (candidates.length === 0) {
      setWorkflowTicketStatuses({})
      return
    }

    const controller = new AbortController()
    const statuses: Record<string, TicketBusinessStatus> = {}
    let cursor = 0

    async function worker() {
      while (!controller.signal.aborted) {
        const ticket = candidates[cursor]
        cursor += 1
        if (!ticket) return

        try {
          const token = localStorage.getItem('auth_token')
          const response = await fetch(`${getApiBase()}/api/tickets/${encodeURIComponent(ticket.id)}/workflow`, {
            credentials: 'include',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            signal: controller.signal,
          })
          if (!response.ok) continue
          statuses[ticket.id] = getTicketBusinessStatus(ticket, unwrapWorkflow(await response.json()))
        } catch {
          if (controller.signal.aborted) return
        }
      }
    }

    Promise.all(Array.from({ length: Math.min(6, candidates.length) }, () => worker())).then(() => {
      if (!controller.signal.aborted) setWorkflowTicketStatuses(statuses)
    })

    return () => controller.abort()
  }, [scopedTickets])
  useEffect(() => {
    if (tickets.length === 0) {
      setProcessWorkflows({})
      return
    }

    const controller = new AbortController()
    const workflows: Record<string, WorkflowData> = {}
    let cursor = 0

    async function worker() {
      while (!controller.signal.aborted) {
        const ticket = tickets[cursor]
        cursor += 1
        if (!ticket) return

        try {
          const token = localStorage.getItem('auth_token')
          const response = await fetch(`${getApiBase()}/api/tickets/${encodeURIComponent(ticket.id)}/workflow`, {
            credentials: 'include',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            signal: controller.signal,
          })
          if (!response.ok) continue
          workflows[ticket.id] = unwrapWorkflow(await response.json())
        } catch {
          if (controller.signal.aborted) return
        }
      }
    }

    Promise.all(Array.from({ length: Math.min(6, tickets.length) }, () => worker())).then(() => {
      if (!controller.signal.aborted) setProcessWorkflows(workflows)
    })

    return () => controller.abort()
  }, [tickets])
  useEffect(() => {
    setProjectOptions((current) => uniqueSorted([...current, ...projects]))
  }, [projects])
  useEffect(() => {
    setBuyerOptions((current) => uniqueSorted([...current, ...buyers]))
  }, [buyers])
  const periodLabel = useMemo(() => formatPeriodLabel(dateFrom, dateTo), [dateFrom, dateTo])
  const dateRangeError = dateFrom !== '' && dateTo !== '' && dateFrom > dateTo
  const quickFilteredTickets = useMemo(() => {
    if (quickFilter === 'rejected') {
      return scopedTickets.filter((ticket) => getResolvedTicketStatus(ticket, workflowTicketStatuses) === 'Rejeté')
    }
    if (quickFilter === 'late') return scopedTickets.filter((ticket) => ticket.isLate)
    return scopedTickets
  }, [quickFilter, scopedTickets, workflowTicketStatuses])
  const visibleTickets = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return quickFilteredTickets
    return quickFilteredTickets.filter((ticket) =>
      [ticket.reference, ticket.name, ticket.projet, ticket.acheteur, ticket.statut, ticket.priorite]
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [quickFilteredTickets, search])
  const ticketPageCount = Math.max(1, Math.ceil(visibleTickets.length / ticketPageSize))
  const paginatedTickets = useMemo(() => {
    const start = (ticketPage - 1) * ticketPageSize
    return visibleTickets.slice(start, start + ticketPageSize)
  }, [ticketPage, ticketPageSize, visibleTickets])
  const ticketPageStart = visibleTickets.length === 0 ? 0 : (ticketPage - 1) * ticketPageSize + 1
  const ticketPageEnd = Math.min(visibleTickets.length, ticketPage * ticketPageSize)
  const ticketPages = useMemo(() => getPaginationPages(ticketPage, ticketPageCount), [ticketPage, ticketPageCount])
  const workflowKpis = useMemo(
    () => buildWorkflowKpis(quickFilteredTickets, workflowTicketStatuses),
    [quickFilteredTickets, workflowTicketStatuses],
  )
  const processMetricTickets = useMemo(
    () => tickets.map((ticket) => enrichTicketWithWorkflow(ticket, processWorkflows[ticket.id] ?? null)),
    [tickets, processWorkflows],
  )
  const globalWorkflowProgress = useMemo(
    () => buildWorkflowProgress(scopedTickets, quickFilter, workflowTicketStatuses),
    [scopedTickets, quickFilter, workflowTicketStatuses],
  )
  const progressBlockTone = workflowProgressTone(globalWorkflowProgress)
  const processAnalysis = useMemo(() => buildProcessAnalysis(processMetricTickets), [processMetricTickets])
  const selectedTimelineSteps = useMemo(() => buildTimelineSteps(selectedTicket, selectedWorkflow), [selectedTicket, selectedWorkflow])

  useEffect(() => {
    if (!selectedTicket) {
      setSelectedWorkflow(null)
      setWorkflowError(null)
      return
    }
    const ticket = selectedTicket
    const ticketId = ticket.id
    const controller = new AbortController()
    async function loadWorkflow() {
      setWorkflowLoading(true)
      setSelectedWorkflow(null)
      setWorkflowError(null)
      try {
        const token = localStorage.getItem('auth_token')
        const response = await fetch(`${getApiBase()}/api/tickets/${encodeURIComponent(ticketId)}/workflow`, {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const payload = await response.json()
        const workflow = unwrapWorkflow(payload)
        setSelectedWorkflow(workflow)
        setWorkflowTicketStatuses((current) => ({ ...current, [ticketId]: getTicketBusinessStatus(ticket, workflow) }))
      } catch (error) {
        if (!controller.signal.aborted) setWorkflowError(error instanceof Error ? error.message : String(error))
      } finally {
        if (!controller.signal.aborted) setWorkflowLoading(false)
      }
    }
    loadWorkflow()
    return () => controller.abort()
  }, [selectedTicket])
  const sortedValidators = useMemo(
    () => sortActorRanking(processAnalysis.validators, validatorSort),
    [processAnalysis.validators, validatorSort],
  )
  const sortedBuyers = useMemo(
    () => sortActorRanking(processAnalysis.buyers, buyerSort),
    [processAnalysis.buyers, buyerSort],
  )
  const hasFilters =
    dateFrom !== '' ||
    dateTo !== '' ||
    project !== 'all' ||
    buyer !== 'all' ||
    quickFilter !== 'all' ||
    search.trim() !== ''

  useEffect(() => {
    setTicketPage(1)
  }, [dateFrom, dateTo, project, buyer, quickFilter, search])

  useEffect(() => {
    setTicketPage((page) => Math.min(page, ticketPageCount))
  }, [ticketPageCount])

  function resetFilters() {
    setDateFrom('')
    setDateTo('')
    setProject('all')
    setBuyer('all')
    setQuickFilter('all')
    setSearch('')
    setTicketPage(1)
  }

  const headerFilters = useMemo(
    () => (
        <div className="grid w-full max-w-[1150px] gap-3 grid-cols-2 md:grid-cols-8 2xl:grid-cols-[170px_180px_110px_minmax(200px,auto)_120px_120px_auto_auto] 2xl:items-center">
          <div className="relative min-w-0 col-span-2 md:col-span-1 2xl:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher"
              className="h-9 rounded-lg border-slate-200 bg-white pl-9 text-sm shadow-sm"
            />
          </div>

          <div className="grid grid-cols-3 rounded-lg border border-slate-200 bg-white p-1 shadow-sm col-span-2 md:col-span-2 2xl:col-span-2 2xl:min-w-min">
            {QUICK_FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setQuickFilter(option.value)}
                className={`h-7 whitespace-nowrap rounded-md px-2 text-[11px] font-semibold transition-all duration-200 ${
                  quickFilter === option.value
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-neutral-500 hover:bg-slate-100 hover:text-neutral-800'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <Select value={project} onValueChange={setProject}>
            <SelectTrigger className="h-9 w-full rounded-lg border-slate-200 bg-white text-sm shadow-sm [&>span]:truncate">
              <SelectValue placeholder="Projet" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Par projets</SelectItem>
              {projectOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={buyer} onValueChange={setBuyer}>
            <SelectTrigger className="h-9 w-full rounded-lg border-slate-200 bg-white text-sm shadow-sm">
              <SelectValue placeholder="Acheteur" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Par acheteurs</SelectItem>
              {buyerOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className={`flex h-9 items-center gap-1 rounded-lg border bg-white px-2 shadow-sm ${dateRangeError ? 'border-red-200' : 'border-slate-200'}`}>
            <span className="shrink-0 text-[10px] font-medium text-neutral-500 whitespace-nowrap">Début</span>
            <Input
              id="dashboard-date-from"
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              aria-label="Date début"
              className="h-8 min-w-0 flex-1 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
            />
          </div>

          <div className={`flex h-9 items-center gap-1 rounded-lg border bg-white px-2 shadow-sm ${dateRangeError ? 'border-red-200' : 'border-slate-200'}`}>
            <span className="shrink-0 text-[10px] font-medium text-neutral-500 whitespace-nowrap">Fin</span>
            <Input
              id="dashboard-date-to"
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              aria-label="Date fin"
              className="h-8 min-w-0 flex-1 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (hasFilters) resetFilters()
            }}
            className={`h-9 whitespace-nowrap rounded-lg border-slate-200 bg-white px-2 text-neutral-700 hover:text-neutral-900 col-span-1 md:col-span-1 2xl:col-span-1 ${!hasFilters ? 'opacity-50' : undefined}`}
          >
            <RotateCcw className="size-4" />
            <span className="hidden sm:inline">Réinit.</span>
          </Button>
        </div>
      ),
    [buyer, buyerOptions, dateFrom, dateRangeError, dateTo, hasFilters, project, projectOptions, quickFilter, search],
  )

  useEffect(() => {
    setHeaderActions(headerFilters)
    return () => setHeaderActions(null)
  }, [headerFilters, setHeaderActions])

  return (
    <div className="space-y-5 text-neutral-950">
      <div className={`mt-6 rounded-[28px] border px-4 py-4 shadow-[0_22px_55px_rgba(15,23,42,0.08)] backdrop-blur sm:px-5 sm:py-5 ${progressBlockTone.shell}`}>
        <WorkflowKpiOverview kpis={workflowKpis} progress={globalWorkflowProgress} />
      </div>

      <Tabs value={activeDashboardTab} onValueChange={setActiveDashboardTab} className="mt-6 gap-3 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <TabsList className="hidden">
          <TabsTrigger value="process" className="px-4">
            <BarChart3 className="size-4" />
            Évaluation des processus
          </TabsTrigger>
          <TabsTrigger value="tickets" className="px-4">
            <Filter className="size-4" />
            Tickets
          </TabsTrigger>
        </TabsList>

      <>
        <CardHeader className="border-b border-slate-100 bg-white/95 px-5 py-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <TabsList className="h-10 w-full justify-start rounded-lg border border-slate-200 bg-slate-50 p-1 transition-all duration-200 sm:w-fit">
                <TabsTrigger value="process" className="h-8 rounded-md px-3 text-neutral-600 transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-ades-green data-[state=active]:shadow-sm">
                    <BarChart3 className="size-4" />
                    Évaluation des processus
                  </TabsTrigger>
                  <TabsTrigger value="tickets" className="h-8 rounded-md px-3 text-neutral-600 transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-ades-green data-[state=active]:shadow-sm">
                    <Filter className="size-4" />
                    Tickets
                  </TabsTrigger>
                </TabsList>
                <p className="text-sm text-neutral-500">
                  {ticketsLoading
                    ? 'Chargement des tickets...'
                    : ticketsError
                      ? 'Impossible de charger les tickets'
                      : tickets.length === 0
                        ? 'Aucun ticket'
                      : `${visibleTickets.length}/${tickets.length} ticket${tickets.length > 1 ? 's' : ''} affiché${visibleTickets.length > 1 ? 's' : ''}`}
                </p>
              </div>
            </div>

          </div>
        </CardHeader>
        <CardContent className="bg-slate-50/40 px-3 py-3 sm:px-4 sm:py-4 lg:px-5">
        <TabsContent value="tickets" className="m-0 space-y-3 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:duration-200">
          {visibleTickets.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
                <FileText className="size-6" />
              </div>
              <p className="mt-4 text-sm font-semibold text-neutral-800">
                {ticketsLoading
                  ? 'Chargement des tickets...'
                  : hasFilters
                    ? 'Aucun ticket ne correspond aux filtres'
                    : 'Il n’y a pas de tickets'}
              </p>
              {!ticketsLoading && (
                <p className="mt-1 max-w-md text-sm leading-6 text-neutral-500">
                  {hasFilters
                    ? 'Essayez avec d’autres filtres.'
                    : 'Les tickets apparaîtront ici.'}
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="max-h-[70vh] min-h-[420px] overflow-auto">
              <table className="min-w-[940px] w-full divide-y divide-slate-100 text-left text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50/95 text-[11px] uppercase text-neutral-500 shadow-[0_1px_0_rgba(226,232,240,1)] backdrop-blur">
                  <tr>
                    <th className="px-4 py-3.5 font-semibold tracking-wide">N° Ticket</th>
                    <th className="px-4 py-3.5 font-semibold tracking-wide">Nom</th>
                    <th className="px-4 py-3.5 font-semibold tracking-wide">Projet</th>
                    <th className="px-4 py-3.5 font-semibold tracking-wide">Acheteur</th>
                    <th className="px-4 py-3.5 font-semibold tracking-wide">Statut</th>
                    <th className="px-4 py-3.5 font-semibold tracking-wide">Priorité</th>
                    <th className="px-4 py-3.5 font-semibold tracking-wide">Créé le</th>
                    <th className="px-4 py-3.5 font-semibold tracking-wide">Date de livraison souhaitée</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {paginatedTickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      onClick={() => {
                        setSelectedWorkflow(null)
                        setWorkflowLoading(true)
                        setSelectedTicket(ticket)
                      }}
                      className={`cursor-pointer transition-all duration-200 hover:bg-slate-50/80 ${
                        ticket.isLate ? 'bg-red-50/40 hover:bg-red-50/70' : ''
                      }`}
                    >
                      <td className="whitespace-nowrap px-4 py-3.5 font-semibold tabular-nums text-neutral-800">{ticket.reference}</td>
                      <td className="max-w-[420px] px-4 py-3.5 text-neutral-800">
                        <span className="block truncate font-medium">{ticket.name}</span>
                      </td>
                      <td className="px-4 py-3.5 text-neutral-600">{ticket.projet}</td>
                      <td className="px-4 py-3.5 text-neutral-600">{ticket.acheteur}</td>
                      <td className="px-4 py-3.5">
                        <StatusBadge ticket={ticket} status={workflowTicketStatuses[ticket.id]} />
                      </td>
                      <td className="px-4 py-3.5">
                        <PriorityBadge label={ticket.priorite} code={ticket.prioriteCode} />
                      </td>
                      <td className="px-4 py-3.5 text-neutral-500">{ticket.dateCreation}</td>
                      <td className="px-4 py-3.5 text-neutral-500">{ticket.dateEcheance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <TicketPaginationControls
                page={ticketPage}
                pageCount={ticketPageCount}
                pages={ticketPages}
                pageSize={ticketPageSize}
                total={visibleTickets.length}
                start={ticketPageStart}
                end={ticketPageEnd}
                onPageChange={setTicketPage}
                onPageSizeChange={(size) => {
                  setTicketPageSize(size)
                  setTicketPage(1)
                }}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="process" className="m-0 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:duration-200">
          <ProcessEvaluationPanel
            analysis={processAnalysis}
            buyerSort={buyerSort}
            validatorSort={validatorSort}
            sortedBuyers={sortedBuyers}
            sortedValidators={sortedValidators}
            onBuyerSortChange={setBuyerSort}
            onValidatorSortChange={setValidatorSort}
          />
        </TabsContent>
        </CardContent>
      </>
      </Tabs>

      <TicketProgressDialog
        ticket={selectedTicket}
        steps={selectedTimelineSteps}
        workflow={selectedWorkflow}
        workflowLoading={workflowLoading}
        workflowError={workflowError}
        onOpenChange={(open) => {
          if (!open) setSelectedTicket(null)
        }}
      />
    </div>
  )
}


function WorkflowKpiOverview({ kpis, progress }: { kpis: WorkflowKpi[]; progress: WorkflowProgressSummary }) {
  const progressTone = workflowProgressTone(progress)

  return (
    <div className="space-y-4">
      <div className="px-5 py-5 sm:px-6 lg:px-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-neutral-500 shadow-sm backdrop-blur">
              <BarChart3 className={`size-3.5 ${progressTone.icon}`} />
              Progression des tickets
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-3">
              <div className="flex items-end gap-3">
                <span className="text-5xl font-semibold tracking-[-0.06em] text-neutral-950 sm:text-6xl">{progress.percentage}%</span>
                <span className={`mb-1 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${progressTone.badge}`}>{progress.suffix}</span>
              </div>
              <div className="mb-1">
                <p className="text-lg font-bold text-neutral-800">{progress.detail}</p>
                {/* <p className="mt-1 text-xs uppercase tracking-[0.18em] text-neutral-400">Indicateur actif du filtre sélectionné</p> */}
              </div>
            </div>
          </div>

          {/* <div className="w-full max-w-[280px] rounded-[24px] border border-white/70 bg-white/85 p-4 shadow-[0_16px_32px_rgba(15,23,42,0.05)] backdrop-blur">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">Volume suivi</p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-3xl font-semibold tracking-[-0.05em] text-neutral-950">{progress.count}</span>
              <span className="pb-1 text-sm text-neutral-500">sur {progress.total}</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-neutral-500">Lecture instantanée du ratio utilisé pour la progression affichée.</p>
          </div> */}
        </div>

        <div className="mt-5">
          <div className="h-2.5 overflow-hidden rounded-full bg-white/80 shadow-inner ring-1 ring-slate-100">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${progressTone.bar}`}
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map((item) => {
          const Icon = item.icon
          const tone = workflowKpiTone(item.tone)
          return (
            <div key={item.key} className={`min-w-0 rounded-[24px] border px-4 py-4 shadow-[0_14px_30px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(15,23,42,0.07)] ${tone.card}`}>
              <div className="flex items-start justify-between gap-3">
                <div className={`rounded-2xl border border-white/80 bg-white/90 p-2.5 shadow-sm ${tone.icon}`}>
                  <Icon className="size-4" />
                </div>
                <span className="text-3xl font-semibold leading-none tracking-[-0.04em] text-neutral-950">{item.count}</span>
              </div>
              <p className="mt-4 line-clamp-2 text-base font-bold leading-5 text-neutral-800">{item.label}</p>
              <p className="mt-1 line-clamp-2 text-[12px] font-medium leading-5 text-neutral-700">{item.description}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function workflowProgressTone(progress: WorkflowProgressSummary) {
  if (progress.suffix.includes('rejet')) {
    return {
      shell: 'border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(252,231,243,0.28))]',
      bar: 'bg-gradient-to-r from-rose-500 via-pink-500 to-rose-300',
      badge: 'bg-rose-50 text-rose-700',
      icon: 'text-rose-600',
    }
  }
  if (progress.suffix.includes('retard')) {
    return {
      shell: 'border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(254,249,195,0.3))]',
      bar: 'bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-300',
      badge: 'bg-amber-50 text-amber-700',
      icon: 'text-amber-600',
    }
  }
  return {
    shell: 'border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(220,252,231,0.28))]',
    bar: 'bg-gradient-to-r from-emerald-500 via-green-400 to-teal-300',
    badge: 'bg-emerald-50 text-emerald-700',
    icon: 'text-emerald-600',
  }
}

function TicketPaginationControls({
  page,
  pageCount,
  pages,
  pageSize,
  total,
  start,
  end,
  onPageChange,
  onPageSizeChange,
}: {
  page: number
  pageCount: number
  pages: Array<number | 'ellipsis'>
  pageSize: (typeof ticketPageSizeOptions)[number]
  total: number
  start: number
  end: number
  onPageChange: (page: number | ((page: number) => number)) => void
  onPageSizeChange: (size: (typeof ticketPageSizeOptions)[number]) => void
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/70 px-4 py-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
        <span>
          {start}-{end} sur {total} ticket{total > 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-2">
          <span>Par page</span>
          <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value) as (typeof ticketPageSizeOptions)[number])}>
            <SelectTrigger className="h-8 w-[82px] rounded-lg border-slate-200 bg-white text-xs shadow-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ticketPageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)}>{size}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange((current) => Math.max(1, current - 1))} className="border-slate-200 text-neutral-700">
          Précédent
        </Button>
        {pages.map((item, index) =>
          item === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className="flex h-8 min-w-8 items-center justify-center px-1 text-xs text-neutral-400">...</span>
          ) : (
            <Button
              key={item}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onPageChange(item)}
              className={`min-w-8 px-2 ${item === page ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800 hover:text-white' : ''}`}
            >
              {item}
            </Button>
          ),
        )}
        <Button type="button" variant="outline" size="sm" disabled={page >= pageCount} onClick={() => onPageChange((current) => Math.min(pageCount, current + 1))} className="border-slate-200 text-neutral-700">
          Suivant
        </Button>
      </div>
    </div>
  )
}

function ProcessEvaluationPanel({
  analysis,
  buyerSort,
  validatorSort,
  sortedBuyers,
  sortedValidators,
  onBuyerSortChange,
  onValidatorSortChange,
}: {
  analysis: ProcessAnalysis
  buyerSort: ActorRankingSort
  validatorSort: ActorRankingSort
  sortedBuyers: ActorPerformance[]
  sortedValidators: ActorPerformance[]
  onBuyerSortChange: (value: ActorRankingSort) => void
  onValidatorSortChange: (value: ActorRankingSort) => void
}) {
  const stageInsights = getStageInsights(analysis)
  const buyerInsights = getBuyerInsights(analysis.buyers)
  const health = getProcessHealth(analysis, stageInsights, buyerInsights)

  return (
    <div className="space-y-5">
      <div className="rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] p-5 shadow-[0_20px_45px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="size-4 text-ades-green" />
              <h2 className="text-xl font-semibold tracking-[-0.04em] text-neutral-900 sm:text-2xl">Santé du processus</h2>
            </div>
            <p className="mt-1 text-sm leading-6 text-neutral-500">Lecture consolidée des délais, goulots d'étranglement et performances achat.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {health.cards.map((card) => (
            <ProcessHealthCard key={card.label} {...card} />
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.45fr_0.85fr]">
        <div className="rounded-[26px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold tracking-[-0.03em] text-neutral-1000 sm:text-xl">Analyse détaillée par étape</h3>
              {/* <p className="mt-1 text-xs leading-5 text-neutral-500">Poids de chaque jalon dans le cycle global et dispersion des délais observés.</p> */}
            </div>
            {/* <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{analysis.stages.reduce((sum, stage) => sum + stage.count, 0)} mesures</span> */}
          </div>
          <div className="mt-5 space-y-3">
            {analysis.stages.length === 0 ? (
              <EmptyInsight label="Aucune étape mesurable pour la période." />
            ) : (
              analysis.stages.map((stage) => <StagePerformanceDetailRow key={stage.key} stage={stage} />)
            )}
          </div>
        </div>

        <CriticalStagesCard stages={stageInsights.criticalStages} blockers={analysis.blockers} globalAverage={stageInsights.globalAverage} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ActorRankingCard
          title="Classement des acheteurs"
          actorKind="buyer"
          sortedActors={sortedBuyers}
          sort={buyerSort}
          onSortChange={onBuyerSortChange}
          emptyLabel="Aucun acheteur assigné pour le moment."
        />
        <BuyerComparisonCard buyers={buyerInsights.ranked} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ActorRankingCard
          title="Performance des validateurs"
          actorKind="validator"
          sortedActors={sortedValidators}
          sort={validatorSort}
          onSortChange={onValidatorSortChange}
          emptyLabel="Aucun validateur identifié dans les tickets."
        />
        <div className="rounded-[26px] border border-red-100/80 bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold tracking-[-0.03em] text-neutral-900 sm:text-xl">Retards et blocages actifs</h3>
              {/* <p className="mt-1 text-xs leading-5 text-neutral-500">Tickets qui nécessitent une action prioritaire.</p> */}
            </div>
            {/* <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-700">{analysis.blockers.length}</span> */}
          </div>
          <div className="mt-5 space-y-2.5">
            {analysis.blockers.length === 0 ? (
              <EmptyInsight label="Aucun blocage détecté sur les tickets visibles." />
            ) : (
              analysis.blockers.slice(0, 5).map((ticket) => <BlockedTicketRow key={ticket.id} ticket={ticket} />)
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


function StagePerformanceDetailRow({ stage }: { stage: StageMetric }) {
  const width = stage.share === 0 ? 0 : Math.max(8, stage.share)
  const performance = stagePerformanceLabel(stage)
  const tones = {
    green: 'bg-ades-green',
    blue: 'bg-blue-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    slate: 'bg-slate-300',
  }

  return (
    <div className="rounded-[22px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.88))] p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(15,23,42,0.07)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold tracking-[-0.02em] text-neutral-900">{stage.label}</span>
            <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${performance.className}`}>{performance.label}</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-neutral-500">
            {stage.count} dossier{stage.count > 1 ? 's' : ''} · min {formatDays(stage.minDays)} · max {formatDays(stage.maxDays)}
          </p>
        </div>
        <div className="ml-auto grid w-full max-w-[120px] grid-cols-1 gap-2 text-right">
          <MetricPill label="Moyenne" value={formatDays(stage.averageDays)} />
          {/* <MetricPill label="Poids" value={`${stage.share}%`} />
          <MetricPill label="Volume" value={String(stage.count)} /> */}
        </div>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100" title={`${stage.share}% du cycle moyen mesuré`}>
        <div className={`h-full rounded-full ${tones[stage.tone]}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/88 px-3 py-2 shadow-sm">
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-400">{label}</p>
      <p className="mt-1 text-xs font-semibold text-neutral-900">{value}</p>
    </div>
  )
}

function ProcessHealthCard({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: 'green' | 'blue' | 'amber' | 'red' | 'slate' }) {
  const tones = {
    green: 'border-emerald-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(236,253,245,0.9))] text-emerald-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]',
    blue: 'border-blue-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(239,246,255,0.9))] text-blue-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]',
    amber: 'border-amber-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,251,235,0.88))] text-amber-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]',
    red: 'border-rose-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,241,242,0.9))] text-rose-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]',
    slate: 'border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]',
  }

  return (
    <div className={`rounded-[24px] border px-4 py-4 shadow-[0_14px_30px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(15,23,42,0.07)] ${tones[tone]}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-800">{label}</p>
      <p className="mt-3 truncate text-lg font-semibold tracking-[-0.03em] text-neutral-950" title={value}>{value}</p>
      <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-neutral-700">{hint}</p>
    </div>
  )
}

function CriticalStagesCard({ stages, blockers, globalAverage }: { stages: StageMetric[]; blockers: BlockedTicket[]; globalAverage: number | null }) {
  return (
    <div className="rounded-[26px] border border-red-100/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(254,242,242,0.42))] p-5 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-red-600" />
            <h3 className="text-lg font-semibold tracking-[-0.03em] text-neutral-900 sm:text-xl">Étapes Lentes</h3>
          </div>
          {/* <p className="mt-1 text-xs leading-5 text-neutral-500">Top 3 des étapes les plus lents et dépassements de la moyenne globale.</p> */}
        </div>
        {/* <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">{blockers.length} retard{blockers.length > 1 ? 's' : ''}</span> */}
      </div>

      <div className="mt-5 space-y-2.5">
        {stages.length === 0 ? (
          <EmptyInsight label="Aucune étape critique mesurable." />
        ) : (
          stages.map((stage, index) => {
            const overAverage = globalAverage !== null && stage.averageDays !== null && stage.averageDays > globalAverage
            return (
              <div key={stage.key} className="rounded-[22px] border border-red-100/80 bg-white/88 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-900">{index + 1}. {stage.label}</p>
                    <p className="mt-1 text-xs text-neutral-500">{stage.share}% du cycle · {stage.count} dossier{stage.count > 1 ? 's' : ''}</p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">{formatDays(stage.averageDays)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">Goulot</span>
                  {overAverage && <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Au-dessus moyenne</span>}
                  {stage.tone === 'red' && <span className="rounded-md bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800">Critique</span>}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function BuyerComparisonCard({ buyers }: { buyers: ActorPerformance[] }) {
  const maxVolume = Math.max(1, ...buyers.map((buyer) => buyer.total))
  const maxAverage = Math.max(1, ...buyers.map((buyer) => buyer.averageDays ?? 0))
  const visible = buyers.slice(0, 6)

  return (
    <div className="rounded-[26px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
      <div>
        <h3 className="text-lg font-semibold tracking-[-0.03em] text-neutral-900 sm:text-xl">Comparaison des acheteurs</h3>
        {/* <p className="mt-1 text-xs leading-5 text-neutral-500">Volume, temps moyen et taux de retard pour détecter charge, performance et besoin d'accompagnement.</p> */}
      </div>
      <div className="mt-5 space-y-3">
        {visible.length === 0 ? (
          <EmptyInsight label="Aucune donnée acheteur comparable." />
        ) : (
          visible.map((buyer) => {
            const delayRate = buyer.total === 0 ? 0 : Math.round((buyer.lateCount / buyer.total) * 100)
            return (
              <div key={buyer.name} className="rounded-[22px] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.88))] p-4 transition duration-200 hover:bg-white hover:shadow-[0_16px_32px_rgba(15,23,42,0.06)]">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-neutral-900">{buyer.name}</p>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-ades-green shadow-sm">{buyer.score}/100</span>
                </div>
                <ComparisonBar label="Volume" value={buyer.total} max={maxVolume} color="bg-blue-500" suffix=" tickets" />
                <ComparisonBar label="Temps moyen" value={buyer.averageDays ?? 0} max={maxAverage} color="bg-amber-500" suffix=" j" />
                {/* <ComparisonBar label="Taux retard" value={delayRate} max={100} color={delayRate > 20 ? 'bg-red-500' : 'bg-ades-green'} suffix="%" /> */}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function ComparisonBar({ label, value, max, color, suffix }: { label: string; value: number; max: number; color: string; suffix: string }) {
  const width = value === 0 ? 0 : Math.max(6, Math.round((value / max) * 100))

  return (
    <div className="mt-3 grid grid-cols-[92px_1fr_64px] items-center gap-2.5">
      <span className="text-xs text-neutral-500">{label}</span>
      <div className="h-2.5 overflow-hidden rounded-full bg-white shadow-inner ring-1 ring-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} />
      </div>
      <span className="text-right text-xs font-semibold text-neutral-700">{value}{suffix}</span>
    </div>
  )
}

function EmptyInsight({ label }: { label: string }) {
  return <p className="rounded-[22px] border border-slate-200/80 bg-white/92 p-4 text-sm text-neutral-500 shadow-sm">{label}</p>
}

function ActorRankingCard({
  title,
  actorKind,
  sortedActors,
  sort,
  onSortChange,
  emptyLabel,
}: {
  title: string
  actorKind: 'buyer' | 'validator'
  sortedActors: ActorPerformance[]
  sort: ActorRankingSort
  onSortChange: (value: ActorRankingSort) => void
  emptyLabel: string
}) {
  return (
    <div className="rounded-[26px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] p-5 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-3 border-b border-slate-200/70 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold tracking-[-0.03em] text-neutral-900 sm:text-xl">{title}</h3>
        </div>
        <Select value={sort} onValueChange={(value) => onSortChange(value as ActorRankingSort)}>
          <SelectTrigger className="h-9 w-full rounded-xl border-slate-200 bg-white/95 text-xs font-medium shadow-sm sm:w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="volume">Volume traité</SelectItem>
            <SelectItem value="speed">Rapidité</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 space-y-2.5">
        {sortedActors.length === 0 ? (
          <p className="rounded-[22px] border border-slate-200 bg-slate-50/90 p-4 text-sm text-neutral-500">{emptyLabel}</p>
        ) : (
          sortedActors.slice(0, 6).map((actor, index) => (
            <ActorPerformanceRow
              key={actor.name}
              actor={actor}
              actorKind={actorKind}
              rank={index + 1}
              sort={sort}
            />
          ))
        )}
      </div>
    </div>
  )
}

function ActorPerformanceRow({
  actor,
  actorKind,
  rank,
  sort,
}: {
  actor: ActorPerformance
  actorKind: 'buyer' | 'validator'
  rank: number
  sort: ActorRankingSort
}) {
  const rankLabel = rank === 1 ? 'Top 1' : rank === 2 ? 'Top 2' : rank === 3 ? 'Top 3' : `Top ${rank}`
  const cardAccent = rank === 1
    ? 'border-amber-200/90 shadow-[0_18px_34px_rgba(245,158,11,0.08)]'
    : rank === 2
      ? 'border-slate-300/90'
      : rank === 3
        ? 'border-orange-200/90'
        : 'border-slate-200/70'
  const volumeLabel = actorKind === 'buyer' ? 'tickets' : 'validations'
  const volumeCardClass = sort === 'volume'
    ? 'border-blue-200/90 bg-blue-50/80 shadow-[0_10px_22px_rgba(59,130,246,0.10)]'
    : 'border-slate-200/80 bg-slate-50/85'
  const speedCardClass = sort === 'speed'
    ? 'border-emerald-200/90 bg-emerald-50/80 shadow-[0_10px_22px_rgba(16,185,129,0.10)]'
    : 'border-slate-200/80 bg-slate-50/85'
  const volumeTextClass = sort === 'volume' ? 'text-blue-700' : 'text-neutral-950'
  const speedTextClass = sort === 'speed' ? 'text-emerald-700' : 'text-neutral-950'
  const rankTextClass = rank === 1
    ? 'border-amber-200 bg-amber-50 text-amber-700'
    : rank === 2
      ? 'border-slate-200 bg-slate-100 text-slate-700'
      : rank === 3
        ? 'border-orange-200 bg-orange-50 text-orange-700'
        : 'border-slate-200 bg-white text-neutral-500'

  return (
    <div className={`relative rounded-[20px] border bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.90))] p-3.5 transition duration-200 hover:bg-white hover:shadow-[0_16px_32px_rgba(15,23,42,0.06)] ${cardAccent}`}>
      <div className="flex items-center gap-3 pr-20">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-neutral-950">{actor.name}</p>
        </div>
        <div className="flex shrink-0 gap-2.5">
          <div className={`min-w-[88px] rounded-xl border px-2.5 py-2 ${volumeCardClass}`}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">{volumeLabel}</p>
            <p className={`mt-0.5 text-base font-semibold tracking-[-0.03em] ${volumeTextClass}`}>{actor.processedCount}</p>
          </div>
          <div className={`min-w-[108px] rounded-xl border px-2.5 py-2 ${speedCardClass}`}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">Moyenne</p>
            <p className={`mt-0.5 text-base font-semibold tracking-[-0.03em] ${speedTextClass}`}>{formatCompactDuration(actor.averageMinutes)}</p>
          </div>
        </div>
        <span className={`absolute right-3 top-3 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-sm ${rankTextClass}`}>{rankLabel}</span>
      </div>
    </div>
  )
}

function BlockedTicketRow({ ticket }: { ticket: BlockedTicket }) {
  const tone = ticket.tone === 'red' ? 'text-red-700 bg-red-50' : ticket.tone === 'amber' ? 'text-amber-700 bg-amber-50' : 'text-slate-700 bg-slate-100'

  return (
    <div className="rounded-[22px] border border-red-100/80 bg-white/95 p-4 transition duration-200 hover:shadow-[0_16px_32px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-neutral-900">#{ticket.id} · {ticket.name}</p>
          <p className="mt-1 text-xs text-neutral-500">{ticket.owner}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{ticket.ageDays} j</span>
      </div>
      <p className="mt-2 text-xs font-medium text-red-700">{ticket.reason}</p>
    </div>
  )
}


function TicketProgressDialog({
  ticket,
  steps,
  workflow,
  workflowLoading,
  workflowError,
  onOpenChange,
}: {
  ticket: DashboardTicket | null
  steps: TimelineStep[]
  workflow: WorkflowData | null
  workflowLoading: boolean
  workflowError: string | null
  onOpenChange: (open: boolean) => void
}) {
  const rejectedStep = steps.find((step) => step.state === 'rejected')
  const workflowRejected = workflowIsRejected(workflow)
  const currentStep = rejectedStep ?? steps.find((step) => step.state === 'current') ?? [...steps].reverse().find((step) => step.state === 'done')
  const elapsed = getElapsedSinceCreation(ticket, workflow)
  const longestDuration = steps.reduce((max, step) => Math.max(max, step.durationMinutes ?? 0), 0)
  const timedSteps = steps.filter((step): step is TimelineStep & { durationMinutes: number; duration: string } => step.durationMinutes !== null && step.duration !== null)
  const fastestStep = timedSteps.length > 0 ? [...timedSteps].sort((a, b) => a.durationMinutes - b.durationMinutes)[0] : null
  const slowestStep = timedSteps.length > 0 ? [...timedSteps].sort((a, b) => b.durationMinutes - a.durationMinutes)[0] : null
  const displayedSteps: TimelineStep[] = workflowLoading
    ? WORKFLOW_TIMELINE_LABELS.map((step, index) => ({
        ...step,
        renderKey: `loading-${step.key}`,
        date: '-',
        user: '-',
        state: index === 0 ? 'current' : 'pending',
        duration: null,
        durationMinutes: null,
      }))
    : steps

  return (
    <Dialog open={Boolean(ticket)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_32px_90px_rgba(15,23,42,0.10)] sm:max-w-5xl">
        <DialogHeader>
          <div className="flex flex-col gap-5 pr-8">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0">
                <DialogTitle className="max-w-4xl text-2xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-3xl">
                  {ticket?.reference ? `${ticket.reference} - ${ticket?.name ?? '-'}` : ticket?.name ?? '-'}
                </DialogTitle>
                <div className="mt-3 h-px w-full max-w-3xl bg-gradient-to-r from-ades-green/25 via-slate-200 to-transparent" />
              </div>
            </div>
            <div className="flex justify-center pt-1">
              <div className="w-full max-w-4xl">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    label="Temps écoulé"
                    value={elapsed}
                    accent="slate"
                    loading={workflowLoading}
                  />
                  <MetricCard
                    label="Statut"
                    value={workflowRejected || rejectedStep ? 'Rejeté' : currentStep?.label ?? '-'}
                    accent="green"
                    loading={workflowLoading}
                  />
                  <MetricCard
                    label="Étape la plus rapide"
                    value={fastestStep?.label ?? '-'}
                    detail={fastestStep?.duration ?? 'Non disponible'}
                    accent="sky"
                    loading={workflowLoading}
                  />
                  <MetricCard
                    label="Étape la plus longue"
                    value={slowestStep?.label ?? '-'}
                    detail={slowestStep?.duration ?? 'Non disponible'}
                    accent="amber"
                    loading={workflowLoading}
                  />
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        {workflowError && <p className="text-xs text-amber-700">Le suivi du ticket n’est pas disponible pour le moment.</p>}

        <div className="overflow-x-auto pt-3 pb-2">
          <div className="rounded-[34px] bg-[radial-gradient(circle_at_top,rgba(76,139,64,0.08),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.72),rgba(248,250,252,0.82))] px-2 py-6 sm:px-4 sm:py-9">
            <div className="relative grid min-w-[920px] grid-cols-5 gap-x-2 px-4">
              <div className="pointer-events-none absolute left-[10%] right-[10%] top-8 z-0 h-px bg-slate-200/90" />
              <div className="pointer-events-none absolute left-[10%] top-8 z-0 h-px bg-gradient-to-r from-ades-green via-emerald-400 to-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.25)]" style={{ width: `${Math.max(0, ((displayedSteps.filter((step) => step.state === 'done').length - 1) / Math.max(1, displayedSteps.length - 1)) * 80)}%` }} />
              {displayedSteps.map((step, index) => (
                <div key={step.renderKey ?? `${step.key}-${index}`} className="relative z-10 min-w-0 px-3 text-center">
                  {!workflowLoading && index > 0 && step.duration && (
                    <div className={`absolute -left-6 top-0 w-12 text-center text-[11px] font-medium tracking-[0.02em] ${
                      step.durationMinutes === longestDuration && longestDuration > 0 ? 'text-amber-700' : 'text-slate-400'
                    }`}>
                      {step.duration}
                    </div>
                  )}
                  <div className="relative flex flex-col items-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="group flex flex-col items-center outline-none transition-transform duration-200 hover:-translate-y-0.5"
                          aria-label={`${step.label} - ${timelineTooltipLabel(step)}`}
                        >
                          <TimelineIcon state={step.state} stepKey={step.key} loading={workflowLoading} />
                          <div className="mt-5 flex min-h-[74px] flex-col items-center justify-start">
                            {workflowLoading ? (
                              <>
                                <Skeleton className="h-5 w-28" />
                                <Skeleton className="mt-2 h-1.5 w-6 rounded-full" />
                              </>
                            ) : (
                              <>
                                <p className={`max-w-[10rem] text-balance transition-colors ${
                                  step.state === 'rejected'
                                    ? 'text-base font-semibold tracking-[-0.03em] text-red-700'
                                    : step.state === 'current'
                                    ? 'text-base font-semibold tracking-[-0.03em] text-slate-950'
                                    : step.state === 'pending'
                                      ? 'text-sm font-medium text-slate-400'
                                      : 'text-sm font-semibold text-slate-700'
                                }`}>
                                  {step.label}
                                </p>
                                <span className={`mt-2 h-1.5 rounded-full transition-all ${
                                  step.state === 'rejected'
                                    ? 'w-10 bg-red-500'
                                    : step.state === 'current'
                                    ? 'w-10 bg-ades-green'
                                    : step.state === 'done'
                                      ? 'w-6 bg-emerald-300'
                                      : 'w-4 bg-slate-200'
                                }`} />
                              </>
                            )}
                          </div>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" align="center" className="max-w-[240px] rounded-3xl border-slate-200/80 bg-white px-4 py-4 text-left shadow-[0_24px_60px_rgba(15,23,42,0.14)]">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{step.label}</p>
                              <p className={`text-[11px] uppercase tracking-[0.18em] ${step.state === 'rejected' ? 'text-red-600' : 'text-slate-400'}`}>{timelineTooltipLabel(step)}</p>
                            </div>
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] ${step.state === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-500'}`}>
                              {timelineRoleLabel(step.key)}
                            </span>
                          </div>
                          <div className="space-y-2 text-sm text-slate-600">
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Acteur</p>
                              <p className={`mt-1 font-medium ${isMissingActorValue(step.user) ? 'text-red-600' : 'text-slate-800'}`}>{isMissingActorValue(step.user) ? 'Non identifié' : step.user}</p>
                            </div>
                            {step.assignedBuyer && (
                              <div>
                                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Acheteur assigné</p>
                                <p className="mt-1 font-medium text-slate-800">{step.assignedBuyer}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Date</p>
                              <p className="mt-1">{step.date === 'À venir' ? 'Date non disponible' : step.date}</p>
                            </div>
                            {step.duration && (
                              <div>
                                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Durée</p>
                                <p className="mt-1 font-medium text-slate-800">{step.duration}</p>
                              </div>
                            )}
                            {step.detail && (
                              <div>
                                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Détail</p>
                                <p className="mt-1 text-slate-800">{step.detail}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TimelineIcon({ state, stepKey, loading = false }: { state: TimelineStepState; stepKey: string; loading?: boolean }) {
  const Icon = stepKey === 'creation' ? FileText : stepKey === 'validation' ? ShieldCheck : stepKey === 'assignation' ? UserCheck : stepKey === 'achat' ? ShoppingCart : Archive
  return (
    <span className="relative z-10 flex size-16 items-center justify-center">
      {loading ? (
        <Skeleton className="size-12 rounded-full" />
      ) : (
        <span className={`flex items-center justify-center rounded-full transition-all duration-300 ${
          state === 'rejected'
            ? 'size-16 scale-105 bg-red-600 text-white shadow-[0_18px_36px_rgba(220,38,38,0.22)] ring-[10px] ring-red-500/10'
            : state === 'current'
            ? 'size-16 scale-105 bg-ades-green text-white shadow-[0_18px_36px_rgba(76,139,64,0.22)] ring-[10px] ring-ades-green/10'
            : state === 'done'
              ? 'size-12 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
              : 'size-11 bg-slate-100 text-slate-400 ring-1 ring-slate-200'
        }`}>
          <Icon className="size-5" />
        </span>
      )}
    </span>
  )
}

function timelineTooltipLabel(step: TimelineStep) {
  if (step.state === 'rejected') return 'Etape rejetée'
  if (step.state === 'current') return 'Etape en cours'
  if (step.state === 'done') return 'Etape terminee'
  return 'Etape a venir'
}

function isMissingActorValue(value: string) {
  const normalized = value.trim().toLowerCase()
  return normalized === '' || normalized === '-' || normalized === 'non identifié' || normalized === 'non identifie' || normalized === 'non assigné' || normalized === 'non assigne' || normalized === 'demandeur' || normalized === 'validateur'
}

function MetricCard({ label, value, detail, accent, loading = false }: { label: string; value: string; detail?: string; accent: 'slate' | 'green' | 'sky' | 'amber'; loading?: boolean }) {
  const styles = {
    slate: 'border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]',
    green: 'border-emerald-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(236,253,245,0.9))] text-emerald-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]',
    sky: 'border-blue-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(239,246,255,0.9))] text-blue-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]',
    amber: 'border-amber-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,251,235,0.88))] text-amber-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]',
  }

  return (
    <div className={`group rounded-[24px] border px-5 py-4 text-center shadow-[0_14px_30px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(15,23,42,0.07)] ${styles[accent]}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-neutral-800">{label}</p>
      {loading ? (
        <>
          <Skeleton className="mx-auto mt-2 h-6 w-24" />
          {detail !== undefined && <Skeleton className="mx-auto mt-1 h-5 w-16" />}
        </>
      ) : (
        <>
          <p className="mt-2 text-base font-semibold leading-6 text-slate-950">{value}</p>
          {detail && <p className="mt-1 text-sm font-semibold text-neutral-700">{detail}</p>}
        </>
      )}
    </div>
  )
}

function StatusBadge({ ticket, status: statusOverride }: { ticket: DashboardTicket; status?: TicketBusinessStatus }) {
  const status = statusOverride ?? getTicketBusinessStatus(ticket)
  const styles = {
    'Créé': 'bg-slate-100 text-slate-700',
    'Assigné': 'bg-blue-50 text-blue-700',
    'En cours de traitement': 'bg-amber-50 text-amber-700',
    'Clos': 'bg-green-50 text-green-700',
    'Rejeté': 'bg-red-50 text-red-700',
  }

  return <span className={`inline-flex whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>{status}</span>
}

function getTicketBusinessStatus(ticket: DashboardTicket, workflow: WorkflowData | null = null): TicketBusinessStatus {
  const workflowSource = workflow ?? (workflowStepRecords(ticket.raw).length > 0 ? ticket.raw : null)
  return resolveTicketBusinessStatus({
    ...ticket.raw,
    status: ticket.statutCode,
    status_label: ticket.statut,
    acheteur: ticket.acheteur,
    date_resolution: ticket.dateResolutionRaw,
  }, workflowSource)
}

function getResolvedTicketStatus(ticket: DashboardTicket, workflowStatuses: Record<string, TicketBusinessStatus>) {
  return workflowStatuses[ticket.id] ?? getTicketBusinessStatus(ticket)
}

function PriorityBadge({ label, code }: { label: string; code: number }) {
  const className = code >= 4 ? 'bg-red-50 text-red-700' : code >= 3 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-700'
  return <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-medium ${className}`}>{label}</span>
}

function isRejectedTicket(ticket: DashboardTicket) {
  return isTicketRejected({ ...ticket.raw, status_label: ticket.statut })
}

function mapDashboardTicket(ticket: Record<string, unknown>): DashboardTicket {
  return {
    id: String(ticket.id ?? `${ticket.name ?? 'ticket'}-${ticket.date_creation ?? 'na'}`),
    reference: String(ticket.id ?? '-'),
    name: String(ticket.name ?? ticket.titre ?? ticket.title ?? 'Ticket sans nom'),
    projet: String(ticket.projet ?? ticket.project ?? 'Non renseigné'),
    acheteur: String(ticket.acheteur ?? ticket.assignedTo ?? 'Non renseigné'),
    statut: String(ticket.status_label ?? ticket.statut ?? ticket.status ?? '-'),
    statutCode: Number(ticket.status ?? 0),
    priorite: normalizePriority(ticket.priority ?? ticket.priorite),
    prioriteCode: Number(ticket.priority ?? 0),
    dateCreation: formatDateFr(ticket.date_creation ?? ticket.dateCreation ?? ticket.createdAt ?? ticket.date),
    dateCreationRaw: ticket.date_creation ?? ticket.dateCreation ?? ticket.createdAt ?? ticket.date,
    dateEcheance: formatDateFr(ticket.time_to_resolve ?? ticket.date_livraison_souhaitee ?? ticket.date_echeance ?? ticket.dateEcheance ?? ticket.deadline ?? ticket.echeance),
    dateEcheanceRaw: ticket.time_to_resolve ?? ticket.date_livraison_souhaitee ?? ticket.date_echeance ?? ticket.dateEcheance ?? ticket.deadline ?? ticket.echeance,
    dateResolutionRaw: ticket.date_resolution ?? ticket.dateResolution ?? ticket.closedate ?? ticket.solvedate,
    isLate: calculateDelayStatus(ticket).isLate,
    raw: ticket,
  }
}

function enrichTicketWithWorkflow(ticket: DashboardTicket, workflow: WorkflowData | null): DashboardTicket {
  if (!workflow) return ticket
  const flattened = flattenWorkflow(workflow)
  const workflowAssignedBuyer = workflowBuyer(workflow)

  return {
    ...ticket,
    acheteur: workflowAssignedBuyer || ticket.acheteur,
    raw: {
      ...ticket.raw,
      ...workflow,
      ...flattened,
      [WORKFLOW_SOURCE_FLAG]: true,
    },
  }
}

function normalizePriority(value: unknown) {
  const numeric = Number(value)
  const labels: Record<number, string> = {
    1: 'Très basse',
    2: 'Basse',
    3: 'Moyenne',
    4: 'Haute',
    5: 'Très haute',
    6: 'Majeure',
  }
  if (Number.isFinite(numeric) && labels[numeric]) return labels[numeric]
  return value === null || value === undefined || value === '' ? '-' : String(value)
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter((value) => value && value !== '-'))).sort((a, b) => a.localeCompare(b, 'fr'))
}

function getPaginationPages(current: number, total: number): Array<number | 'ellipsis'> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)

  const pages = new Set([1, total, current, current - 1, current + 1])
  const sorted = Array.from(pages)
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b)

  return sorted.reduce<Array<number | 'ellipsis'>>((items, page, index) => {
    const previous = sorted[index - 1]
    if (previous && page - previous > 1) items.push('ellipsis')
    items.push(page)
    return items
  }, [])
}

function buildTimelineSteps(ticket: DashboardTicket | null, workflow: WorkflowData | null = null): TimelineStep[] {
  const workflowSteps = workflowTimelineSteps(workflow)
  if (workflowSteps.length > 0) return workflowSteps

  const labels = WORKFLOW_TIMELINE_LABELS

  if (!ticket) {
    return labels.map((step, index) => ({
      ...step,
      date: '-',
      user: '-',
      state: index === 0 ? 'current' : 'pending',
      duration: null,
      durationMinutes: null,
    }))
  }

  const enrichedTicket = workflow ? { ...ticket, acheteur: workflowBuyer(workflow) || ticket.acheteur, raw: { ...ticket.raw, ...flattenWorkflow(workflow) } } : ticket
  const assigned = hasAssignedBuyer(enrichedTicket.acheteur)
  const rejected = isRejectedTicket(ticket)
  const resolved = !rejected && ticket.statutCode >= 5
  const closed = !rejected && ticket.statutCode >= 6
  const validationDone = ticket.statutCode >= 2 || assigned || resolved
  const purchaseDone = resolved || closed

  const doneByKey: Record<string, boolean> = {
    creation: true,
    validation: validationDone,
    assignation: assigned,
    achat: purchaseDone,
    cloture: closed,
  }

  const firstPendingIndex = labels.findIndex((step) => !doneByKey[step.key])

  const dates = labels.map((step) => timelineTimestamp(step.key, enrichedTicket))
  return labels.map((step, index) => ({
      ...step,
      date: timelineDateForStep(step.key, enrichedTicket, doneByKey[step.key]),
      user: timelineUserForStep(step.key, enrichedTicket),
      assignedBuyer: undefined,
      detail: undefined,
      state: rejected
        ? step.key === 'creation' ? 'done' : step.key === 'validation' ? 'rejected' : 'pending'
        : doneByKey[step.key] ? 'done' : index === firstPendingIndex ? 'current' : 'pending',
      duration: index > 0 ? formatWorkflowDuration(dates[index - 1], dates[index]) : null,
      durationMinutes: index > 0 ? workflowDurationMinutes(dates[index - 1], dates[index]) : null,
    }))
}

function workflowTimelineSteps(workflow: WorkflowData | null): TimelineStep[] {
  const items = workflowStepRecords(workflow)
  if (items.length === 0) return []

  const timestamps = items.map((step) => parseDateValue(firstValue(step, ['date'])))
  const states = items.map((step, index) => workflowTimelineState(stringValue(firstValue(step, ['statut'])).toLowerCase(), index, items, workflowStepIsRejected(step)))
  const explicitRejectedIndex = states.findIndex((state) => state === 'rejected')
  const rejectedIndex = explicitRejectedIndex >= 0 ? explicitRejectedIndex : workflowIsRejected(workflow) ? workflowRejectedStepIndex(items) : -1
  const currentIndex = states.lastIndexOf('current')
  return items.map((step, index) => {
    const key = workflowTimelineKey(stringValue(firstValue(step, ['etape'])).toLowerCase())
    return {
      key,
      renderKey: `${key}-${index}`,
      label: timelineDefaultLabel(key),
      date: formatTicketDetailDate(firstValue(step, ['date'])),
      user: actorName(firstValue(step, ['acteur'])),
      assignedBuyer: key === 'assignation' ? actorName(firstValue(step, ['acheteur_assigne'])) : undefined,
      detail: stringValue(firstValue(step, ['detail'])) || undefined,
      state: rejectedIndex >= 0
        ? index < rejectedIndex ? 'done' : index === rejectedIndex ? 'rejected' : 'pending'
        : states[index] === 'current' && index !== currentIndex ? 'done' : states[index],
      duration: index > 0 ? formatWorkflowDuration(timestamps[index - 1], timestamps[index]) : null,
      durationMinutes: index > 0 ? workflowDurationMinutes(timestamps[index - 1], timestamps[index]) : null,
    }
  })
}

function buildWorkflowKpis(tickets: DashboardTicket[], workflowStatuses: Record<string, TicketBusinessStatus>): WorkflowKpi[] {
  const kpis: WorkflowKpi[] = [
    {
      key: 'to_validate',
      label: 'Tickets à valider',
      description: 'Demandes en attente de validation',
      count: 0,
      tone: 'amber',
      progressWeight: 0,
      icon: ShieldCheck,
    },
    {
      key: 'to_assign',
      label: 'Tickets à assigner',
      description: 'Demandes validées sans acheteur',
      count: 0,
      tone: 'blue',
      progressWeight: 33,
      icon: UserCheck,
    },
    {
      key: 'to_buy',
      label: "Tickets en cours d'achat",
      description: 'Demandes prises en charge par un acheteur',
      count: 0,
      tone: 'green',
      progressWeight: 66,
      icon: ShoppingCart,
    },
    {
      key: 'received',
      label: 'Tickets reçus / clôturés',
      description: 'Demandes terminées ou réceptionnées',
      count: 0,
      tone: 'slate',
      progressWeight: 100,
      icon: CheckCircle2,
    },
    {
      key: 'rejected',
      label: 'Tickets rejetés',
      description: 'Demandes refusées à la validation',
      count: 0,
      tone: 'red',
      progressWeight: 0,
      icon: AlertTriangle,
    },
  ]

  tickets.forEach((ticket) => {
    if (getResolvedTicketStatus(ticket, workflowStatuses) === 'Rejeté') {
      const rejected = kpis.find((item) => item.key === 'rejected')
      if (rejected) rejected.count += 1
      return
    }
    const key = getWorkflowKpiKey(ticket)
    const kpi = kpis.find((item) => item.key === key)
    if (kpi) kpi.count += 1
  })

  return kpis
}

function buildWorkflowProgress(
  tickets: DashboardTicket[],
  quickFilter: QuickTicketFilter,
  workflowStatuses: Record<string, TicketBusinessStatus>,
): WorkflowProgressSummary {
  const total = tickets.length
  if (total === 0) {
    return {
      percentage: 0,
      count: 0,
      total: 0,
      detail: quickFilter === 'late'
        ? '0 / 0 ticket en retard'
        : quickFilter === 'rejected'
          ? '0 / 0 ticket rejeté'
          : '0 / 0 ticket résolu',
      suffix: quickFilter === 'late' ? 'en retard' : quickFilter === 'rejected' ? 'rejeté' : 'résolu',
    }
  }

  const count = quickFilter === 'late'
    ? tickets.filter((ticket) => ticket.isLate).length
    : quickFilter === 'rejected'
      ? tickets.filter((ticket) => getResolvedTicketStatus(ticket, workflowStatuses) === 'Rejeté').length
      : tickets.filter((ticket) => getResolvedTicketStatus(ticket, workflowStatuses) === 'Clos').length

  const suffix = quickFilter === 'late'
    ? 'en retard'
    : quickFilter === 'rejected'
      ? 'rejetés'
      : 'résolus'

  return {
    percentage: Math.round((count / total) * 100),
    count,
    total,
    detail: `${count} / ${total} ticket${total > 1 ? 's' : ''} ${suffix}`,
    suffix,
  }
}

function getWorkflowKpiKey(ticket: DashboardTicket): WorkflowKpi['key'] {
  const stage = getWorkflowStageKey(ticket)
  if (stage === 'cloture' || stage === 'reception') return 'received'
  if (stage === 'assignation_acheteur' || stage === 'demande_devis' || stage === 'achat_effectue') return 'to_buy'
  if (stage === 'validation_n1' || stage === 'validation_achat') return 'to_assign'

  if (ticket.statutCode >= 5) return 'received'
  if (hasAssignedBuyer(ticket.acheteur) || ticket.statutCode >= 3) return 'to_buy'
  if (ticket.statutCode >= 2) return 'to_assign'
  return 'to_validate'
}

function workflowKpiTone(tone: WorkflowKpi['tone']) {
  const tones = {
    amber: {
      card: 'border-amber-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,251,235,0.88))] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]',
      icon: 'text-amber-700',
    },
    blue: {
      card: 'border-blue-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(239,246,255,0.9))] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]',
      icon: 'text-blue-700',
    },
    green: {
      card: 'border-emerald-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(236,253,245,0.9))] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]',
      icon: 'text-emerald-700',
    },
    red: {
      card: 'border-rose-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,241,242,0.9))] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]',
      icon: 'text-rose-700',
    },
    slate: {
      card: 'border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]',
      icon: 'text-slate-700',
    },
  }
  return tones[tone]
}

function getWorkflowStageKey(ticket: DashboardTicket) {
  const raw = ticket.raw
  if (isRejectedTicket(ticket)) return 'validation_n1'
  const closed = ticket.statutCode >= 6 || Boolean(ticket.dateResolutionRaw) || Boolean(firstValue(raw, ['closedAt', 'clotureAt']))
  if (closed) return 'cloture'

  if (hasKnownDate(raw, ['receptionDate', 'date_reception', 'receivedAt'])) return 'reception'
  if (hasKnownDate(raw, ['purchase_date', 'date_achat', 'achatEffectueAt'])) return 'achat_effectue'
  if (hasKnownDate(raw, ['demande_devis', 'quoteDate', 'date_devis'])) return 'demande_devis'
  if (hasKnownDate(raw, ['date_assignation', 'assignedAt', 'datePriseEnCharge', 'takenInChargeAt'])) return 'assignation_acheteur'
  if (hasKnownDate(raw, ['validation_achat', 'validationAchatAt', 'validatedPurchaseAt'])) return 'validation_achat'
  if (hasKnownDate(raw, ['validation_n1', 'date_validation', 'validatedAt', 'validationDate'])) return 'validation_n1'
  return 'creation'
}

function buildProcessAnalysis(tickets: DashboardTicket[]): ProcessAnalysis {
  const blockers = buildBlockedTickets(tickets)
  const stages: StageMetric[] = [
    buildStageMetric('validation', 'Création → Validation', tickets, 'creation', 'validation'),
    buildStageMetric('assignment', 'Validation → Assignation', tickets, 'validation', 'assignation'),
    buildStageMetric('purchase', 'Assignation → Achat', tickets, 'assignation', 'achat'),
    buildStageMetric('closure', 'Achat → Clôture', tickets, 'achat', 'cloture'),
  ]
  const totalStageAverage = stages.reduce((sum, stage) => sum + (stage.averageDays ?? 0), 0)
  const weightedStages = stages.map((stage) => ({
    ...stage,
    share: totalStageAverage === 0 || stage.averageDays === null ? 0 : Math.round((stage.averageDays / totalStageAverage) * 100),
  }))
  const cycleAverage = averageNumbers(tickets.map((ticket) => diffDays(getTicketDate(ticket, 'creation'), getTicketDate(ticket, 'cloture'))))

  return {
    global: [
      {
        key: 'validation',
        label: 'Avant validation',
        value: stages[0]?.averageDays ?? null,
        description: 'Temps moyen entre création et validation',
        tone: metricTone(stages[0]?.averageDays ?? null),
      },
      {
        key: 'assignment',
        label: 'Avant assignation',
        value: stages[1]?.averageDays ?? null,
        description: 'Temps moyen pour trouver un acheteur',
        tone: metricTone(stages[1]?.averageDays ?? null),
      },
      {
        key: 'purchase',
        label: 'Avant achat',
        value: stages[2]?.averageDays ?? null,
        description: 'Délai moyen de traitement achat',
        tone: metricTone(stages[2]?.averageDays ?? null),
      },
      {
        key: 'closure',
        label: 'Avant clôture',
        value: stages[3]?.averageDays ?? null,
        description: 'Temps moyen avant fermeture',
        tone: metricTone(stages[3]?.averageDays ?? null),
      },
      {
        key: 'cycle',
        label: 'Cycle complet',
        value: cycleAverage,
        description: "Durée moyenne d'une demande clôturée",
        tone: metricTone(cycleAverage),
      },
    ],
    stages: weightedStages,
    buyers: buildBuyerPerformance(tickets),
    validators: buildValidatorPerformance(tickets),
    blockers,
    summary: {
      totalTickets: tickets.length,
      lateTickets: tickets.filter((ticket) => ticket.isLate).length,
      blockedTickets: blockers.length,
    },
  }
}

function buildStageMetric(key: string, label: string, tickets: DashboardTicket[], from: string, to: string): StageMetric {
  const durations = tickets.map((ticket) => diffDays(getTicketDate(ticket, from), getTicketDate(ticket, to)))
  const validDurations = durations.filter((duration): duration is number => duration !== null && Number.isFinite(duration))
  const averageDays = averageNumbers(durations)
  return {
    key,
    label,
    averageDays,
    minDays: validDurations.length === 0 ? null : Math.min(...validDurations),
    maxDays: validDurations.length === 0 ? null : Math.max(...validDurations),
    share: 0,
    count: validDurations.length,
    tone: stageTone(averageDays),
  }
}

function buildBuyerPerformance(tickets: DashboardTicket[]): ActorPerformance[] {
  const groups = new Map<string, DashboardTicket[]>()
  tickets.filter((ticket) => hasAssignedBuyer(ticket.acheteur)).forEach((ticket) => {
    groups.set(ticket.acheteur, [...(groups.get(ticket.acheteur) ?? []), ticket])
  })

  return Array.from(groups.entries()).map(([name, items]) => {
    const completed = items.filter((ticket) => getTicketBusinessStatus(ticket) === 'Clos').length
    const inProgress = items.filter((ticket) => ['Assigné', 'En cours de traitement'].includes(getTicketBusinessStatus(ticket))).length
    const processedTickets = items.map((ticket) => {
      const processedAt = getTicketDate(ticket, 'achat') ?? getTicketDate(ticket, 'cloture')
      return {
        ticket,
        processedAt,
        duration: diffDays(getTicketDate(ticket, 'assignation'), processedAt),
      }
    })
    const durations = processedTickets.map((item) => item.duration)
    const averageDays = averageNumbers(
      durations,
    )
    const measuredMinutes = processedTickets
      .map((item) => diffDurationMinutes(getTicketDate(item.ticket, 'assignation'), item.processedAt))
      .filter((value): value is number => value !== null)
    const respected = items.filter((ticket) => !ticket.isLate).length
    const lateCount = items.length - respected
    const totalDays = durations.reduce<number>((sum, duration) => sum + (duration ?? 0), 0)
    const slaRate = Math.round((respected / Math.max(1, items.length)) * 100)
    return {
      name,
      total: items.length,
      processedCount: measuredMinutes.length,
      totalDays,
      averageDays,
      averageMinutes: averageWholeNumbers(measuredMinutes),
      completed,
      inProgress,
      slaRate,
      lateCount,
      score: calculateActorScore(items.length, averageDays, slaRate),
    }
  })
}

function buildValidatorPerformance(tickets: DashboardTicket[]): ActorPerformance[] {
  const groups = new Map<string, DashboardTicket[]>()
  tickets.forEach((ticket) => {
    const name = timelineUserForStep('validation', ticket)
    if (!name || name === 'Validateur') return
    groups.set(name, [...(groups.get(name) ?? []), ticket])
  })

  return Array.from(groups.entries()).map(([name, items]) => {
    const validations = items.map((ticket) => {
      const validationDate = getTicketDate(ticket, 'validation')
      return {
        ticket,
        validationDate,
        duration: diffDays(getTicketDate(ticket, 'creation'), validationDate),
      }
    })
    const measuredValidations = validations.filter(
      (item): item is { ticket: DashboardTicket; validationDate: Date; duration: number } =>
        item.validationDate !== null && item.duration !== null,
    )
    const measuredMinutes = measuredValidations
      .map((item) => diffDurationMinutes(getTicketDate(item.ticket, 'creation'), item.validationDate))
      .filter((value): value is number => value !== null)
    const validated = validations.filter((item) => item.validationDate !== null).length
    const pending = validations.length - validated
    const durations = validations.map((item) => item.duration)
    const averageDays = averageNumbers(durations)
    const onTime = measuredValidations.filter((item) => item.duration <= 2).length
    const totalDays = durations.reduce<number>((sum, duration) => sum + (duration ?? 0), 0)
    const slaRate = measuredValidations.length === 0 ? 0 : Math.round((onTime / measuredValidations.length) * 100)
    return {
      name,
      total: items.length,
      processedCount: validated,
      totalDays,
      averageDays,
      averageMinutes: averageWholeNumbers(measuredMinutes),
      completed: validated,
      inProgress: pending,
      slaRate,
      lateCount: Math.max(0, measuredValidations.length - onTime),
      score: calculateActorScore(items.length, averageDays, slaRate),
    }
  })
}

function buildBlockedTickets(tickets: DashboardTicket[]): BlockedTicket[] {
  return tickets
    .map((ticket) => {
      const ageDays = diffDays(getTicketDate(ticket, 'creation'), new Date()) ?? 0
      if (ticket.isLate) {
        return blockedTicket(ticket, 'Délai dépassé', ageDays, 'red')
      }
      if (!hasAssignedBuyer(ticket.acheteur) && ticket.statutCode >= 2 && ticket.statutCode < 5) {
        return blockedTicket(ticket, 'Aucun acheteur assigné', ageDays, 'amber')
      }
      if (ticket.statutCode <= 1 && ageDays >= 2) {
        return blockedTicket(ticket, 'Validation en attente', ageDays, 'amber')
      }
      if (ticket.statutCode === 4) {
        return blockedTicket(ticket, 'Demande en attente', ageDays, 'slate')
      }
      return null
    })
    .filter((ticket): ticket is BlockedTicket => ticket !== null)
    .sort((a, b) => b.ageDays - a.ageDays)
}

function blockedTicket(ticket: DashboardTicket, reason: string, ageDays: number, tone: BlockedTicket['tone']): BlockedTicket {
  return {
    id: ticket.reference,
    name: ticket.name,
    owner: hasAssignedBuyer(ticket.acheteur) ? ticket.acheteur : 'Non assigné',
    reason,
    ageDays,
    tone,
  }
}

function sortActorPerformance(items: ActorPerformance[], sort: PerformanceSort) {
  return [...items].sort((a, b) => {
    if (sort === 'score') return b.score - a.score
    if (sort === 'count') return b.total - a.total
    return (a.averageDays ?? Number.POSITIVE_INFINITY) - (b.averageDays ?? Number.POSITIVE_INFINITY)
  })
}

function sortActorRanking(items: ActorPerformance[], sort: ActorRankingSort) {
  return [...items].sort((a, b) => {
    if (sort === 'volume') return b.processedCount - a.processedCount
    return (a.averageMinutes ?? Number.POSITIVE_INFINITY) - (b.averageMinutes ?? Number.POSITIVE_INFINITY)
  })
}

function calculateActorScore(volume: number, averageDays: number | null, slaRate: number) {
  const speedScore = averageDays === null ? 40 : Math.max(0, 100 - averageDays * 12)
  const volumeScore = Math.min(100, volume * 20)
  return Math.round(speedScore * 0.40 + volumeScore * 0.30 + slaRate * 0.3)
}

function getStageInsights(analysis: ProcessAnalysis) {
  const measured = analysis.stages.filter((stage) => stage.averageDays !== null)
  const globalAverage = averageNumbers(measured.map((stage) => stage.averageDays))
  const criticalStages = measured
    .filter((stage) => globalAverage === null || (stage.averageDays ?? 0) >= globalAverage || stage.tone === 'red')
    .sort((a, b) => (b.averageDays ?? 0) - (a.averageDays ?? 0))
    .slice(0, 3)

  return { globalAverage, criticalStages }
}

function getBuyerInsights(buyers: ActorPerformance[]) {
  const ranked = sortActorPerformance(buyers, 'score')
  const fastest = [...buyers]
    .filter((buyer) => buyer.averageMinutes !== null)
    .sort((a, b) => (a.averageMinutes ?? Number.POSITIVE_INFINITY) - (b.averageMinutes ?? Number.POSITIVE_INFINITY))[0] ?? null
  return {
    ranked,
    best: ranked[0] ?? null,
    fastest,
    slowest: [...buyers].filter((buyer) => buyer.averageDays !== null).sort((a, b) => (b.averageDays ?? 0) - (a.averageDays ?? 0))[0] ?? null,
  }
}

function getProcessHealth(
  analysis: ProcessAnalysis,
  stageInsights: ReturnType<typeof getStageInsights>,
  buyerInsights: ReturnType<typeof getBuyerInsights>,
) {
  const cycle = analysis.global.find((metric) => metric.key === 'cycle')?.value ?? null
  const slowestStage = [...analysis.stages].filter((stage) => stage.averageDays !== null).sort((a, b) => (b.averageDays ?? 0) - (a.averageDays ?? 0))[0] ?? null
  const bestStage = [...analysis.stages].filter((stage) => stage.averageDays !== null).sort((a, b) => (a.averageDays ?? 0) - (b.averageDays ?? 0))[0] ?? null
  const lateTotal = analysis.summary.lateTickets
  const lateRate = analysis.summary.totalTickets === 0 ? 0 : Math.round((lateTotal / analysis.summary.totalTickets) * 100)
  const cycleTone = cycle === null ? 'slate' as const : cycle > 10 ? 'red' as const : cycle > 5 ? 'amber' as const : 'blue' as const
  const slowStageTone = slowestStage === null ? 'slate' as const : slowestStage.tone === 'red' ? 'red' as const : 'amber' as const
  const bestStageTone = bestStage === null ? 'slate' as const : 'green' as const
  const slowBuyerTone = buyerInsights.slowest === null ? 'slate' as const : (buyerInsights.slowest.averageDays ?? 0) > 10 ? 'red' as const : 'amber' as const

  return {
    cards: [
      { label: 'Durée moyenne', value: formatDays(cycle), hint: 'Cycle complet mesuré', tone: cycleTone },
      { label: 'Étape lente', value: slowestStage?.label ?? '-', hint: slowestStage ? formatDays(slowestStage.averageDays) : 'Aucune mesure', tone: slowStageTone },
      { label: 'Étape performante', value: bestStage?.label ?? '-', hint: bestStage ? formatDays(bestStage.averageDays) : 'Aucune mesure', tone: bestStageTone },
      { label: 'Acheteur rapide', value: buyerInsights.fastest?.name ?? '-', hint: buyerInsights.fastest ? `${formatCompactDuration(buyerInsights.fastest.averageMinutes)}` : 'Aucune moyenne', tone: 'green' as const },
      { label: 'Acheteur lent', value: buyerInsights.slowest?.name ?? '-', hint: buyerInsights.slowest ? formatDays(buyerInsights.slowest.averageDays) : 'Aucune mesure', tone: slowBuyerTone },
      { label: 'Taux retard', value: `${lateRate}%`, hint: `${lateTotal} ticket${lateTotal > 1 ? 's' : ''} en retard`, tone: lateRate >= 25 ? 'red' as const : lateRate >= 10 ? 'amber' as const : 'green' as const },
    ],
  }
}

function stagePerformanceLabel(stage: StageMetric) {
  if (stage.averageDays === null) return { label: 'Non mesuré', className: 'bg-slate-100 text-slate-600' }
  if (stage.tone === 'green') return { label: 'Excellent', className: 'bg-ades-green/10 text-ades-green' }
  if (stage.tone === 'blue') return { label: 'Bon', className: 'bg-blue-50 text-blue-700' }
  if (stage.tone === 'amber') return { label: 'Moyen', className: 'bg-amber-50 text-amber-700' }
  return { label: 'Critique', className: 'bg-red-50 text-red-700' }
}

function getTicketDate(ticket: DashboardTicket, step: string) {
  const raw = ticket.raw
  if (isRejectedTicket(ticket) && (step === 'achat' || step === 'cloture')) return null
  if (hasWorkflowSource(raw)) {
    const workflowDate = parseDateValue(workflowStepDateValue(raw, step))
    if (workflowDate) return workflowDate
  }

  return parseDateValue(fallbackTicketDateValue(ticket, step))
}

function diffDays(from: Date | null, to: Date | null) {
  if (!from || !to) return null
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000))
}

function diffDurationMinutes(from: Date | null, to: Date | null) {
  if (!from || !to || to.getTime() < from.getTime()) return null
  return Math.floor((to.getTime() - from.getTime()) / 60_000)
}

function averageNumbers(values: Array<number | null>) {
  const valid = values.filter((value): value is number => value !== null && Number.isFinite(value))
  if (valid.length === 0) return null
  return Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 10) / 10
}

function averageWholeNumbers(values: number[]) {
  if (values.length === 0) return null
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function stageTone(value: number | null): StageMetric['tone'] {
  if (value === null) return 'slate'
  if (value <= 2) return 'green'
  if (value <= 4) return 'blue'
  if (value <= 5) return 'amber'
  return 'red'
}

function metricTone(value: number | null): ProcessAnalysis['global'][number]['tone'] {
  if (value === null) return 'slate'
  if (value <= 2) return 'green'
  if (value <= 5) return 'amber'
  return 'red'
}

function timelineDateForStep(key: string, ticket: DashboardTicket, done: boolean) {
  const raw = ticket.raw
  if (hasWorkflowSource(raw)) {
    const value = workflowStepDateValue(raw, key)
    if (!done && value === undefined) return 'À venir'
    return formatTicketDetailDate(value)
  }
  const value =
    key === 'creation'
      ? ticket.dateCreationRaw
      : key === 'validation'
        ? firstValue(raw, ['date_validation', 'validatedAt', 'validationDate', 'validation_date'])
        : key === 'assignation'
          ? firstValue(raw, ['date_assignation', 'assignedAt', 'datePriseEnCharge', 'takenInChargeAt', 'attribution_date'])
          : key === 'achat'
            ? firstValue(raw, ['purchase_date', 'date_achat', 'achatEffectueAt', 'solution_date']) ?? ticket.dateResolutionRaw
            : firstValue(raw, ['closedate', 'closedAt', 'resolution_date', 'date_cloture']) ?? ticket.dateResolutionRaw

  if (!done && value === undefined) return 'À venir'
  return formatTicketDetailDate(value)
}

function timelineTimestamp(key: string, ticket: DashboardTicket) {
  const raw = ticket.raw
  if (hasWorkflowSource(raw)) return parseDateValue(workflowStepDateValue(raw, key))
  const value = key === 'creation' ? ticket.dateCreationRaw
    : key === 'validation' ? firstValue(raw, ['date_validation', 'validatedAt', 'validationDate', 'validation_date'])
      : key === 'assignation' ? firstValue(raw, ['date_assignation', 'assignedAt', 'datePriseEnCharge', 'takenInChargeAt', 'attribution_date'])
        : key === 'achat' ? firstValue(raw, ['purchase_date', 'date_achat', 'achatEffectueAt', 'solution_date']) ?? ticket.dateResolutionRaw
          : firstValue(raw, ['closedate', 'closedAt', 'resolution_date', 'date_cloture']) ?? ticket.dateResolutionRaw
  return parseDateValue(value)
}

function formatWorkflowDuration(from: Date | null, to: Date | null) {
  if (!from || !to || to.getTime() < from.getTime()) return null
  const totalMinutes = Math.floor((to.getTime() - from.getTime()) / 60_000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days} j ${hours} h`
  if (hours > 0) return `${hours} h ${minutes} min`
  return `${minutes} min`
}

function workflowDurationMinutes(from: Date | null, to: Date | null) {
  if (!from || !to || to.getTime() < from.getTime()) return null
  return Math.floor((to.getTime() - from.getTime()) / 60_000)
}

function workflowStepRecords(workflow: WorkflowData | null) {
  const items = workflow ? firstValue(workflow, ['etapes', 'steps', 'history', 'historique']) : undefined
  if (!Array.isArray(items)) return []
  return items.filter((item): item is WorkflowData => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
}

function fallbackTicketDateValue(ticket: DashboardTicket, step: string) {
  const raw = ticket.raw
  return step === 'creation'
    ? ticket.dateCreationRaw
    : step === 'validation'
      ? firstValue(raw, ['date_validation', 'validatedAt', 'validationDate', 'validation_date'])
      : step === 'assignation'
        ? firstValue(raw, ['date_assignation', 'assignedAt', 'datePriseEnCharge', 'takenInChargeAt', 'attribution_date'])
        : step === 'achat'
          ? firstValue(raw, ['purchase_date', 'date_achat', 'achatEffectueAt', 'solution_date']) ?? ticket.dateResolutionRaw
          : firstValue(raw, ['closedate', 'closedAt', 'resolution_date', 'date_cloture']) ?? ticket.dateResolutionRaw
}

function workflowTimelineKey(value: string) {
  if (/r[ée]solution|cl[oô]ture|livraison|ferm/.test(value)) return 'cloture'
  if (/attrib|assign/.test(value)) return 'assignation'
  if (/solution|achat/.test(value)) return 'achat'
  if (/valid/.test(value)) return 'validation'
  return 'creation'
}

function workflowTimelineState(status: string, index: number, items: WorkflowData[], rejected = false): TimelineStepState {
  if (rejected) return 'rejected'
  if (/done|completed|closed|resolved/.test(status)) return 'done'
  if (/current|progress|active|pending|assigned|todo|open/.test(status)) {
    return items.slice(0, index).some((step) => /current|progress|active|pending|assigned|todo|open/.test(stringValue(firstValue(step, ['statut'])).toLowerCase()))
      ? 'pending'
      : 'current'
  }
  const priorCurrent = items.slice(0, index).some((step) => /current|progress|active|pending|assigned|todo|open/.test(stringValue(firstValue(step, ['statut'])).toLowerCase()))
  return priorCurrent ? 'pending' : 'current'
}

function workflowStepIsRejected(step: WorkflowData) {
  return ['statut', 'detail', 'decision', 'resultat', 'status', 'state', 'label']
    .some((key) => isRejectedWorkflowValue(step[key]))
}

function workflowIsRejected(workflow: WorkflowData | null) {
  if (!workflow) return false
  return ['statut_global', 'global_status', 'statut', 'status', 'detail', 'decision', 'resultat']
    .some((key) => isRejectedWorkflowValue(workflow[key]))
}

function workflowRejectedStepIndex(items: WorkflowData[]) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const step = items[index]
    if (firstValue(step, ['date', 'acteur', 'detail']) !== undefined) return index
  }
  return items.findIndex((step) => workflowTimelineKey(stringValue(firstValue(step, ['etape'])).toLowerCase()) === 'validation')
}

function isRejectedWorkflowValue(value: unknown) {
  return /refused|rejected|rejet|refus/.test(stringValue(value).toLowerCase())
}

function timelineDefaultLabel(key: string) {
  if (key === 'creation') return 'Création demande'
  if (key === 'validation') return 'Validation'
  if (key === 'assignation') return 'Assignation à un acheteur'
  if (key === 'achat') return 'Traitement'
  return 'Livraison'
}

function timelineRoleLabel(key: string) {
  if (key === 'creation') return 'Createur'
  if (key === 'validation') return 'Validateur'
  if (key === 'assignation') return 'Acheteur assigne'
  if (key === 'achat') return 'Acheteur'
  return 'Cloture'
}

function timelineUserForStep(key: string, ticket: DashboardTicket) {
  const raw = ticket.raw
  if (hasWorkflowSource(raw)) {
    const workflowActor = actorName(workflowStepActorValue(raw, key))
    if (workflowActor) return workflowActor
  }
  const fallbackRequester = stringValue(firstValue(raw, ['demandeur', 'requester', 'createdBy', 'auteur', 'creator', 'created_by', 'requester_name'])) || 'Demandeur'
  const fallbackBuyer = hasAssignedBuyer(ticket.acheteur) ? ticket.acheteur : 'Non assigné'

  if (key === 'creation') return fallbackRequester
  if (key === 'validation') return stringValue(firstValue(raw, ['validateur', 'validator', 'validatedBy', 'validation_actor', 'approvedBy', 'approved_by'])) || 'Validateur'
  if (key === 'assignation') {
    return stringValue(firstValue(raw, ['assignedTo', 'assigned_to', 'buyer', 'acheteur_assigne', 'attributedBy', 'assignedBy', 'attribution_actor'])) || fallbackBuyer
  }
  if (key === 'achat') return stringValue(firstValue(raw, ['buyer', 'acheteur_assigne', 'purchase_actor', 'processedBy'])) || fallbackBuyer
  return stringValue(firstValue(raw, ['closedBy', 'cloturePar', 'resolvedBy', 'resolution_actor'])) || fallbackBuyer
}

function hasAssignedBuyer(value: string) {
  const normalized = value.trim().toLowerCase()
  return normalized !== '' && normalized !== 'non renseigné' && normalized !== 'non assigné' && normalized !== '-'
}

function firstValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (value !== null && value !== undefined && value !== '') return value
  }
  return undefined
}

function hasWorkflowSource(record: Record<string, unknown>) {
  return record[WORKFLOW_SOURCE_FLAG] === true
}

function workflowStepPrefix(key: string) {
  if (key === 'assignation') return 'attribution'
  if (key === 'achat') return 'solution'
  if (key === 'cloture') return 'resolution'
  return key
}

function workflowStepDateValue(record: Record<string, unknown>, key: string) {
  return firstValue(record, [`${workflowStepPrefix(key)}_date`])
}

function workflowStepActorValue(record: Record<string, unknown>, key: string) {
  return firstValue(record, [`${workflowStepPrefix(key)}_actor`])
}

function hasKnownDate(record: Record<string, unknown>, keys: string[]) {
  return firstValue(record, keys) !== undefined
}

function stringValue(value: unknown) {
  if (value === null || value === undefined || value === '') return ''
  return String(value)
}

function getLastTimelineUpdate(steps: TimelineStep[]) {
  const updated = [...steps].reverse().find((step) => step.state === 'done' && step.date !== '-' && step.date !== 'À venir')
  return updated?.date ?? '-'
}

function getElapsedSinceCreation(ticket: DashboardTicket | null, workflow?: WorkflowData | null) {
  const workflowData = workflow ? flattenWorkflow(workflow) : null
  const source = workflowData?.creation_date ?? ticket?.dateCreationRaw
  if (!source) return '-'

  const date = parseDateValue(source)
  if (!date) return '-'

  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000))
  if (days === 0) return "Aujourd'hui"
  if (days === 1) return '1 jour'
  return `${days} jours`
}

function parseDateValue(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const date = new Date(String(value).replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDays(value: number | null) {
  if (value === null) return '-'
  if (value === 0) return '< 1 j'
  if (value === 1) return '1 j'
  return `${value} j`
}

function formatCompactDuration(value: number | null) {
  if (value === null) return '-'
  if (value < 60) return `${value} min`

  const days = value / 1440
  if (days >= 1) {
    const roundedDays = Math.round(days * 10) / 10
    return `${String(roundedDays).replace('.', ',')} j`
  }

  const hours = Math.floor(value / 60)
  const minutes = value % 60
  if (minutes === 0) return `${hours} h`
  return `${hours} h ${minutes} min`
}

function formatPeriodLabel(from: string, to: string) {
  if (!from && !to) return 'Filtrage par période'
  if (from && to) return `${formatDateShort(from)} -> ${formatDateShort(to)}`
  if (from) return `Depuis ${formatDateShort(from)}`
  return `Jusqu'au ${formatDateShort(to)}`
}

function formatDateShort(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function formatDateFr(value: unknown) {
  if (value === null || value === undefined || value === '') return '-'

  const raw = String(value)
  const date = new Date(raw.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return raw

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatTicketDetailDate(value: unknown) {
  if (value === null || value === undefined || value === '') return '-'

  const raw = String(value)
  const date = new Date(raw.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return raw

  const formatted = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)

  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

function DelayBadge({ ticket }: { ticket: DashboardTicket }) {
  const status = calculateDelayStatus(ticket.raw, ticket.dateResolutionRaw)
  const tone = status.isLate ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
  return <span className={`ml-2 inline-flex rounded-lg px-2 py-1 text-[11px] font-semibold ${tone}`}>{status.label}</span>
}

function calculateDelayStatus(raw: Record<string, unknown>, resolutionOverride?: unknown) {
  if (isTicketRejected(raw)) return { isLate: false, label: 'Rejeté' }

  const deadline = parseDateValue(firstValue(raw, ['time_to_resolve', 'date_livraison_souhaitee', 'delivery_date', 'date_echeance', 'dateEcheance', 'deadline', 'echeance']))
  const closedAt = parseDateValue(resolutionOverride ?? firstValue(raw, ['closedate', 'closedAt', 'date_resolution', 'dateResolution', 'solvedate']))
  const closed = Boolean(closedAt) || Number(raw.status ?? 0) >= 6
  if (!deadline) return { isLate: false, label: closed ? 'Terminé' : 'Délai non renseigné' }
  const comparison = closedAt ?? new Date()
  const late = comparison.getTime() > deadline.getTime()
  return { isLate: late, label: closed ? (late ? 'Terminé en retard' : 'Terminé dans les délais') : (late ? 'En retard' : 'Dans les délais') }
}

function unwrapWorkflow(payload: unknown): WorkflowData {
  if (!payload || typeof payload !== 'object') return {}
  const record = payload as WorkflowData
  const nested = record.workflow ?? record.data
  return nested && typeof nested === 'object' && !Array.isArray(nested) ? nested as WorkflowData : record
}

function flattenWorkflow(workflow: WorkflowData) {
  const flattened: WorkflowData = { ...workflow }
  const aliases: Record<string, string> = { creation: 'creation', validation: 'validation', attribution: 'attribution', assignation: 'attribution', solution: 'solution', resolution: 'resolution' }
  for (const [source, prefix] of Object.entries(aliases)) {
    const step = workflow[source]
    if (!step || typeof step !== 'object' || Array.isArray(step)) continue
    const item = step as WorkflowData
    flattened[`${prefix}_date`] = firstValue(item, ['date', 'at', 'created_at', 'completed_at'])
    flattened[`${prefix}_actor`] = actorName(firstValue(item, ['acteur', 'actor', 'user', 'performed_by', 'auteur']))
  }
  const steps = firstValue(workflow, ['steps', 'etapes', 'history', 'historique'])
  if (Array.isArray(steps)) {
    for (const rawStep of steps) {
      if (!rawStep || typeof rawStep !== 'object' || Array.isArray(rawStep)) continue
      const step = rawStep as WorkflowData
      const name = stringValue(firstValue(step, ['key', 'type', 'name', 'label', 'etape', 'step'])).toLowerCase()
      const prefix = /cr[ée]ation/.test(name) ? 'creation'
        : /valid/.test(name) ? 'validation'
          : /attrib|assign/.test(name) ? 'attribution'
            : /solution|achat/.test(name) ? 'solution'
              : /r[ée]solution|cl[oô]ture|ferm/.test(name) ? 'resolution'
                : ''
      if (!prefix) continue
      flattened[`${prefix}_date`] = firstValue(step, ['date', 'at', 'created_at', 'completed_at', 'date_etape'])
      flattened[`${prefix}_actor`] = actorName(firstValue(step, ['acteur', 'actor', 'user', 'performed_by', 'auteur', 'utilisateur']))
    }
  }
  flattened.demandeur = flattened.creation_actor ?? flattened.demandeur
  flattened.validateur = flattened.validation_actor ?? flattened.validateur
  flattened.attributedBy = flattened.attribution_actor ?? flattened.attributedBy
  return flattened
}

function timelineDateLabel(key: string) {
  if (key === 'creation') return 'Créé le'
  if (key === 'validation') return 'Validé le'
  if (key === 'assignation') return 'Attribué le'
  if (key === 'achat') return 'Achat effectué le'
  return 'Clôturé le'
}

function workflowBuyer(workflow: WorkflowData) {
  return actorName(firstValue(workflow, ['acheteur_assigne', 'assigned_buyer', 'buyer', 'acheteur']))
}

function actorName(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object' && !Array.isArray(value)) return stringValue(firstValue(value as WorkflowData, ['name', 'full_name', 'display_name', 'nom']))
  return String(value)
}


