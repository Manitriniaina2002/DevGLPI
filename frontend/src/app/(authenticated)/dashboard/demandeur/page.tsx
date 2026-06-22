'use client'

import Link from 'next/link'
import { Button } from '@/app/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'

// ─── Types ───────────────────────────────────────────────────────────────────

type StatutDemande =
  | 'en_attente'
  | 'attribue'
  | 'circuit_validation'
  | 'valide_commande'
  | 'cloture'

interface Demande {
  id: string
  titre: string
  statut: StatutDemande
  attribueA?: string
  date: string
  reference: string
}

// ─── Données fictives (à remplacer par un fetch API) ─────────────────────────

const demandes: Demande[] = [
  { id: '1', titre: 'Achat fournitures bureau', statut: 'en_attente',       date: '2025-06-01', reference: 'DA-2025-001' },
  { id: '2', titre: 'Matériel informatique',    statut: 'attribue',         attribueA: 'Jean Dupont',  date: '2025-06-02', reference: 'DA-2025-002' },
  { id: '3', titre: 'Mobilier salle de réunion',statut: 'circuit_validation',date: '2025-06-03', reference: 'DA-2025-003' },
  { id: '4', titre: 'Licences logiciels',        statut: 'valide_commande',  date: '2025-06-04', reference: 'DA-2025-004' },
  { id: '5', titre: 'Consommables imprimante',   statut: 'cloture',          date: '2025-05-20', reference: 'DA-2025-005' },
  { id: '6', titre: 'Équipement réseau',         statut: 'en_attente',       date: '2025-06-05', reference: 'DA-2025-006' },
  { id: '7', titre: 'Papeterie urgente',         statut: 'attribue',         attribueA: 'Marie Martin', date: '2025-06-05', reference: 'DA-2025-007' },
  { id: '8', titre: 'Outillage atelier',         statut: 'circuit_validation',date: '2025-06-06', reference: 'DA-2025-008' },
  { id: '9', titre: 'Produits hygiène',          statut: 'valide_commande',  date: '2025-06-06', reference: 'DA-2025-009' },
  { id: '10',titre: 'Équipements sécurité',      statut: 'cloture',          date: '2025-05-28', reference: 'DA-2025-010' },
]

// ─── Config statuts ───────────────────────────────────────────────────────────

const statutConfig: Record<StatutDemande, { label: string; color: string; bg: string; dot: string }> = {
  en_attente:        { label: 'Créé',                   color: 'text-ades-yellow',  bg: 'bg-yellow-50',   dot: 'bg-ades-yellow' },
  attribue:          { label: 'Assigné',                color: 'text-orange-500',   bg: 'bg-orange-50',   dot: 'bg-orange-500' },
  circuit_validation:{ label: 'Créé',                   color: 'text-blue-600',     bg: 'bg-blue-50',     dot: 'bg-blue-600' },
  valide_commande:   { label: 'En cours de traitement', color: 'text-info-600',     bg: 'bg-cyan-50',     dot: 'bg-info-600' },
  cloture:           { label: 'Clos',                   color: 'text-neutral-500',  bg: 'bg-neutral-50',  dot: 'bg-neutral-400' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countByStatut(statut: StatutDemande) {
  return demandes.filter(d => d.statut === statut).length
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Composant badge statut ───────────────────────────────────────────────────

function StatutBadge({ statut }: { statut: StatutDemande }) {
  const cfg = statutConfig[statut]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.color} ${cfg.bg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function DashboardDemandeurPage() {
  const enAttente         = countByStatut('en_attente')
  const attribue          = countByStatut('attribue')
  const circuitValidation = countByStatut('circuit_validation')
  const valideCommande    = countByStatut('valide_commande')
  const cloture           = countByStatut('cloture')
  const total             = demandes.length

  return (
    <div className="space-y-8">

      {/* ── En-tête ── */}
      <div className="rounded-xl border border-slate-200 bg-white/95 px-6 py-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-neutral-900">Espace Demandeur</h1>
            <p className="mt-2 max-w-2xl text-sm text-neutral-600">
              Suivez vos demandes en temps réel, visualisez les validations et accédez rapidement à vos tickets ouverts.
            </p>
          </div>
          <Button asChild size="lg">
            <Link href="/tickets/demandeur">
              Faire une demande
            </Link>
          </Button>
        </div>
      </div>

      {/* ── 5 compteurs — un par statut du CDC ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="card-ades">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-600">Créé</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-ades-yellow">{enAttente}</div>
            <p className="mt-2 text-xs text-neutral-500">En attente de traitement.</p>
          </CardContent>
        </Card>

        <Card className="card-ades">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-600">Assigné</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-orange-500">{attribue}</div>
            <p className="mt-2 text-xs text-neutral-500">Assignées à un responsable.</p>
          </CardContent>
        </Card>

        <Card className="card-ades">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-600">Créé</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-blue-600">{circuitValidation}</div>
            <p className="mt-2 text-xs text-neutral-500">En cours de validation sur Odoo.</p>
          </CardContent>
        </Card>

        <Card className="card-ades">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-600">En cours de traitement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-info-600">{valideCommande}</div>
            <p className="mt-2 text-xs text-neutral-500">Validées et transmises en commande.</p>
          </CardContent>
        </Card>

        <Card className="card-ades">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-600">Clos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-neutral-400">{cloture}</div>
            <p className="mt-2 text-xs text-neutral-500">Demandes clôturées.</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Grille : actions rapides + résumé statut ── */}
      <div className="grid gap-6 xl:grid-cols-2">

        {/* Actions rapides */}
        <Card className="card-ades">
          <CardHeader>
            <CardTitle>Actions rapides</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-neutral-700">
              <li>
                <Link
                  href="/tickets/demandeur"
                  className="flex items-center justify-between rounded-xl border border-[rgba(76,139,64,0.12)] bg-white/90 p-4 transition hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm"
                >
                  <span>Créer une nouvelle demande</span>
                  <span className="text-ades-green">→</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/demandes?statut=circuit_validation"
                  className="flex items-center justify-between rounded-xl border border-[rgba(76,139,64,0.12)] bg-white/90 p-4 transition hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm"
                >
                  <span>Consulter les demandes en validation Odoo</span>
                  <span className="text-ades-green">→</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/demandes?statut=attribue"
                  className="flex items-center justify-between rounded-xl border border-[rgba(76,139,64,0.12)] bg-white/90 p-4 transition hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm"
                >
                  <span>Voir mes demandes attribuées</span>
                  <span className="text-ades-green">→</span>
                </Link>
              </li>
              {/* <li>
                <Link
                  href="/demandes?statut=cloture"
                  className="flex items-center justify-between rounded-xl border border-[rgba(76,139,64,0.12)] bg-white/90 p-4 transition hover:border-ades-green/40 hover:bg-ades-green/5"
                >
                  <span>Voir l'historique de mes demandes</span>
                  <span className="text-ades-green">→</span>
                </Link>
              </li> */}
            </ul>
          </CardContent>
        </Card>

        {/* Résumé complet des 5 statuts */}
        <Card className="card-ades">
          <CardHeader>
            <CardTitle>Résumé du statut</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-neutral-700">

              {/* En attente */}
              <div className="flex items-center justify-between rounded-3xl border border-[rgba(76,139,64,0.12)] bg-white/90 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-ades-yellow" />
                  <span>Créé</span>
                </div>
                <span className="font-semibold text-ades-yellow">{enAttente}</span>
              </div>

              {/* Attribué */}
              <div className="flex items-center justify-between rounded-3xl border border-[rgba(76,139,64,0.12)] bg-white/90 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-orange-500" />
                  <span>Assigné</span>
                </div>
                <span className="font-semibold text-orange-500">{attribue}</span>
              </div>

              {/* Circuit validation Odoo */}
              <div className="flex items-center justify-between rounded-3xl border border-[rgba(76,139,64,0.12)] bg-white/90 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-600" />
                  <span>Créé</span>
                </div>
                <span className="font-semibold text-blue-600">{circuitValidation}</span>
              </div>

              {/* Validé et Commandé */}
              <div className="flex items-center justify-between rounded-3xl border border-[rgba(76,139,64,0.12)] bg-white/90 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-info-600" />
                  <span>En cours de traitement</span>
                </div>
                <span className="font-semibold text-info-600">{valideCommande}</span>
              </div>

              {/* Clôturé */}
              <div className="flex items-center justify-between rounded-3xl border border-[rgba(76,139,64,0.12)] bg-white/90 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-neutral-400" />
                  <span>Clos</span>
                </div>
                <span className="font-semibold text-neutral-500">{cloture}</span>
              </div>

            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Tableau des demandes récentes ── */}
      <Card className="card-ades">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Mes demandes récentes</CardTitle>
          <Link
            href="/demandes?statut=recent"
            className="text-sm font-medium text-ades-green hover:underline"
          >
            Voir tout →
          </Link>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgba(76,139,64,0.12)] text-left text-xs font-medium text-neutral-500">
                  <th className="pb-3 pr-4">Référence</th>
                  <th className="pb-3 pr-4">Intitulé</th>
                  <th className="pb-3 pr-4">Statut</th>
                  <th className="pb-3 pr-4">Attribué à</th>
                  <th className="pb-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(76,139,64,0.08)]">
                {demandes.map((demande) => (
                  <tr key={demande.id} className="group transition hover:bg-ades-green/5">
                    <td className="py-3 pr-4 font-mono text-xs text-neutral-500">
                      {demande.reference}
                    </td>
                    <td className="py-3 pr-4 font-medium text-neutral-800">
                      {demande.titre}
                    </td>
                    <td className="py-3 pr-4">
                      <StatutBadge statut={demande.statut} />
                    </td>
                    <td className="py-3 pr-4 text-neutral-600">
                      {demande.attribueA ?? <span className="text-neutral-300">—</span>}
                    </td>
                    <td className="py-3 text-neutral-500">
                      {formatDate(demande.date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Barre de progression globale */}
          <div className="mt-6 rounded-3xl border border-[rgba(76,139,64,0.12)] bg-white/90 p-4">
            <p className="mb-3 text-xs font-medium text-neutral-500">Répartition globale ({total} demandes)</p>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-neutral-100">
              <div className="bg-ades-yellow"       style={{ width: `${(enAttente / total) * 100}%` }} title="Créé" />
              <div className="bg-orange-500"         style={{ width: `${(attribue / total) * 100}%` }} title="Assigné" />
              <div className="bg-blue-600"           style={{ width: `${(circuitValidation / total) * 100}%` }} title="Créé" />
              <div className="bg-info-600"           style={{ width: `${(valideCommande / total) * 100}%` }} title="En cours de traitement" />
              <div className="bg-neutral-300"        style={{ width: `${(cloture / total) * 100}%` }} title="Clos" />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-ades-yellow"/>Créé</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-500"/>Assigné</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-600"/>Créé</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-info-600"/>En cours de traitement</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-neutral-300"/>Clos</span>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
