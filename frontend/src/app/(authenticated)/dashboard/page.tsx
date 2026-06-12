'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { useEffect, useMemo, useState } from 'react'
import { useDashboardSummary } from '@/app/hooks/useDashboardSummary'

type Role = 'demandeur' | 'acheteur' | 'responsable'

function safeDecodeRoleFromJwt(token: string): Role | null {
  try {
    const payloadPart = token.split('.')[1]
    if (!payloadPart) return null
    const payloadJson = atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(payloadJson)
    const r = payload?.role
    if (r === 'demandeur' || r === 'acheteur' || r === 'responsable') return r
    return null
  } catch {
    return null
  }
}

const roleOptions = [
  {
    id: 'demandeur' as Role,
    href: '/dashboard/demandeur',
    title: 'Demandeur / Observateur',
    description: 'Suivez vos demandes, validations et clôtures dans un espace adapté à votre rôle.',
  },
  {
    id: 'responsable' as Role,
    href: '/dashboard/responsable',
    title: 'Responsable Achat',
    description: 'Pilotez les priorités, les retards et les performances de vos acheteurs.',
  },
  {
    id: 'acheteur' as Role,
    href: '/dashboard/acheteur',
    title: 'Acheteur',
    description: 'Gérez vos tickets assignés et suivez les livraisons urgentes.',
  },
]

const roleLabels: Record<Role, string> = {
  demandeur: 'Demandeur',
  responsable: 'Responsable Achat',
  acheteur: 'Acheteur',
}

export default function DashboardPage() {
  const [role, setRole] = useState<Role | null>(null)

  useEffect(() => {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        setRole(null)
        return
      }
      setRole(safeDecodeRoleFromJwt(token))
    } catch {
      setRole(null)
    }
  }, [])

  const [year, setYear] = useState<number | undefined>(undefined)
  const { summary, loading, error } = useDashboardSummary({ year })

  const kpis = summary?.kpis ?? {}

  const roleStats = useMemo(() => {
    return {
      demandeur: [
        { label: 'Demandes en attente', value: kpis.open ?? 0 },
        { label: 'Demandes attribuées', value: kpis.open ?? 0 },
      ],
      responsable: [
        { label: 'Demandes créées', value: kpis.total_tickets ?? 0 },
        { label: 'Retards détectés', value: kpis.late ?? 0 },
      ],
      acheteur: [
        { label: 'Tickets assignés', value: kpis.open ?? 0 },
        { label: 'Urgents', value: kpis.urgent ?? 0 },
      ],
    } as Record<string, Array<{ label: string; value: number }>>
  }, [kpis])

  const visibleRoles = useMemo(() => {
    if (!role) return roleOptions
    return roleOptions.filter((r) => r.id === role)
  }, [role])

  if (role === null) {
    return (
      <div className="space-y-8">
        <div className="rounded-[2rem] border border-slate-200 bg-white/95 px-6 py-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="py-10 text-center text-sm text-neutral-500">Vérification…</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="rounded-[2rem] border border-slate-200 bg-white/95 px-6 py-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-neutral-900">
                Tableau de bord ADES
                <span className="ml-3 inline-flex items-center rounded-full bg-ades-green/10 px-3 py-1 text-sm font-medium text-ades-green">
                  {roleLabels[role]}
                </span>
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-neutral-600">
                KPI globaux (filtrés selon votre rôle) + accès rapide à votre vue personnalisée.
              </p>
            </div>
            <div className="text-xs text-neutral-500">
              {loading ? 'Chargement…' : error ? `Erreur: ${error}` : `Période: ${summary?.period?.from ?? '—'} → ${summary?.period?.to ?? '—'}`}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {visibleRoles.map((roleOption) => (
              <Link
                key={roleOption.id}
                href={roleOption.href}
                className="rounded-[1.75rem] border border-ades-green bg-white p-5 shadow-sm transition hover:border-ades-green hover:bg-ades-green/5"
              >
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">{roleOption.title}</h2>
                  <p className="mt-2 text-sm text-neutral-600">{roleOption.description}</p>
                </div>
                <div className="mt-5 grid gap-2">
                  {(roleStats as any)[roleOption.id]?.map((stat: any) => (
                    <div key={stat.label} className="rounded-3xl bg-slate-50 p-3 text-sm text-neutral-700">
                      <span className="block font-semibold text-2xl text-neutral-900">{stat.value}</span>
                      <span>{stat.label}</span>
                    </div>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <Card className="card-ades">
        <CardHeader>
          <CardTitle>Votre espace {roleLabels[role]}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-neutral-600">
            Vous êtes connecté en tant que <strong className="text-neutral-900">{roleLabels[role]}</strong>.
            Utilisez la carte ci-dessus pour accéder à votre tableau de bord dédié, ou naviguez via le menu latéral.
          </p>
          <ul className="mt-4 space-y-3 text-sm text-neutral-700">
            <li className="rounded-3xl border border-[rgba(76,139,64,0.12)] bg-white/90 px-4 py-3">
              <strong>Vue {roleLabels[role]}</strong> : accédez à vos indicateurs et actions spécifiques.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
