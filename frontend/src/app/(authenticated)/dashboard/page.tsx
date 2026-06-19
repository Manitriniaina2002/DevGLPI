'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  Filter,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingCart,
  Target,
  UserCheck,
} from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Card, CardContent, CardHeader } from '@/app/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/app/components/ui/dialog'
import { Input } from '@/app/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import { useHeaderActions } from '@/app/(authenticated)/header-actions-context'
import { useDashboardSummary } from '@/app/hooks/useDashboardSummary'
import { useTicketsList } from '@/app/hooks/useTicketsList'

type QuickTicketFilter = 'all' | 'rejected' | 'late'
type TimelineStepState = 'done' | 'current' | 'pending'
type PerformanceSort = 'score' | 'avg' | 'count' | 'sla'

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
  dateResolutionRaw?: unknown
  isLate: boolean
  raw: Record<string, unknown>
}

interface TimelineStep {
  key: string
  label: string
  date: string
  user: string
  state: TimelineStepState
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
  totalDays: number
  averageDays: number | null
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
}

interface WorkflowKpi {
  key: 'to_validate' | 'to_assign' | 'to_buy' | 'received'
  label: string
  description: string
  count: number
  tone: 'green' | 'blue' | 'amber' | 'slate'
  progressWeight: number
  icon: typeof ShieldCheck
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
  const [activeDashboardTab, setActiveDashboardTab] = useState('tickets')
  const [ticketPage, setTicketPage] = useState(1)
  const [ticketPageSize, setTicketPageSize] = useState<(typeof ticketPageSizeOptions)[number]>(25)
  const [projectOptions, setProjectOptions] = useState<string[]>([])
  const [buyerOptions, setBuyerOptions] = useState<string[]>([])
  const [buyerSort, setBuyerSort] = useState<PerformanceSort>('score')
  const [validatorSort, setValidatorSort] = useState<PerformanceSort>('avg')
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
    late_only: quickFilter === 'late' ? true : undefined,
  })

  const tickets = useMemo<DashboardTicket[]>(
    () =>
      apiTickets.map((ticket: any) => ({
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
        dateEcheance: formatDateFr(ticket.time_to_resolve ?? ticket.date_echeance ?? ticket.dateEcheance ?? ticket.deadline ?? ticket.echeance),
        dateResolutionRaw: ticket.date_resolution ?? ticket.dateResolution ?? ticket.closedate ?? ticket.solvedate,
        isLate: Boolean(ticket.is_late ?? ticket.enRetard),
        raw: ticket as Record<string, unknown>,
      })),
    [apiTickets],
  )

  const projects = useMemo(() => uniqueSorted(tickets.map((ticket) => ticket.projet)), [tickets])
  const buyers = useMemo(() => uniqueSorted(tickets.map((ticket) => ticket.acheteur)), [tickets])
  useEffect(() => {
    setProjectOptions((current) => uniqueSorted([...current, ...projects]))
  }, [projects])
  useEffect(() => {
    setBuyerOptions((current) => uniqueSorted([...current, ...buyers]))
  }, [buyers])
  const periodLabel = useMemo(() => formatPeriodLabel(dateFrom, dateTo), [dateFrom, dateTo])
  const dateRangeError = dateFrom !== '' && dateTo !== '' && dateFrom > dateTo
  const visibleTickets = useMemo(() => {
    const filtered = quickFilter === 'rejected' ? tickets.filter(isRejectedTicket) : tickets
    const query = search.trim().toLowerCase()
    if (!query) return filtered
    return filtered.filter((ticket) =>
      [ticket.reference, ticket.name, ticket.projet, ticket.acheteur, ticket.statut, ticket.priorite]
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [quickFilter, search, tickets])
  const ticketPageCount = Math.max(1, Math.ceil(visibleTickets.length / ticketPageSize))
  const paginatedTickets = useMemo(() => {
    const start = (ticketPage - 1) * ticketPageSize
    return visibleTickets.slice(start, start + ticketPageSize)
  }, [ticketPage, ticketPageSize, visibleTickets])
  const ticketPageStart = visibleTickets.length === 0 ? 0 : (ticketPage - 1) * ticketPageSize + 1
  const ticketPageEnd = Math.min(visibleTickets.length, ticketPage * ticketPageSize)
  const ticketPages = useMemo(() => getPaginationPages(ticketPage, ticketPageCount), [ticketPage, ticketPageCount])
  const workflowKpis = useMemo(() => buildWorkflowKpis(tickets), [tickets])
  const globalWorkflowProgress = useMemo(() => calculateGlobalWorkflowProgress(workflowKpis), [workflowKpis])
  const processAnalysis = useMemo(() => buildProcessAnalysis(tickets), [tickets])
  const selectedTimelineSteps = useMemo(() => buildTimelineSteps(selectedTicket), [selectedTicket])
  const sortedValidators = useMemo(
    () => sortActorPerformance(processAnalysis.validators, validatorSort),
    [processAnalysis.validators, validatorSort],
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
    () =>
      activeDashboardTab === 'tickets' ? (
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
      ) : null,
    [activeDashboardTab, buyer, buyerOptions, dateFrom, dateRangeError, dateTo, hasFilters, project, projectOptions, quickFilter, search],
  )

  useEffect(() => {
    setHeaderActions(headerFilters)
    return () => setHeaderActions(null)
  }, [headerFilters, setHeaderActions])

  return (
    <div className="min-h-screen space-y-5 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.08),transparent_28rem),linear-gradient(180deg,#f8fafc_0%,#ffffff_38%)] px-2 py-3 text-neutral-950 sm:px-4 lg:px-6">
      <div className="rounded-lg border border-slate-200/80 bg-white/90 px-4 py-4 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur sm:px-5 sm:py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-lg border border-ades-green/15 bg-ades-green/5 px-3 py-1 text-xs font-semibold text-ades-green">
              <BarChart3 className="size-3.5" />
              Pilotage achats
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">Tableau de bord</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-500">
              Suivi consolidé des demandes d'achat, priorités, échéances et performance du processus.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs font-medium text-neutral-600 shadow-sm">
            <span className="block text-[10px] font-semibold uppercase text-neutral-400">Période KPI</span>
            <span className="mt-0.5 block">
              {loading ? 'Chargement...' : error ? `Erreur: ${error}` : `${summary?.period?.from ?? '-'} -> ${summary?.period?.to ?? '-'}`}
            </span>
          </div>
        </div>

        <div className="mt-6">
          <WorkflowKpiOverview kpis={workflowKpis} progress={globalWorkflowProgress} />
        </div>
      </div>

      <Tabs value={activeDashboardTab} onValueChange={setActiveDashboardTab} className="gap-3">
        <TabsList className="hidden">
          <TabsTrigger value="tickets" className="px-4">
            <Filter className="size-4" />
            Tickets
          </TabsTrigger>
          <TabsTrigger value="process" className="px-4">
            <BarChart3 className="size-4" />
            Évaluation des processus
          </TabsTrigger>
        </TabsList>

      <Card className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)] gap-0">
        <CardHeader className="border-b border-slate-100 bg-white/95 px-5 py-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <TabsList className="h-10 w-full justify-start rounded-lg border border-slate-200 bg-slate-50 p-1 transition-all duration-200 sm:w-fit">
                <TabsTrigger value="tickets" className="h-8 rounded-md px-3 text-neutral-600 transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-ades-green data-[state=active]:shadow-sm">
                    <Filter className="size-4" />
                    Tickets
                  </TabsTrigger>
                  <TabsTrigger value="process" className="h-8 rounded-md px-3 text-neutral-600 transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-ades-green data-[state=active]:shadow-sm">
                    <BarChart3 className="size-4" />
                    Évaluation des processus
                  </TabsTrigger>
                </TabsList>
                <p className="text-sm text-neutral-500">
                  {ticketsLoading
                    ? 'Chargement des tickets...'
                    : ticketsError
                      ? `Erreur: ${ticketsError}`
                      : `${visibleTickets.length}/${tickets.length} ticket${tickets.length > 1 ? 's' : ''} affiché${visibleTickets.length > 1 ? 's' : ''}`}
                </p>
              </div>
            </div>

          </div>
        </CardHeader>
        <CardContent className="bg-slate-50/40 px-3 py-3 sm:px-4 sm:py-4 lg:px-5">
        <TabsContent value="tickets" className="m-0 space-y-3 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:duration-200">
          {visibleTickets.length === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-400">
              {ticketsLoading ? 'Chargement des tickets...' : 'Aucun ticket ne correspond aux filtres.'}
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="max-h-[70vh] min-h-[420px] overflow-auto">
              <table className="min-w-[860px] w-full divide-y divide-slate-100 text-left text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50/95 text-[11px] uppercase text-neutral-500 shadow-[0_1px_0_rgba(226,232,240,1)] backdrop-blur">
                  <tr>
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
                      onClick={() => setSelectedTicket(ticket)}
                      className={`cursor-pointer transition-all duration-200 hover:bg-slate-50/80 ${
                        ticket.isLate ? 'bg-red-50/40 hover:bg-red-50/70' : ''
                      }`}
                    >
                      <td className="max-w-[420px] px-4 py-3.5 text-neutral-800">
                        <span className="block truncate font-medium">{ticket.name}</span>
                      </td>
                      <td className="px-4 py-3.5 text-neutral-600">{ticket.projet}</td>
                      <td className="px-4 py-3.5 text-neutral-600">{ticket.acheteur}</td>
                      <td className="px-4 py-3.5">
                        <StatusBadge label={ticket.statut} code={ticket.statutCode} />
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
            sortedValidators={sortedValidators}
            onBuyerSortChange={setBuyerSort}
            onValidatorSortChange={setValidatorSort}
          />
        </TabsContent>
        </CardContent>
      </Card>
      </Tabs>

      <TicketProgressDialog
        ticket={selectedTicket}
        steps={selectedTimelineSteps}
        onOpenChange={(open) => {
          if (!open) setSelectedTicket(null)
        }}
      />
    </div>
  )
}


function WorkflowKpiOverview({ kpis, progress }: { kpis: WorkflowKpi[]; progress: number }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(220px,0.55fr)_1fr] lg:items-end">
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3">
          <p className="text-xs font-semibold uppercase text-neutral-400">Progression globale</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-semibold leading-none text-neutral-950">{progress}%</span>
            <span className="text-sm font-medium text-neutral-500">complété</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-ades-green transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((item) => {
            const Icon = item.icon
            const tone = workflowKpiTone(item.tone)
            return (
              <div key={item.key} className={`min-w-0 rounded-lg border px-4 py-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${tone.card}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className={`rounded-lg bg-white/85 p-2 ${tone.icon}`}>
                    <Icon className="size-4" />
                  </div>
                  <span className="text-3xl font-semibold leading-none text-neutral-950">{item.count}</span>
                </div>
                <p className="mt-3 truncate text-xs font-semibold uppercase text-neutral-500">{item.label}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-500">{item.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
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
  sortedValidators,
  onBuyerSortChange,
  onValidatorSortChange,
}: {
  analysis: ProcessAnalysis
  buyerSort: PerformanceSort
  validatorSort: PerformanceSort
  sortedValidators: ActorPerformance[]
  onBuyerSortChange: (value: PerformanceSort) => void
  onValidatorSortChange: (value: PerformanceSort) => void
}) {
  const stageInsights = getStageInsights(analysis)
  const buyerInsights = getBuyerInsights(analysis.buyers)
  const health = getProcessHealth(analysis, stageInsights, buyerInsights)

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="size-4 text-ades-green" />
              <h2 className="text-base font-semibold text-neutral-900">Santé du processus</h2>
            </div>
            <p className="mt-1 text-sm text-neutral-500">Lecture consolidée des délais, goulots d'étranglement et performances achat.</p>
          </div>
          <span className={`inline-flex w-fit items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${health.tone}`}>
            <Target className="size-3.5" />
            {health.status}
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {health.cards.map((card) => (
            <ProcessHealthCard key={card.label} {...card} />
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.45fr_0.85fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">Analyse détaillée par étape</h3>
              <p className="mt-1 text-xs text-neutral-500">Poids de chaque jalon dans le cycle global et dispersion des délais observés.</p>
            </div>
            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{analysis.stages.reduce((sum, stage) => sum + stage.count, 0)} mesures</span>
          </div>
          <div className="mt-4 space-y-3">
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
          description="Score calculé avec rapidité, volume traité et respect des délais."
          sortedActors={buyerInsights.ranked}
          sort={buyerSort}
          onSortChange={onBuyerSortChange}
          emptyLabel="Aucun acheteur assigné pour le moment."
        />
        <BuyerComparisonCard buyers={buyerInsights.ranked} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ActorRankingCard
          title="Performance des validateurs"
          description="Temps moyen de validation et validations réalisées dans les délais."
          sortedActors={sortedValidators}
          sort={validatorSort}
          onSortChange={onValidatorSortChange}
          emptyLabel="Aucun validateur identifié dans les tickets."
        />
        <div className="rounded-lg border border-red-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">Retards et blocages actifs</h3>
              <p className="mt-1 text-xs text-neutral-500">Tickets qui nécessitent une action prioritaire.</p>
            </div>
            <span className="rounded-lg bg-white px-2.5 py-1 text-sm font-semibold text-red-700">{analysis.blockers.length}</span>
          </div>
          <div className="mt-4 space-y-2">
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
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-neutral-900">{stage.label}</span>
            <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${performance.className}`}>{performance.label}</span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {stage.count} dossier{stage.count > 1 ? 's' : ''} traité{stage.count > 1 ? 's' : ''} · min {formatDays(stage.minDays)} · max {formatDays(stage.maxDays)}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-right">
          <MetricPill label="Moyenne" value={formatDays(stage.averageDays)} />
          <MetricPill label="Poids" value={`${stage.share}%`} />
          <MetricPill label="Volume" value={String(stage.count)} />
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
    <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-1">
      <p className="text-[10px] font-medium uppercase text-neutral-400">{label}</p>
      <p className="text-xs font-semibold text-neutral-900">{value}</p>
    </div>
  )
}

function ProcessHealthCard({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: 'green' | 'blue' | 'amber' | 'red' | 'slate' }) {
  const tones = {
    green: 'border-ades-green/20 bg-ades-green/5 text-ades-green',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
  }

  return (
    <div className={`rounded-lg border px-3 py-3 shadow-sm ${tones[tone]}`}>
      <p className="text-[11px] font-medium uppercase text-neutral-500">{label}</p>
      <p className="mt-2 truncate text-lg font-semibold" title={value}>{value}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-600">{hint}</p>
    </div>
  )
}

function CriticalStagesCard({ stages, blockers, globalAverage }: { stages: StageMetric[]; blockers: BlockedTicket[]; globalAverage: number | null }) {
  return (
    <div className="rounded-lg border border-red-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-red-600" />
            <h3 className="text-sm font-semibold text-neutral-900">Étapes critiques</h3>
          </div>
          <p className="mt-1 text-xs text-neutral-500">Top 3 des jalons les plus lents et dépassements de la moyenne globale.</p>
        </div>
        <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-red-700">{blockers.length} retard{blockers.length > 1 ? 's' : ''}</span>
      </div>

      <div className="mt-4 space-y-2">
        {stages.length === 0 ? (
          <EmptyInsight label="Aucune étape critique mesurable." />
        ) : (
          stages.map((stage, index) => {
            const overAverage = globalAverage !== null && stage.averageDays !== null && stage.averageDays > globalAverage
            return (
              <div key={stage.key} className="rounded-lg border border-red-100 bg-red-50/20 p-3">
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
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h3 className="text-sm font-semibold text-neutral-900">Comparaison des acheteurs</h3>
        <p className="mt-1 text-xs text-neutral-500">Volume, temps moyen et taux de retard pour détecter charge, performance et besoin d'accompagnement.</p>
      </div>
      <div className="mt-4 space-y-3">
        {visible.length === 0 ? (
          <EmptyInsight label="Aucune donnée acheteur comparable." />
        ) : (
          visible.map((buyer) => {
            const delayRate = buyer.total === 0 ? 0 : Math.round((buyer.lateCount / buyer.total) * 100)
            return (
              <div key={buyer.name} className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 transition duration-200 hover:bg-white hover:shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-neutral-900">{buyer.name}</p>
                  <span className="rounded-lg bg-white px-2 py-0.5 text-xs font-semibold text-ades-green">{buyer.score}/100</span>
                </div>
                <ComparisonBar label="Volume" value={buyer.total} max={maxVolume} color="bg-blue-500" suffix=" dossiers" />
                <ComparisonBar label="Temps moyen" value={buyer.averageDays ?? 0} max={maxAverage} color="bg-amber-500" suffix=" j" />
                <ComparisonBar label="Taux retard" value={delayRate} max={100} color={delayRate > 20 ? 'bg-red-500' : 'bg-ades-green'} suffix="%" />
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
    <div className="mt-2 grid grid-cols-[92px_1fr_64px] items-center gap-2">
      <span className="text-xs text-neutral-500">{label}</span>
      <div className="h-2 overflow-hidden rounded-full bg-white">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} />
      </div>
      <span className="text-right text-xs font-semibold text-neutral-700">{value}{suffix}</span>
    </div>
  )
}

function EmptyInsight({ label }: { label: string }) {
  return <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-neutral-500">{label}</p>
}

function ActorRankingCard({
  title,
  description,
  sortedActors,
  sort,
  onSortChange,
  emptyLabel,
}: {
  title: string
  description: string
  sortedActors: ActorPerformance[]
  sort: PerformanceSort
  onSortChange: (value: PerformanceSort) => void
  emptyLabel: string
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
          <p className="mt-1 text-xs text-neutral-500">{description}</p>
        </div>
        <Select value={sort} onValueChange={(value) => onSortChange(value as PerformanceSort)}>
          <SelectTrigger className="h-8 w-full bg-white text-xs sm:w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="score">Meilleur score</SelectItem>
            <SelectItem value="avg">Plus rapide</SelectItem>
            <SelectItem value="count">Plus actif</SelectItem>
            <SelectItem value="sla">Meilleur délai</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 space-y-2">
        {sortedActors.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-neutral-500">{emptyLabel}</p>
        ) : (
          sortedActors.slice(0, 6).map((actor, index) => <ActorPerformanceRow key={actor.name} actor={actor} rank={index + 1} />)
        )}
      </div>
    </div>
  )
}

function ActorPerformanceRow({ actor, rank }: { actor: ActorPerformance; rank: number }) {
  const rankLabel = rank === 1 ? 'Top Performer' : rank === 2 ? 'Second' : rank === 3 ? 'Troisième' : `Rang ${rank}`
  const rankClass = rank === 1 ? 'bg-amber-50 text-amber-700' : rank === 2 ? 'bg-slate-100 text-slate-700' : rank === 3 ? 'bg-orange-50 text-orange-700' : 'bg-white text-neutral-500'

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 transition duration-200 hover:bg-white hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-neutral-900">
            {rank}. {actor.name}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            {actor.total} demande{actor.total > 1 ? 's' : ''} · {formatDays(actor.totalDays)} traité · {actor.lateCount} retard{actor.lateCount > 1 ? 's' : ''}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${rankClass}`}>{rankLabel}</span>
          <p className="mt-1 text-xs font-semibold text-ades-green">{actor.score}/100</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <MetricPill label="Moyenne" value={formatDays(actor.averageDays)} />
        <MetricPill label="SLA" value={`${actor.slaRate}%`} />
        <MetricPill label="Terminés" value={String(actor.completed)} />
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white" title="Score de performance">
        <div className="h-full rounded-full bg-ades-green" style={{ width: `${actor.score}%` }} />
      </div>
    </div>
  )
}

function BlockedTicketRow({ ticket }: { ticket: BlockedTicket }) {
  const tone = ticket.tone === 'red' ? 'text-red-700 bg-red-50' : ticket.tone === 'amber' ? 'text-amber-700 bg-amber-50' : 'text-slate-700 bg-slate-100'

  return (
    <div className="rounded-lg border border-red-100 bg-white p-3 transition duration-200 hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-neutral-900">#{ticket.id} · {ticket.name}</p>
          <p className="mt-1 text-xs text-neutral-500">{ticket.owner}</p>
        </div>
        <span className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold ${tone}`}>{ticket.ageDays} j</span>
      </div>
      <p className="mt-2 text-xs font-medium text-red-700">{ticket.reason}</p>
    </div>
  )
}


function TicketProgressDialog({
  ticket,
  steps,
  onOpenChange,
}: {
  ticket: DashboardTicket | null
  steps: TimelineStep[]
  onOpenChange: (open: boolean) => void
}) {
  const currentStep = steps.find((step) => step.state === 'current') ?? [...steps].reverse().find((step) => step.state === 'done')
  const lastUpdate = getLastTimelineUpdate(steps)
  const elapsed = getElapsedSinceCreation(ticket)

  return (
    <Dialog open={Boolean(ticket)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <div className="flex flex-col gap-4 pr-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle>Suivi d'avancement de la demande</DialogTitle>
                {ticket && <StatusBadge label={ticket.statut} code={ticket.statutCode} />}
              </div>
              <DialogDescription>
                {ticket ? `Ticket ${ticket.reference} - ${ticket.name}` : 'Aucun ticket sélectionné.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          <ProgressInfoCard label="Étape actuelle" value={currentStep?.label ?? '-'} tone="green" />
          <ProgressInfoCard label="Temps écoulé" value={elapsed} tone="blue" />
          <ProgressInfoCard label="Dernière mise à jour" value={lastUpdate} tone="slate" />
        </div>

        <div className="grid gap-3 lg:grid-cols-5">
          {steps.map((step, index) => (
            <div key={step.key} className="relative">
              {index < steps.length - 1 && (
                <>
                  <div
                    className={`absolute left-6 top-10 h-[calc(100%_-_1rem)] w-px lg:hidden ${
                      step.state === 'done' ? 'bg-ades-green' : 'bg-slate-200'
                    }`}
                  />
                  <div
                    className={`absolute left-6 top-6 hidden h-0.5 w-[calc(100%_-_1.5rem)] lg:block ${
                      step.state === 'done' ? 'bg-ades-green' : 'bg-slate-200'
                    }`}
                  />
                </>
              )}
              <div
                className={`relative min-h-[144px] rounded-lg border p-4 transition-all duration-300 ${
                  step.state === 'current'
                    ? 'border-ades-green bg-ades-green/5 shadow-sm ring-2 ring-ades-green/10'
                    : step.state === 'done'
                      ? 'border-green-200 bg-white'
                      : 'border-slate-200 bg-slate-50/60'
                }`}
              >
                <div className="flex items-start gap-2">
                  <TimelineIcon state={step.state} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold ${step.state === 'pending' ? 'text-neutral-500' : 'text-neutral-900'}`}>{step.label}</p>
                    <p className="mt-2 text-xs text-neutral-500">{step.date}</p>
                    <p className="mt-1 truncate text-xs text-neutral-500">{step.user}</p>
                    <p
                      className={`mt-3 inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                        step.state === 'done'
                          ? 'bg-green-50 text-green-700'
                          : step.state === 'current'
                            ? 'bg-ades-green/10 text-ades-green'
                            : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {step.state === 'done' ? 'Terminé' : step.state === 'current' ? 'En cours' : 'À venir'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TimelineIcon({ state }: { state: TimelineStepState }) {
  if (state === 'done') return <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-green-600" />
  if (state === 'current') return <Clock3 className="mt-0.5 size-6 shrink-0 text-ades-green" />
  return <Circle className="mt-0.5 size-6 shrink-0 text-slate-300" />
}

function ProgressInfoCard({ label, value, tone }: { label: string; value: string; tone: 'green' | 'blue' | 'slate' }) {
  const tones = {
    green: 'border-ades-green/20 bg-ades-green/5 text-ades-green',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
  }

  return (
    <div className={`rounded-lg border px-4 py-3 ${tones[tone]}`}>
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  )
}

function StatusBadge({ label, code }: { label: string; code: number }) {
  const className =
    code === 5 || code === 6
      ? 'bg-green-50 text-green-700'
      : code === 4
        ? 'bg-amber-50 text-amber-700'
        : 'bg-blue-50 text-blue-700'

  return <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-medium ${className}`}>{label}</span>
}

function PriorityBadge({ label, code }: { label: string; code: number }) {
  const className = code >= 4 ? 'bg-red-50 text-red-700' : code >= 3 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-700'
  return <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-medium ${className}`}>{label}</span>
}

function isRejectedTicket(ticket: DashboardTicket) {
  const values = [
    ticket.statut,
    firstValue(ticket.raw, ['status_label', 'statut', 'status_name', 'statusName', 'etat', 'state']),
  ]
  return values
    .filter((value): value is string | number => value !== null && value !== undefined)
    .some((value) => /rejet|refus|reject/i.test(String(value)))
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

function buildTimelineSteps(ticket: DashboardTicket | null): TimelineStep[] {
  const labels = [
    { key: 'creation', label: 'Création de la demande' },
    { key: 'validation', label: 'Validation' },
    { key: 'assignation', label: 'Assignation à un acheteur' },
    { key: 'achat', label: 'Achat' },
    { key: 'cloture', label: 'Clôture' },
  ]

  if (!ticket) {
    return labels.map((step, index) => ({
      ...step,
      date: '-',
      user: '-',
      state: index === 0 ? 'current' : 'pending',
    }))
  }

  const assigned = hasAssignedBuyer(ticket.acheteur)
  const resolved = ticket.statutCode >= 5
  const closed = ticket.statutCode >= 6
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

  return labels.map((step, index) => ({
    ...step,
    date: timelineDateForStep(step.key, ticket, doneByKey[step.key]),
    user: timelineUserForStep(step.key, ticket),
    state: doneByKey[step.key] ? 'done' : index === firstPendingIndex ? 'current' : 'pending',
  }))
}

function buildWorkflowKpis(tickets: DashboardTicket[]): WorkflowKpi[] {
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
  ]

  tickets.forEach((ticket) => {
    const key = getWorkflowKpiKey(ticket)
    const kpi = kpis.find((item) => item.key === key)
    if (kpi) kpi.count += 1
  })

  return kpis
}

function calculateGlobalWorkflowProgress(kpis: WorkflowKpi[]) {
  const total = kpis.reduce((sum, item) => sum + item.count, 0)
  if (total === 0) return 0

  const weighted = kpis.reduce((sum, item) => sum + item.count * item.progressWeight, 0)
  return Math.round(weighted / total)
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
      card: 'border-amber-100 bg-amber-50/40',
      icon: 'text-amber-700',
    },
    blue: {
      card: 'border-blue-100 bg-blue-50/40',
      icon: 'text-blue-700',
    },
    green: {
      card: 'border-ades-green/10 bg-ades-green/5',
      icon: 'text-ades-green',
    },
    slate: {
      card: 'border-slate-200 bg-slate-50',
      icon: 'text-slate-700',
    },
  }
  return tones[tone]
}

function getWorkflowStageKey(ticket: DashboardTicket) {
  const raw = ticket.raw
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
    blockers: buildBlockedTickets(tickets),
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
    const completed = items.filter((ticket) => ticket.statutCode >= 5).length
    const inProgress = items.filter((ticket) => ticket.statutCode >= 2 && ticket.statutCode < 5).length
    const durations = items.map((ticket) => diffDays(getTicketDate(ticket, 'assignation'), getTicketDate(ticket, 'achat') ?? getTicketDate(ticket, 'cloture')))
    const averageDays = averageNumbers(
      durations,
    )
    const respected = items.filter((ticket) => !ticket.isLate).length
    const lateCount = items.length - respected
    const totalDays = durations.reduce<number>((sum, duration) => sum + (duration ?? 0), 0)
    const slaRate = Math.round((respected / Math.max(1, items.length)) * 100)
    return {
      name,
      total: items.length,
      totalDays,
      averageDays,
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
    const validated = items.filter((ticket) => getTicketDate(ticket, 'validation') !== null || ticket.statutCode >= 2).length
    const pending = items.filter((ticket) => ticket.statutCode <= 1).length
    const durations = items.map((ticket) => diffDays(getTicketDate(ticket, 'creation'), getTicketDate(ticket, 'validation')))
    const averageDays = averageNumbers(durations)
    const onTime = durations.filter((duration) => duration !== null && duration <= 2).length
    const totalDays = durations.reduce<number>((sum, duration) => sum + (duration ?? 0), 0)
    const slaRate = Math.round((onTime / Math.max(1, validated)) * 100)
    return {
      name,
      total: items.length,
      totalDays,
      averageDays,
      completed: validated,
      inProgress: pending,
      slaRate,
      lateCount: Math.max(0, validated - onTime),
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
    if (sort === 'sla') return b.slaRate - a.slaRate
    return (a.averageDays ?? Number.POSITIVE_INFINITY) - (b.averageDays ?? Number.POSITIVE_INFINITY)
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
  return {
    ranked,
    best: ranked[0] ?? null,
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
  const buyerTotal = analysis.buyers.reduce((sum, buyer) => sum + buyer.total, 0)
  const lateTotal = analysis.buyers.reduce((sum, buyer) => sum + buyer.lateCount, 0)
  const lateRate = buyerTotal === 0 ? 0 : Math.round((lateTotal / buyerTotal) * 100)
  const status = lateRate >= 25 || stageInsights.criticalStages.some((stage) => stage.tone === 'red') ? 'Sous tension' : lateRate >= 10 ? 'A surveiller' : 'Maitrise'
  const tone = status === 'Sous tension' ? 'bg-red-50 text-red-700' : status === 'A surveiller' ? 'bg-amber-50 text-amber-700' : 'bg-ades-green/10 text-ades-green'

  return {
    status,
    tone,
    cards: [
      { label: 'Durée moyenne', value: formatDays(cycle), hint: 'Cycle complet mesuré', tone: metricTone(cycle) },
      { label: 'Étape lente', value: slowestStage?.label ?? '-', hint: slowestStage ? formatDays(slowestStage.averageDays) : 'Aucune mesure', tone: slowestStage?.tone ?? 'slate' },
      { label: 'Étape performante', value: bestStage?.label ?? '-', hint: bestStage ? formatDays(bestStage.averageDays) : 'Aucune mesure', tone: bestStage?.tone ?? 'slate' },
      { label: 'Top acheteur', value: buyerInsights.best?.name ?? '-', hint: buyerInsights.best ? `${buyerInsights.best.score}/100 · ${buyerInsights.best.total} dossiers` : 'Aucun acheteur', tone: 'green' as const },
      { label: 'Acheteur lent', value: buyerInsights.slowest?.name ?? '-', hint: buyerInsights.slowest ? formatDays(buyerInsights.slowest.averageDays) : 'Aucune mesure', tone: buyerInsights.slowest ? 'amber' as const : 'slate' as const },
      { label: 'Taux retard', value: `${lateRate}%`, hint: `${lateTotal} retard${lateTotal > 1 ? 's' : ''} détecté${lateTotal > 1 ? 's' : ''}`, tone: lateRate >= 25 ? 'red' as const : lateRate >= 10 ? 'amber' as const : 'green' as const },
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
  const value =
    step === 'creation'
      ? ticket.dateCreationRaw
      : step === 'validation'
        ? firstValue(raw, ['date_validation', 'validatedAt', 'validationDate'])
        : step === 'assignation'
          ? firstValue(raw, ['date_assignation', 'assignedAt', 'datePriseEnCharge', 'takenInChargeAt'])
          : step === 'achat'
            ? firstValue(raw, ['purchase_date', 'date_achat', 'achatEffectueAt']) ?? ticket.dateResolutionRaw
            : firstValue(raw, ['closedate', 'closedAt']) ?? ticket.dateResolutionRaw

  return parseDateValue(value)
}

function diffDays(from: Date | null, to: Date | null) {
  if (!from || !to) return null
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000))
}

function averageNumbers(values: Array<number | null>) {
  const valid = values.filter((value): value is number => value !== null && Number.isFinite(value))
  if (valid.length === 0) return null
  return Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 10) / 10
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
  if (!done && key !== 'creation') return 'À venir'

  const raw = ticket.raw
  const value =
    key === 'creation'
      ? ticket.dateCreationRaw
      : key === 'validation'
        ? firstValue(raw, ['date_validation', 'validatedAt', 'validationDate'])
        : key === 'assignation'
          ? firstValue(raw, ['date_assignation', 'assignedAt', 'datePriseEnCharge', 'takenInChargeAt'])
          : key === 'achat'
            ? firstValue(raw, ['purchase_date', 'date_achat', 'achatEffectueAt']) ?? ticket.dateResolutionRaw
            : firstValue(raw, ['closedate', 'closedAt']) ?? ticket.dateResolutionRaw

  return formatTicketDetailDate(value)
}

function timelineUserForStep(key: string, ticket: DashboardTicket) {
  const raw = ticket.raw
  const fallbackRequester = stringValue(firstValue(raw, ['demandeur', 'requester', 'createdBy', 'auteur'])) || 'Demandeur'
  const fallbackBuyer = hasAssignedBuyer(ticket.acheteur) ? ticket.acheteur : 'Non assigné'

  if (key === 'creation') return fallbackRequester
  if (key === 'validation') return stringValue(firstValue(raw, ['validateur', 'validator', 'validatedBy'])) || 'Validateur'
  if (key === 'assignation') return fallbackBuyer
  if (key === 'achat') return fallbackBuyer
  return stringValue(firstValue(raw, ['closedBy', 'cloturePar'])) || fallbackBuyer
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

function getElapsedSinceCreation(ticket: DashboardTicket | null) {
  if (!ticket?.dateCreationRaw) return '-'

  const date = parseDateValue(ticket.dateCreationRaw)
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


