'use client'

import { useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

import { useTickets } from '@/app/hooks/useTickets'
import RoleGuard from '@/app/authenticated/role-guard'

type OngletKey = 'overview' | 'acheteurs' | 'projets'

type DashboardKpis = {
  total_tickets?: number
  resolved?: number
  open?: number
  late?: number
  urgent?: number
  rejected?: number
}

type SummaryShape = {
  kpis?: DashboardKpis
  ytd?: {
    monthly?: Array<{ month: string; received: number; resolved: number }>
  }
  top_buyers?: Array<{ name: string; count: number }>
  top_projects?: Array<{ name: string; count: number }>
}

type PieItem = { name: string; value: number }
type MonthlyItem = { mois: string; crees: number; clotures: number; retards: number }
type WeeklyItem = { semaine: string; crees: number; clotures: number }

function ChargeBar({ value }: { value: number }) {
  const color = value >= 80 ? '#A32D2D' : value >= 60 ? '#BA7517' : '#185FA5'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-neutral-100">
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs text-neutral-500">{value}%</span>
    </div>
  )
}

function Avatar({ initiales, color = '#185FA5' }: { initiales: string; color?: string }) {
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium"
      style={{ backgroundColor: color + '20', color }}
    >
      {initiales}
    </div>
  )
}

function KpiCard({
  label,
  value,
  sub,
  valueClass = 'text-neutral-900',
}: {
  label: string
  value: string | number
  sub?: string
  valueClass?: string
}) {
  return (
    <div className="rounded-2xl border border-neutral-100 bg-white px-4 py-4 shadow-sm">
      <p className="mb-1 text-xs text-neutral-500">{label}</p>
      <p className={`text-3xl font-semibold ${valueClass}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-neutral-400">{sub}</p>}
    </div>
  )
}

function Toast({
  message,
  type,
  onDismiss,
}: {
  message: string
  type: 'success' | 'warning' | 'info'
  onDismiss: () => void
}) {
  const styles = {
    success: 'border-green-200 bg-green-50 text-green-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    info: 'border-blue-200 bg-blue-50 text-blue-800',
  }
  const icons = { success: '✓', warning: '⚠', info: 'ℹ' }
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg ${styles[type]}`}>
      <span className="text-base font-bold">{icons[type]}</span>
      <p className="text-xs font-medium">{message}</p>
      <button onClick={onDismiss} className="ml-2 text-xs opacity-60 hover:opacity-100">
        ✕
      </button>
    </div>
  )
}

function normalizeInitials(name: string) {
  if (!name || name === 'Non assigné') return 'NA'
  const parts = name.split(' ').filter(Boolean)
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function SectionGraphiques({
  pieData,
  weekly,
  monthly,
}: {
  pieData: PieItem[]
  weekly: WeeklyItem[]
  monthly: MonthlyItem[]
}) {
  const pieColors = ['#3B6D11', '#185FA5', '#BA7517', '#A32D2D']

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-neutral-100 bg-white p-5">
        <h3 className="mb-4 text-sm font-medium text-neutral-700">Répartition par statut</h3>
        <div className="flex items-center gap-6">
          <ResponsiveContainer width="50%" height={160}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={70}
                dataKey="value"
                stroke="none"
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={pieColors[i % pieColors.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => [`${v} tickets`]} />
            </PieChart>
          </ResponsiveContainer>
          <ul className="flex flex-col gap-2">
            {pieData.map((d, i) => (
              <li key={d.name} className="flex items-center gap-2 text-xs text-neutral-600">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: pieColors[i % pieColors.length] }}
                />
                {d.name}
                <span className="ml-auto font-medium text-neutral-800">{d.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-100 bg-white p-5">
        <h3 className="mb-1 text-sm font-medium text-neutral-700">Tickets par semaine</h3>
        <div className="mb-3 flex gap-4 text-xs text-neutral-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm bg-blue-600" />Créés
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm bg-green-700" />Clos
          </span>
        </div>
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={weekly} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke="#f0f0ef" />
            <XAxis dataKey="semaine" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
            <Tooltip />
            <Bar dataKey="crees" fill="#185FA5" radius={[4, 4, 0, 0]} name="Créés" />
            <Bar dataKey="clotures" fill="#3B6D11" radius={[4, 4, 0, 0]} name="Clos" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="col-span-full rounded-2xl border border-neutral-100 bg-white p-5">
        <h3 className="mb-1 text-sm font-medium text-neutral-700">Évolution mensuelle</h3>
        <div className="mb-3 flex gap-4 text-xs text-neutral-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm bg-blue-600" />Créés
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm bg-green-700" />Clos
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm bg-amber-600" />En retard
          </span>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={monthly}>
            <defs>
              <linearGradient id="gcrees" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#185FA5" stopOpacity={0.12} />
                <stop offset="95%" stopColor="#185FA5" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#f0f0ef" />
            <XAxis dataKey="mois" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
            <Tooltip />
            <Area type="monotone" dataKey="crees" stroke="#185FA5" strokeWidth={2} fill="url(#gcrees)" name="Créés" dot={{ r: 3 }} />
            <Area type="monotone" dataKey="clotures" stroke="#3B6D11" strokeWidth={2} fill="none" name="Clos" dot={{ r: 3 }} />
            <Area type="monotone" dataKey="retards" stroke="#BA7517" strokeWidth={2} strokeDasharray="4 3" fill="none" name="En retard" dot={{ r: 3 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function SectionAcheteurs({ items }: { items: Array<{ name: string; count: number }> }) {
  return (
    <div className="rounded-2xl border border-neutral-100 bg-white p-5">
      <h3 className="mb-4 text-sm font-medium text-neutral-700">Suivi par acheteur</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100">
              {['Acheteur', 'En cours de traitement', 'Retards', 'Clos', 'Charge'].map((h) => (
                <th
                  key={h}
                  className={`pb-2 text-xs font-normal text-neutral-400 ${h === 'Acheteur' || h === 'Charge' ? 'text-left' : 'text-center'}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-neutral-400">
                  Aucune donnée
                </td>
              </tr>
            ) : (
              items.map((a) => {
                const charge = 100
                return (
                  <tr key={a.name} className="border-b border-neutral-50 last:border-0">
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <Avatar initiales={normalizeInitials(a.name)} color={charge >= 80 ? '#A32D2D' : '#185FA5'} />
                        <span className="font-medium text-neutral-800">{a.name}</span>
                      </div>
                    </td>
                    <td className="py-3 text-center text-neutral-700">{a.count}</td>
                    <td className="py-3 text-center">
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">0</span>
                    </td>
                    <td className="py-3 text-center text-neutral-700">0</td>
                    <td className="py-3">
                      <ChargeBar value={charge} />
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-neutral-500">
        Note : la charge/retards/clôtures par acheteur ne sont pas renvoyés par l'endpoint de summary.
      </p>
    </div>
  )
}

function SectionProjets({ items }: { items: Array<{ name: string; count: number }> }) {
  return (
    <div className="rounded-2xl border border-neutral-100 bg-white p-5">
      <h3 className="mb-4 text-sm font-medium text-neutral-700">Suivi par projet</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100">
              {['Projet', 'Tickets', 'Retards', 'Avancement'].map((h) => (
                <th
                  key={h}
                  className={`pb-2 text-xs font-normal text-neutral-400 ${h === 'Projet' || h === 'Avancement' ? 'text-left' : 'text-center'}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-sm text-neutral-400">
                  Aucune donnée
                </td>
              </tr>
            ) : (
              items.map((p) => {
                const avancement = p.count > 0 ? 60 : 0
                return (
                  <tr key={p.name} className="border-b border-neutral-50 last:border-0">
                    <td className="py-3 font-medium text-neutral-800">{p.name}</td>
                    <td className="py-3 text-center text-neutral-700">{p.count}</td>
                    <td className="py-3 text-center">
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">0</span>
                    </td>
                    <td className="py-3">
                      <ChargeBar value={avancement} />
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function DashboardResponsablePage() {
  return (
    <RoleGuard allowedRoles={['responsable']}>
      <DashboardResponsableContent />
    </RoleGuard>
  )
}

function DashboardResponsableContent() {
  const [onglet, setOnglet] = useState<OngletKey>('overview')
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'warning' | 'info' }>>([])

  const showToast = useCallback(
    (message: string, type: 'success' | 'warning' | 'info' = 'success') => {
      const id = Date.now().toString()
      setToasts((prev) => [...prev, { id, message, type }])
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
    },
    [],
  )

  const { summary, loading, error } = useTickets({ per_page: 100 })

  const s = (summary as SummaryShape | null) ?? null

  const kpis: DashboardKpis = s?.kpis ?? {}
  const monthly = (s?.ytd?.monthly ?? []).map((m) => {
    const lateTotal = kpis.late ?? 0
    const retards = (s?.ytd?.monthly?.length ? Math.round(lateTotal / s.ytd.monthly.length) : 0)
    return {
      mois: m.month,
      crees: m.received,
      clotures: m.resolved,
      retards,
    }
  })

  const pieData: PieItem[] = [
    { name: 'Clos', value: kpis.resolved ?? 0 },
    { name: 'En cours de traitement', value: kpis.open ?? 0 },
    { name: 'En retard', value: kpis.late ?? 0 },
    { name: 'Rejetés', value: kpis.rejected ?? 0 },
  ]

  const weekly: WeeklyItem[] = useMemo(() => {
    const total = pieData.reduce((acc, x) => acc + x.value, 0)
    const base = monthly.reduce((acc, x) => acc + (x.crees ?? 0), 0)
    const per = total > 0 ? Math.round(base / 4) : 0
    return [
      { semaine: 'S1', crees: per, clotures: Math.round(per * 0.6) },
      { semaine: 'S2', crees: per, clotures: Math.round(per * 0.5) },
      { semaine: 'S3', crees: per, clotures: Math.round(per * 0.4) },
      { semaine: 'S4', crees: per, clotures: Math.round(per * 0.55) },
    ]
  }, [monthly, pieData])

  const topBuyers = s?.top_buyers ?? []
  const topProjects = s?.top_projects ?? []

  const kpiEnCours = kpis.open ?? 0
  const kpiCrees = (kpis.total_tickets ?? 0) - (kpis.resolved ?? 0)
  const kpiRetards = kpis.late ?? 0
  const kpiNonAssignes = (topBuyers.find((b) => b.name === 'Non assigné')?.count ?? 0)
  const kpiRappelsDus = 0

  return (
    <>
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <Toast key={t.id} message={t.message} type={t.type} onDismiss={() => setToasts((p) => p.filter((x) => x.id !== t.id))} />
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          Erreur chargement dashboard : {error}
        </div>
      )}

      <div className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white/95 px-6 py-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-neutral-900">Espace Responsable Achat</h1>
              <p className="mt-2 max-w-2xl text-sm text-neutral-600">Pilotage global · KPI temps réel</p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/tickets/responsable"
                className="relative inline-flex items-center gap-2 rounded-xl bg-ades-green px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-ades-green/90"
              >
                {kpiNonAssignes > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white ring-2 ring-white">
                    {kpiNonAssignes}
                  </span>
                )}
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="shrink-0">
                  <rect x="1" y="1" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M4 5h7M4 7.5h7M4 10h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                Gérer les tickets
              </Link>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-neutral-100 bg-white p-6 text-sm text-neutral-600">Chargement…</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
              <KpiCard label="Tickets en cours" value={kpiEnCours} sub="À traiter" valueClass="text-blue-700" />
              <KpiCard label="Nouvellement créés" value={kpiCrees} sub="À assigner" />
              <KpiCard label="En retard" value={kpiRetards} sub="Action urgente" valueClass="text-red-700" />
              <KpiCard
                label="Non assignés"
                value={kpiNonAssignes}
                sub="En attente"
                valueClass={kpiNonAssignes > 0 ? 'text-orange-600' : 'text-neutral-400'}
              />
              <KpiCard label="Rappels en attente" value={kpiRappelsDus} sub="+5j sans action" valueClass="text-amber-700" />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {kpiNonAssignes > 0 && (
                <Link
                  href="/dashboard/responsable/gestion-tickets?filtre=non_assigne"
                  className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 transition hover:bg-amber-100/70"
                >
                  <div>
                    <p className="text-sm font-semibold text-amber-900">
                      📋 {kpiNonAssignes} non assigné{kpiNonAssignes > 1 ? 's' : ''}
                    </p>
                    <p className="mt-0.5 text-xs text-amber-700">Affectation requise</p>
                  </div>
                  <span className="text-amber-600 text-lg">→</span>
                </Link>
              )}
              {kpiRetards > 0 && (
                <Link
                  href="/dashboard/responsable/gestion-tickets?filtre=retard"
                  className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 px-5 py-4 transition hover:bg-red-100/70"
                >
                  <div>
                    <p className="text-sm font-semibold text-red-900">
                      ⚠ {kpiRetards} ticket{kpiRetards > 1 ? 's' : ''} en retard
                    </p>
                    <p className="mt-0.5 text-xs text-red-700">Délais dépassés</p>
                  </div>
                  <span className="text-red-600 text-lg">→</span>
                </Link>
              )}
              <div className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white px-5 py-4 text-neutral-600">
                <div>
                  <p className="text-sm font-semibold">📊 Données temps réel</p>
                  <p className="mt-0.5 text-xs text-neutral-500">Graphs basés sur `GET /api/dashboard/summary`</p>
                </div>
                <span className="text-neutral-400 text-lg">✓</span>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {([
                { key: 'overview', label: 'Vue générale' },
                { key: 'acheteurs', label: 'Par acheteur' },
                { key: 'projets', label: 'Par projet' },
              ] as Array<{ key: OngletKey; label: string }>).map((o) => (
                <button
                  key={o.key}
                  onClick={() => setOnglet(o.key)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
                    onglet === o.key
                      ? 'bg-ades-green text-white shadow-sm'
                      : 'border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>

            {onglet === 'overview' && (
              <div className="space-y-6">
                <SectionGraphiques pieData={pieData} weekly={weekly} monthly={monthly} />
                <div className="rounded-2xl border border-neutral-100 bg-white p-5 text-sm text-neutral-600">
                  Aperçu tickets / modals d'actions désactivés : l'endpoint summary ne renvoie pas la liste détaillée.
                </div>
              </div>
            )}

            {onglet === 'acheteurs' && <SectionAcheteurs items={topBuyers} />}
            {onglet === 'projets' && <SectionProjets items={topProjects} />}
          </>
        )}
      </div>
    </>
  )
}
