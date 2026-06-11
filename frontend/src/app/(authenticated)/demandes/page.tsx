'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Input } from '@/app/components/ui/input'
import { demandes, type StatutDemande } from '../demandeur-data'

const statutConfig: Record<StatutDemande, { label: string; className: string }> = {
  en_attente: { label: 'En attente', className: 'bg-yellow-50 text-ades-yellow' },
  attribue: { label: 'Attribué', className: 'bg-orange-50 text-orange-600' },
  circuit_validation: { label: 'Circuit validation', className: 'bg-blue-50 text-blue-700' },
  valide_commande: { label: 'Validé / Commandé', className: 'bg-cyan-50 text-info-600' },
  cloture: { label: 'Clôturé', className: 'bg-neutral-100 text-neutral-600' },
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function DemandesPage() {
  const [query, setQuery] = useState('')
  const [statut, setStatut] = useState<'all' | StatutDemande>('all')

  const filteredDemandes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return demandes.filter((demande) => {
      const matchesStatut = statut === 'all' ? true : demande.statut === statut
      const haystack = `${demande.reference} ${demande.titre} ${demande.attribueA ?? ''}`.toLowerCase()
      const matchesQuery = normalizedQuery ? haystack.includes(normalizedQuery) : true
      return matchesStatut && matchesQuery
    })
  }, [query, statut])

  const summary = useMemo(
    () => ({
      total: demandes.length,
      filtered: filteredDemandes.length,
      en_attente: demandes.filter((demande) => demande.statut === 'en_attente').length,
      attribue: demandes.filter((demande) => demande.statut === 'attribue').length,
      circuit_validation: demandes.filter((demande) => demande.statut === 'circuit_validation').length,
      valide_commande: demandes.filter((demande) => demande.statut === 'valide_commande').length,
      cloture: demandes.filter((demande) => demande.statut === 'cloture').length,
    }),
    [filteredDemandes.length],
  )

  return (
    <div className="min-w-0">
      <div className="rounded-2xl border border-slate-200 bg-white/95 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className="border-b border-[rgba(76,139,64,0.12)] px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <Link
                href="/dashboard/demandeur"
                className="inline-flex items-center text-sm font-medium text-ades-green hover:underline"
              >
                ← Retour au dashboard
              </Link>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold text-neutral-900">Toutes les demandes</h1>
                <span className="rounded-full bg-ades-green/10 px-2.5 py-1 text-xs font-medium text-ades-green">
                  {summary.filtered}/{summary.total}
                </span>
              </div>
              {/* <p className="text-sm text-neutral-600">Filtrage instantané, dans un seul bloc avec la liste.</p> */}
            </div>
            <div className="flex flex-col items-end gap-3">
              <Link
                href="/tickets/demandeur"
                className="inline-flex items-center justify-center rounded-xl border border-ades-gray bg-ades-white px-4 py-2.5 text-sm font-medium text-ades-green shadow-sm transition hover:bg-slate-100 hover:border-slate-300">
                Faire une demande 
              </Link>
              <div className="flex flex-wrap justify-end gap-2 text-xs">
                <span className="inline-flex items-center rounded-full bg-yellow-50 px-3 py-1 font-medium text-ades-yellow">Attente {summary.en_attente}</span>
                <span className="inline-flex items-center rounded-full bg-orange-50 px-3 py-1 font-medium text-orange-600">Attribué {summary.attribue}</span>
                <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700">Validation {summary.circuit_validation}</span>
                <span className="inline-flex items-center rounded-full bg-cyan-50 px-3 py-1 font-medium text-info-600">Validé {summary.valide_commande}</span>
                <span className="inline-flex items-center rounded-full bg-neutral-100 px-3 py-1 font-medium text-neutral-600">Cloturé {summary.cloture}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-b border-[rgba(76,139,64,0.08)] px-5 py-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_220px_auto] lg:items-end">
            <div className="space-y-2">
              <label htmlFor="q" className="text-xs font-medium text-neutral-500">
                Recherche
              </label>
              <Input
                id="q"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Référence, titre, responsable..."
                className="h-10 rounded-xl border-slate-200 bg-white"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="statut" className="text-xs font-medium text-neutral-500">
                Statut
              </label>
              <select
                id="statut"
                value={statut}
                onChange={(event) => setStatut(event.target.value as 'all' | StatutDemande)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-neutral-700 shadow-sm outline-none transition focus:border-ades-green focus:ring-2 focus:ring-ades-green/20"
              >
                <option value="all">Tous les statuts</option>
                {Object.entries(statutConfig).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  setStatut('all')
                }}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-ades-green/20 bg-ades-green/10 px-4 text-sm font-medium text-ades-black shadow-sm transition hover:bg-slate-100 hover:border-slate-300"
              >
                Réinitialiser
              </button>
            </div>
          </div>
        </div>

        <div className="max-h-[74vh] overflow-y-auto overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-[rgba(76,139,64,0.12)] bg-slate-50/95 text-left text-xs font-medium text-neutral-500 backdrop-blur">
                <th className="px-5 py-3">Référence</th>
                <th className="px-5 py-3">Intitulé</th>
                <th className="px-5 py-3">Statut</th>
                <th className="px-5 py-3">Attribué à</th>
                <th className="px-5 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(76,139,64,0.08)]">
              {filteredDemandes.length === 0 ? (
                <tr>
                  <td className="px-5 py-10 text-center text-sm text-neutral-500" colSpan={5}>
                    Aucune demande ne correspond à ces filtres.
                  </td>
                </tr>
              ) : (
                filteredDemandes.map((demande) => (
                  <tr key={demande.id} className="transition hover:bg-slate-50">
                    <td className="px-5 py-4 font-mono text-xs text-neutral-500">{demande.reference}</td>
                    <td className="px-5 py-4 font-medium text-neutral-800">{demande.titre}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statutConfig[demande.statut].className}`}>
                        {statutConfig[demande.statut].label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-neutral-600">
                      {demande.attribueA ?? <span className="text-neutral-300">—</span>}
                    </td>
                    <td className="px-5 py-4 text-neutral-500">{formatDate(demande.date)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
