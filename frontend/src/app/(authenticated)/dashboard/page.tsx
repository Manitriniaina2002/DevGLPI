'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'

const roleOptions = [
  {
    id: 'demandeur',
    href: '/dashboard/demandeur',
    title: 'Demandeur / Observateur',
    description: 'Suivez vos demandes, validations et clôtures dans un espace adapté à votre rôle.',
    stats: [
      { label: 'Demandes en attente', value: '14' },
      { label: 'Demandes attribuées', value: '3' },
    ],
  },
  {
    id: 'responsable',
    href: '/dashboard/responsable',
    title: 'Responsable Achat',
    description: 'Pilotez les priorités, les retards et les performances de vos acheteurs.',
    stats: [
      { label: 'Demandes créées', value: '63' },
      { label: 'Retards détectés', value: '8' },
    ],
  },
  {
    id: 'acheteur',
    href: '/dashboard/acheteur',
    title: 'Acheteur',
    description: 'Gérez vos tickets assignés et suivez les livraisons urgentes.',
    stats: [
      { label: 'Tickets assignés', value: '20' },
      { label: 'Urgents', value: '4' },
    ],
  },
]

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="rounded-[2rem] border border-slate-200 bg-white/95 px-6 py-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-neutral-900">Tableau de bord ADES</h1>
            <p className="mt-2 max-w-2xl text-sm text-neutral-600">
              Choisissez le rôle qui correspond à votre activité pour accéder à une vue métier dédiée.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {roleOptions.map((role) => (
              <Link
                key={role.id}
                href={role.href}
                className="rounded-[1.75rem] border border-slate-200 bg-white p-5 transition hover:border-ades-green hover:bg-ades-green/5"
              >
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">{role.title}</h2>
                  <p className="mt-2 text-sm text-neutral-600">{role.description}</p>
                </div>
                <div className="mt-5 grid gap-2">
                  {role.stats.map((stat) => (
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
          <CardTitle>Structure des vues</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-neutral-600">
            Chaque vue est indépendante pour mieux organiser les besoins métiers :
            <strong className="text-neutral-900"> Demandeur</strong>,
            <strong className="text-neutral-900"> Responsable Achat</strong> et
            <strong className="text-neutral-900"> Acheteur</strong>.
          </p>
          <ul className="mt-4 space-y-3 text-sm text-neutral-700">
            <li className="rounded-3xl border border-[rgba(76,139,64,0.12)] bg-white/90 px-4 py-3">
              Vue Demandeur : suivi des demandes et du statut de validation.
            </li>
            <li className="rounded-3xl border border-[rgba(76,139,64,0.12)] bg-white/90 px-4 py-3">
              Vue Responsable Achat : pilotage des tickets, retards et priorités.
            </li>
            <li className="rounded-3xl border border-[rgba(76,139,64,0.12)] bg-white/90 px-4 py-3">
              Vue Acheteur : gestion des demandes assignées et des actions urgentes.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
