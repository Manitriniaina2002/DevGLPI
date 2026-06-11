'use client'

import { Suspense, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

// ─── Types ─────────────────────────────────────────────────────────────────────

type TicketStatus   = 'cree' | 'en_cours' | 'cloture' | 'rejete'
type TicketPriority = 'haute' | 'normale' | 'basse'

interface RappelLog {
  date: string
  sentBy: string
}

interface Ticket {
  id: string
  reference: string
  titre: string
  description: string
  projet: string
  statut: TicketStatus
  priorite: TicketPriority
  acheteurAssigne: string | null
  dateCreation: string
  dateEcheance: string
  datePriseEnCharge: string | null
  rappelsEnvoyes: RappelLog[]
  montant?: number
  fournisseur?: string
}

interface Acheteur {
  id: string
  nom: string
  initiales: string
  charge: number
  enCours: number
}

// ─── Données fictives ──────────────────────────────────────────────────────────

const ACHETEURS: Acheteur[] = [
  { id: 'am', nom: 'A. Martin', initiales: 'AM', charge: 72, enCours: 5 },
  { id: 'bd', nom: 'B. Dupont', initiales: 'BD', charge: 55, enCours: 4 },
  { id: 'cl', nom: 'C. Leroy',  initiales: 'CL', charge: 88, enCours: 6 },
  { id: 'ds', nom: 'D. Sow',    initiales: 'DS', charge: 40, enCours: 3 },
]

const TODAY = '2025-06-09'

const INITIAL_TICKETS: Ticket[] = [
  { id: 'TK-001', reference: 'ACH-2025-001', titre: 'Achat équipements réseau',      description: 'Acquisition de switches et routeurs pour la salle serveur du projet Alpha.',      projet: 'Projet Alpha', statut: 'en_cours', priorite: 'haute',   acheteurAssigne: 'A. Martin', dateCreation: '2025-06-01', dateEcheance: '2025-06-08', datePriseEnCharge: '2025-06-02', rappelsEnvoyes: [{ date: '2025-06-07', sentBy: 'Responsable Achat' }], montant: 4500000 },
  { id: 'TK-002', reference: 'ACH-2025-002', titre: 'Fournitures bureau Q3',          description: 'Commande trimestrielle de fournitures de bureau pour toutes les équipes.',         projet: 'Projet Beta',  statut: 'cree',     priorite: 'normale', acheteurAssigne: null,        dateCreation: '2025-06-05', dateEcheance: '2025-06-20', datePriseEnCharge: null,        rappelsEnvoyes: [] },
  { id: 'TK-003', reference: 'ACH-2025-003', titre: 'Licence logiciel ERP',           description: 'Renouvellement des licences ERP pour 15 utilisateurs — module comptabilité.',     projet: 'Projet Gamma', statut: 'en_cours', priorite: 'haute',   acheteurAssigne: 'C. Leroy',  dateCreation: '2025-05-30', dateEcheance: '2025-06-06', datePriseEnCharge: '2025-05-31', rappelsEnvoyes: [{ date: '2025-06-05', sentBy: 'Responsable Achat' }], montant: 2800000 },
  { id: 'TK-004', reference: 'ACH-2025-004', titre: 'Matériel informatique — laptops', description: 'Acquisition de 5 laptops pour les nouveaux collaborateurs du projet Beta.',       projet: 'Projet Beta',  statut: 'cloture',  priorite: 'normale', acheteurAssigne: 'D. Sow',    dateCreation: '2025-05-20', dateEcheance: '2025-05-30', datePriseEnCharge: '2025-05-21', rappelsEnvoyes: [], montant: 6250000, fournisseur: 'Tech Mada' },
  { id: 'TK-005', reference: 'ACH-2025-005', titre: 'Mobilier open space',            description: 'Tables et chaises ergonomiques pour le nouvel open space.',                        projet: 'Projet Delta', statut: 'cree',     priorite: 'basse',   acheteurAssigne: null,        dateCreation: '2025-06-07', dateEcheance: '2025-06-25', datePriseEnCharge: null,        rappelsEnvoyes: [] },
  { id: 'TK-006', reference: 'ACH-2025-006', titre: 'Prestation consultant SI',       description: "Contrat de prestation pour audit du système d'information.",                      projet: 'Projet Beta',  statut: 'en_cours', priorite: 'haute',   acheteurAssigne: 'C. Leroy',  dateCreation: '2025-05-28', dateEcheance: '2025-06-04', datePriseEnCharge: '2025-05-29', rappelsEnvoyes: [{ date: '2025-06-03', sentBy: 'Responsable Achat' }, { date: '2025-06-07', sentBy: 'Responsable Achat' }], montant: 8000000 },
  { id: 'TK-007', reference: 'ACH-2025-007', titre: 'Câblage salle serveur',          description: 'Travaux de câblage réseau dans la nouvelle salle serveur.',                       projet: 'Projet Alpha', statut: 'rejete',   priorite: 'normale', acheteurAssigne: 'B. Dupont', dateCreation: '2025-05-25', dateEcheance: '2025-06-05', datePriseEnCharge: '2025-05-26', rappelsEnvoyes: [] },
  { id: 'TK-008', reference: 'ACH-2025-008', titre: 'Abonnement cloud AWS',           description: "Renouvellement annuel de l'abonnement AWS pour les environnements de dev et prod.", projet: 'Projet Gamma', statut: 'cloture',  priorite: 'haute',   acheteurAssigne: 'D. Sow',    dateCreation: '2025-05-15', dateEcheance: '2025-05-28', datePriseEnCharge: '2025-05-16', rappelsEnvoyes: [], montant: 3600000, fournisseur: 'AWS Africa' },
  { id: 'TK-009', reference: 'ACH-2025-009', titre: 'Véhicule de service utilitaire', description: "Location longue durée d'un véhicule utilitaire pour les déplacements terrain.",   projet: 'Projet Delta', statut: 'cree',     priorite: 'normale', acheteurAssigne: null,        dateCreation: '2025-06-08', dateEcheance: '2025-06-22', datePriseEnCharge: null,        rappelsEnvoyes: [] },
  { id: 'TK-010', reference: 'ACH-2025-010', titre: 'Formation cybersécurité',        description: 'Session de formation cybersécurité pour 12 collaborateurs techniques.',            projet: 'Projet Alpha', statut: 'en_cours', priorite: 'haute',   acheteurAssigne: 'A. Martin', dateCreation: '2025-06-02', dateEcheance: '2025-06-07', datePriseEnCharge: '2025-06-02', rappelsEnvoyes: [{ date: '2025-06-06', sentBy: 'Responsable Achat' }], montant: 1500000 },
  { id: 'TK-011', reference: 'ACH-2025-011', titre: 'EPI équipe terrain',             description: "Casques, gilets, chaussures de sécurité pour l'équipe Gamma.",                   projet: 'Projet Gamma', statut: 'en_cours', priorite: 'haute',   acheteurAssigne: 'B. Dupont', dateCreation: '2025-06-03', dateEcheance: '2025-06-12', datePriseEnCharge: '2025-06-04', rappelsEnvoyes: [], montant: 750000 },
  { id: 'TK-012', reference: 'ACH-2025-012', titre: 'Imprimantes multifonctions',     description: 'Remplacement de 3 imprimantes multifonctions en fin de vie.',                     projet: 'Projet Delta', statut: 'cree',     priorite: 'basse',   acheteurAssigne: null,        dateCreation: '2025-06-09', dateEcheance: '2025-06-30', datePriseEnCharge: null,        rappelsEnvoyes: [] },
]

const PROJETS   = ['Tous', 'Projet Alpha', 'Projet Beta', 'Projet Gamma', 'Projet Delta']
const PRIORITES = ['Toutes', 'haute', 'normale', 'basse']

// ─── Helpers ───────────────────────────────────────────────────────────────────

function daysBetween(a: string, b: string) {
  return Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}
function daysUntil(d: string) { return daysBetween(TODAY, d) }

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}
function formatAmount(n: number) {
  return new Intl.NumberFormat('fr-MG', { style: 'currency', currency: 'MGA', maximumFractionDigits: 0 }).format(n)
}

function joursEnCours(ticket: Ticket): number {
  if (ticket.statut !== 'en_cours' || !ticket.datePriseEnCharge) return 0
  return daysBetween(ticket.datePriseEnCharge, TODAY)
}

function needsRappel(ticket: Ticket): boolean {
  if (ticket.statut !== 'en_cours') return false
  if (joursEnCours(ticket) <= 5) return false
  if (ticket.rappelsEnvoyes.length === 0) return true
  const last = ticket.rappelsEnvoyes[ticket.rappelsEnvoyes.length - 1]
  return daysBetween(last.date, TODAY) >= 2
}

const STATUT_CONFIG: Record<TicketStatus, { label: string; bg: string; text: string; border: string }> = {
  cree:     { label: 'Créé',     bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200' },
  en_cours: { label: 'En cours', bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200' },
  cloture:  { label: 'Clôturé',  bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200' },
  rejete:   { label: 'Rejeté',   bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200' },
}

const PRIORITE_CONFIG: Record<TicketPriority, { label: string; bg: string; text: string }> = {
  haute:   { label: 'Haute',   bg: 'bg-red-50',      text: 'text-red-700' },
  normale: { label: 'Normale', bg: 'bg-neutral-100', text: 'text-neutral-600' },
  basse:   { label: 'Basse',   bg: 'bg-neutral-50',  text: 'text-neutral-500' },
}

// ─── Micro-composants ──────────────────────────────────────────────────────────

function StatutBadge({ statut }: { statut: TicketStatus }) {
  const c = STATUT_CONFIG[statut]
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${c.bg} ${c.text} ${c.border}`}>{c.label}</span>
}

function PrioriteBadge({ priorite }: { priorite: TicketPriority }) {
  const c = PRIORITE_CONFIG[priorite]
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}>{priorite === 'haute' && <span className="mr-1">▲</span>}{c.label}</span>
}

function Avatar({ initiales, color = '#185FA5' }: { initiales: string; color?: string }) {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold" style={{ backgroundColor: color + '22', color }}>
      {initiales}
    </div>
  )
}

function ChargeBar({ value }: { value: number }) {
  const color = value >= 80 ? '#A32D2D' : value >= 60 ? '#BA7517' : '#3B6D11'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-neutral-100">
        <div className="h-1.5 rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs" style={{ color }}>{value}%</span>
    </div>
  )
}

function KpiCard({ label, value, sub, valueClass = 'text-neutral-900' }: {
  label: string; value: string | number; sub?: string; valueClass?: string
}) {
  return (
    <div className="rounded-2xl border border-neutral-100 bg-white px-4 py-4 shadow-sm">
      <p className="mb-1 text-xs text-neutral-500">{label}</p>
      <p className={`text-3xl font-semibold ${valueClass}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-neutral-400">{sub}</p>}
    </div>
  )
}

function Toast({ message, type, onDismiss }: { message: string; type: 'success'|'warning'|'info'; onDismiss: () => void }) {
  const s = { success:'border-green-200 bg-green-50 text-green-800', warning:'border-amber-200 bg-amber-50 text-amber-800', info:'border-blue-200 bg-blue-50 text-blue-800' }
  const i = { success:'✓', warning:'⚠', info:'ℹ' }
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg ${s[type]}`}>
      <span className="text-base font-bold">{i[type]}</span>
      <p className="text-xs font-medium">{message}</p>
      <button onClick={onDismiss} className="ml-2 text-xs opacity-60 hover:opacity-100">✕</button>
    </div>
  )
}

// ─── Modal Gestion Ticket ──────────────────────────────────────────────────────

function TicketGestionModal({ ticket, onClose, onUpdate }: {
  ticket: Ticket; onClose: () => void; onUpdate: (t: Ticket) => void
}) {
  const [acheteurChoisi, setAcheteurChoisi] = useState(ticket.acheteurAssigne ?? '')
  const [priorite, setPriorite]             = useState<TicketPriority>(ticket.priorite)
  const [statut, setStatut]                 = useState<TicketStatus>(ticket.statut)
  const [saving, setSaving]                 = useState(false)
  const [rappelEnvoye, setRappelEnvoye]     = useState(false)
  const [confirmCloture, setConfirmCloture] = useState(false)

  const isReassign   = ticket.acheteurAssigne !== null && acheteurChoisi !== ticket.acheteurAssigne
  const joursEC      = joursEnCours(ticket)
  const deadlineDays = daysUntil(ticket.dateEcheance)
  const deadlineColor = deadlineDays < 0 ? 'text-red-600' : deadlineDays <= 3 ? 'text-orange-600' : deadlineDays <= 7 ? 'text-amber-600' : 'text-neutral-700'

  function handleSave() {
    setSaving(true)
    setTimeout(() => {
      onUpdate({ ...ticket, acheteurAssigne: acheteurChoisi || null, priorite, statut, datePriseEnCharge: !ticket.datePriseEnCharge && acheteurChoisi ? TODAY : ticket.datePriseEnCharge })
      setSaving(false); onClose()
    }, 400)
  }

  function handleEnvoyerRappel() {
    onUpdate({ ...ticket, rappelsEnvoyes: [...ticket.rappelsEnvoyes, { date: TODAY, sentBy: 'Responsable Achat' }] })
    setRappelEnvoye(true)
  }

  function handleCloturer() { onUpdate({ ...ticket, statut: 'cloture' }); onClose() }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-14">
      <div className="w-full max-w-lg rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-neutral-400">{ticket.reference}</span>
              <StatutBadge statut={ticket.statut} />
              <PrioriteBadge priorite={ticket.priorite} />
            </div>
            <h2 className="mt-1 text-base font-semibold text-neutral-900">{ticket.titre}</h2>
            <p className="text-sm text-neutral-500">{ticket.projet}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100 transition">✕</button>
        </div>

        <div className="space-y-5 p-6">
          {/* Alerte rappel */}
          {needsRappel(ticket) && !rappelEnvoye && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm font-semibold text-amber-800">⏱ En cours depuis {joursEC} jours sans clôture</p>
              <p className="mt-0.5 text-xs text-amber-700">Ce ticket dépasse le seuil de 5 jours. Un rappel peut être envoyé à l'acheteur concerné.</p>
              <button onClick={handleEnvoyerRappel} className="mt-2 rounded-full bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700">
                Envoyer un rappel à {ticket.acheteurAssigne}
              </button>
            </div>
          )}
          {rappelEnvoye && (
            <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              ✓ Rappel envoyé à {ticket.acheteurAssigne} le {formatDate(TODAY)}
            </div>
          )}

          {/* Infos grille */}
          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-100 bg-neutral-50 p-4 text-sm">
            <div><p className="text-xs text-neutral-400">Créé le</p><p className="font-medium text-neutral-700">{formatDate(ticket.dateCreation)}</p></div>
            <div>
              <p className="text-xs text-neutral-400">Échéance</p>
              <p className={`font-semibold ${deadlineColor}`}>{formatDate(ticket.dateEcheance)}{deadlineDays < 0 && <span className="ml-1 text-xs">(dépassée)</span>}</p>
            </div>
            <div><p className="text-xs text-neutral-400">Prise en charge</p><p className="font-medium text-neutral-700">{ticket.datePriseEnCharge ? formatDate(ticket.datePriseEnCharge) : '—'}</p></div>
            <div><p className="text-xs text-neutral-400">Durée en cours</p><p className={`font-semibold ${joursEC > 5 ? 'text-amber-600' : 'text-neutral-700'}`}>{ticket.datePriseEnCharge ? `${joursEC}j` : '—'}</p></div>
            {ticket.montant    && <div><p className="text-xs text-neutral-400">Montant estimé</p><p className="font-semibold text-ades-green">{formatAmount(ticket.montant)}</p></div>}
            {ticket.fournisseur && <div><p className="text-xs text-neutral-400">Fournisseur</p><p className="font-medium text-neutral-700">{ticket.fournisseur}</p></div>}
          </div>

          {/* Description */}
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-400">Description</p>
            <p className="rounded-2xl border border-slate-100 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">{ticket.description}</p>
          </div>

          {/* Historique rappels */}
          {ticket.rappelsEnvoyes.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">Rappels envoyés ({ticket.rappelsEnvoyes.length})</p>
              <ul className="space-y-1.5">
                {ticket.rappelsEnvoyes.map((r, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-neutral-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                    Rappel envoyé le {formatDate(r.date)} par {r.sentBy}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Assignation / Réassignation */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
              {ticket.acheteurAssigne ? 'Réassigner à un acheteur' : 'Assigner à un acheteur'}
            </p>
            {ticket.acheteurAssigne && (
              <div className="mb-3 flex items-center gap-2 rounded-xl border border-slate-100 bg-neutral-50 px-3 py-2.5">
                <span className="text-xs text-neutral-500">Actuellement assigné à</span>
                <span className="font-semibold text-neutral-800">{ticket.acheteurAssigne}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {ACHETEURS.map((a) => {
                const selected = acheteurChoisi === a.nom
                const isOverloaded = a.charge >= 80
                return (
                  <button key={a.id} onClick={() => setAcheteurChoisi(a.nom)}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${selected ? 'border-ades-green bg-ades-green/5 ring-2 ring-ades-green/20' : 'border-slate-200 bg-white hover:border-neutral-300 hover:bg-neutral-50'}`}
                  >
                    <Avatar initiales={a.initiales} color={isOverloaded ? '#A32D2D' : selected ? '#3B6D11' : '#185FA5'} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-neutral-800 truncate">{a.nom}</p>
                      <ChargeBar value={a.charge} />
                    </div>
                    {selected && <span className="text-ades-green text-sm">✓</span>}
                  </button>
                )
              })}
            </div>
            {isReassign && (
              <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2 border border-amber-100">
                ↻ Réassignation : {ticket.acheteurAssigne} → {acheteurChoisi}
              </p>
            )}
          </div>

          {/* Priorité */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">Priorité</p>
            <div className="flex gap-2">
              {(['haute', 'normale', 'basse'] as TicketPriority[]).map((p) => (
                <button key={p} onClick={() => setPriorite(p)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${priorite === p ? `${PRIORITE_CONFIG[p].bg} ${PRIORITE_CONFIG[p].text} ring-2 ring-offset-1 ring-ades-green/30` : 'border-slate-200 text-neutral-500 hover:bg-neutral-50'}`}
                >
                  {PRIORITE_CONFIG[p].label}
                </button>
              ))}
            </div>
          </div>

          {/* Statut */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">Statut</p>
            <div className="flex flex-wrap gap-2">
              {(['cree', 'en_cours', 'cloture', 'rejete'] as TicketStatus[]).map((s) => (
                <button key={s} onClick={() => setStatut(s)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${statut === s ? `${STATUT_CONFIG[s].bg} ${STATUT_CONFIG[s].text} ${STATUT_CONFIG[s].border} ring-2 ring-offset-1 ring-ades-green/30` : 'border-slate-200 text-neutral-500 hover:bg-neutral-50'}`}
                >
                  {STATUT_CONFIG[s].label}
                </button>
              ))}
            </div>
          </div>

          {/* Clôture directe */}
          {ticket.statut !== 'cloture' && ticket.statut !== 'rejete' && (
            <div className={`rounded-2xl border px-4 py-3 ${confirmCloture ? 'border-green-200 bg-green-50' : 'border-slate-100 bg-neutral-50'}`}>
              {!confirmCloture ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-700">Clôturer ce ticket</p>
                    <p className="text-xs text-neutral-400 mt-0.5">Marquer la demande comme traitée et clôturée.</p>
                  </div>
                  <button onClick={() => setConfirmCloture(true)} className="rounded-full border border-green-600 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-50 transition">Clôturer</button>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-green-800">Confirmer la clôture ?</p>
                  <p className="mt-0.5 text-xs text-green-700">Cette action marquera le ticket comme clôturé définitivement.</p>
                  <div className="mt-3 flex gap-2">
                    <button onClick={handleCloturer} className="rounded-full bg-green-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition">Confirmer</button>
                    <button onClick={() => setConfirmCloture(false)} className="rounded-full border border-slate-200 px-4 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50 transition">Annuler</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button onClick={handleSave} disabled={saving} className="flex-1 rounded-full bg-ades-green px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ades-green/90 disabled:opacity-60">
              {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
            </button>
            <button onClick={onClose} className="rounded-full border border-slate-200 px-4 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50 transition">Annuler</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page principale ───────────────────────────────────────────────────────────

export default function GestionTicketsResponsablePage() {
  return (
    <Suspense fallback={null}>
      <GestionTicketsResponsableContent />
    </Suspense>
  )
}

function GestionTicketsResponsableContent() {
  const searchParams = useSearchParams()
  const filtreInitial = searchParams?.get('filtre') ?? 'tous'

  const [tickets, setTickets]           = useState<Ticket[]>(INITIAL_TICKETS)
  const [selectedTicket, setSelected]   = useState<Ticket | null>(null)
  const [toasts, setToasts]             = useState<{ id: string; message: string; type: 'success'|'warning'|'info' }[]>([])

  // Filtres — initialisation depuis query params
  const [filtreStatut,   setFiltreStatut]   = useState<TicketStatus | 'tous'>('tous')
  const [filtreProjet,   setFiltreProjet]   = useState('Tous')
  const [filtrePriorite, setFiltrePriorite] = useState('Toutes')
  const [filtreAcheteur, setFiltreAcheteur] = useState(filtreInitial === 'non_assigne' ? 'Non assigné' : 'Tous')
  const [filtreDate,     setFiltreDate]     = useState<'tous'|'urgent_delai'|'cette_semaine'|'en_retard'>(filtreInitial === 'retard' ? 'en_retard' : 'tous')
  const [filtreRappel,   setFiltreRappel]   = useState(filtreInitial === 'rappel')
  const [search,         setSearch]         = useState('')
  const [triCol,         setTriCol]         = useState<'dateCreation'|'dateEcheance'|'priorite'|'joursEnCours'>('dateCreation')
  const [triAsc,         setTriAsc]         = useState(false)

  const showToast = useCallback((message: string, type: 'success'|'warning'|'info' = 'success') => {
    const id = Date.now().toString()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  function handleUpdate(updated: Ticket) {
    setTickets(prev => prev.map(t => t.id === updated.id ? updated : t))
    setSelected(updated)
    showToast(`Ticket ${updated.reference} mis à jour`, 'success')
  }

  // KPIs
  const nonAssignes = useMemo(() => tickets.filter(t => !t.acheteurAssigne && t.statut !== 'cloture' && t.statut !== 'rejete'), [tickets])
  const enRetard    = useMemo(() => tickets.filter(t => daysUntil(t.dateEcheance) < 0 && t.statut !== 'cloture' && t.statut !== 'rejete'), [tickets])
  const needRappel  = useMemo(() => tickets.filter(needsRappel), [tickets])
  const enCours     = useMemo(() => tickets.filter(t => t.statut === 'en_cours'), [tickets])

  const acheteursDisponibles = ['Tous', 'Non assigné', ...ACHETEURS.map(a => a.nom)]

  const PRIORITE_ORDER: Record<TicketPriority, number> = { haute: 3, normale: 2, basse: 1 }

  // Tickets filtrés + triés
  const ticketsFiltres = useMemo(() => {
    let list = [...tickets]
    if (filtreStatut !== 'tous')       list = list.filter(t => t.statut === filtreStatut)
    if (filtreProjet !== 'Tous')       list = list.filter(t => t.projet === filtreProjet)
    if (filtrePriorite !== 'Toutes')   list = list.filter(t => t.priorite === filtrePriorite)
    if (filtreAcheteur === 'Non assigné') list = list.filter(t => t.acheteurAssigne === null)
    else if (filtreAcheteur !== 'Tous')   list = list.filter(t => t.acheteurAssigne === filtreAcheteur)
    if (filtreDate === 'en_retard')    list = list.filter(t => daysUntil(t.dateEcheance) < 0 && t.statut !== 'cloture' && t.statut !== 'rejete')
    if (filtreDate === 'urgent_delai') list = list.filter(t => daysUntil(t.dateEcheance) >= 0 && daysUntil(t.dateEcheance) <= 3)
    if (filtreDate === 'cette_semaine') list = list.filter(t => daysUntil(t.dateEcheance) >= 0 && daysUntil(t.dateEcheance) <= 7)
    if (filtreRappel)                  list = list.filter(needsRappel)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(t => t.titre.toLowerCase().includes(q) || t.reference.toLowerCase().includes(q) || (t.acheteurAssigne||'').toLowerCase().includes(q))
    }
    // Tri
    list.sort((a, b) => {
      let va: number | string, vb: number | string
      if (triCol === 'priorite')     { va = PRIORITE_ORDER[a.priorite]; vb = PRIORITE_ORDER[b.priorite] }
      else if (triCol === 'joursEnCours') { va = joursEnCours(a); vb = joursEnCours(b) }
      else { va = a[triCol]; vb = b[triCol] }
      return triAsc ? (va < vb ? -1 : 1) : (va > vb ? -1 : 1)
    })
    return list
  }, [tickets, filtreStatut, filtreProjet, filtrePriorite, filtreAcheteur, filtreDate, filtreRappel, search, triCol, triAsc])

  function toggleTri(col: typeof triCol) {
    if (triCol === col) setTriAsc(!triAsc)
    else { setTriCol(col); setTriAsc(false) }
  }

  function resetFiltres() {
    setFiltreStatut('tous'); setFiltreProjet('Tous'); setFiltrePriorite('Toutes')
    setFiltreAcheteur('Tous'); setFiltreDate('tous'); setFiltreRappel(false); setSearch('')
  }

  const hasFiltres = filtreStatut !== 'tous' || filtreProjet !== 'Tous' || filtrePriorite !== 'Toutes'
    || filtreAcheteur !== 'Tous' || filtreDate !== 'tous' || filtreRappel || search.trim() !== ''

  const SortIcon = ({ col }: { col: typeof triCol }) => (
    <span className={`ml-1 text-[10px] ${triCol === col ? 'text-ades-green' : 'text-neutral-300'}`}>
      {triCol === col ? (triAsc ? '↑' : '↓') : '↕'}
    </span>
  )

  const statutsFiltres: { key: TicketStatus | 'tous'; label: string }[] = [
    { key: 'tous',     label: 'Tous' },
    { key: 'cree',     label: 'Créés' },
    { key: 'en_cours', label: 'En cours' },
    { key: 'cloture',  label: 'Clôturés' },
    { key: 'rejete',   label: 'Rejetés' },
  ]

  return (
    <>
      {/* Toasts */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2">
        {toasts.map(t => <Toast key={t.id} message={t.message} type={t.type} onDismiss={() => setToasts(p => p.filter(x => x.id !== t.id))} />)}
      </div>

      {/* Modal */}
      {selectedTicket && (
        <TicketGestionModal
          ticket={selectedTicket}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
        />
      )}

      <div className="space-y-6">

        {/* ── En-tête ── */}
        <div className="rounded-xl border border-slate-200 bg-white/95 px-6 py-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-neutral-900">Gestion des tickets</h1>
              <p className="mt-2 max-w-2xl text-sm text-neutral-600">
                Pilotage centralisé · Assignation · Réassignation · Rappels automatiques · Clôture
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/dashboard/responsable" className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50">
                ← Tableau de bord
              </Link>
              {/* <Link href="/dashboard" className="rounded-xl border border-ades-green bg-white px-4 py-2 text-sm font-semibold text-ades-green transition hover:bg-ades-green/10">
                Retour au dashboard
              </Link> */}
            </div>
          </div>
        </div>


        {/* ── Charge des acheteurs ── */}
        {/* <div className="rounded-2xl border border-neutral-100 bg-white p-5">
          <h3 className="mb-4 text-sm font-medium text-neutral-700">Charge des acheteurs</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            {ACHETEURS.map(a => {
              const ticketsA  = tickets.filter(t => t.acheteurAssigne === a.nom && t.statut !== 'cloture' && t.statut !== 'rejete')
              const retardsA  = ticketsA.filter(t => daysUntil(t.dateEcheance) < 0)
              const rappelsA  = ticketsA.filter(needsRappel)
              const isOverload = a.charge >= 80
              return (
                <div key={a.id} className={`rounded-2xl border p-4 ${isOverload ? 'border-red-100 bg-red-50/20' : 'border-neutral-100 bg-white'}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar initiales={a.initiales} color={isOverload ? '#A32D2D' : '#185FA5'} />
                    <div>
                      <p className="text-sm font-semibold text-neutral-800">{a.nom}</p>
                      <p className="text-xs text-neutral-400">{ticketsA.length} ticket{ticketsA.length > 1 ? 's' : ''} actif{ticketsA.length > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <ChargeBar value={a.charge} />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {retardsA.length > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">{retardsA.length} retard{retardsA.length > 1 ? 's' : ''}</span>}
                    {rappelsA.length > 0 && <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-700">{rappelsA.length} rappel{rappelsA.length > 1 ? 's' : ''} requis</span>}
                    {retardsA.length === 0 && rappelsA.length === 0 && <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">✓ À jour</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div> */}

         
         {/* ── KPIs ── */}
        {/*         
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
          <KpiCard label="Total tickets"      value={tickets.length}    sub="Tous statuts confondus" />
          <KpiCard label="Non assignés"       value={nonAssignes.length} sub="En attente d'affectation" valueClass={nonAssignes.length > 0 ? 'text-amber-600' : 'text-neutral-400'} />
          <KpiCard label="En cours"           value={enCours.length}    sub="En traitement actif"     valueClass="text-blue-700" />
          <KpiCard label="En retard"          value={enRetard.length}   sub={enRetard.length > 0 ? 'Délais dépassés' : 'Aucun retard'} valueClass={enRetard.length > 0 ? 'text-red-600' : 'text-neutral-400'} />
          <KpiCard label="Rappels à envoyer"  value={needRappel.length} sub="+5j sans clôture"       valueClass={needRappel.length > 0 ? 'text-orange-600' : 'text-neutral-400'} />
        </div>  */}

        {/* ── Alertes ── */}
        <div className="space-y-3">
          {nonAssignes.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-amber-800">📋 {nonAssignes.length} ticket{nonAssignes.length > 1 ? 's' : ''} non assigné{nonAssignes.length > 1 ? 's' : ''} — en attente d'affectation</p>
                <button onClick={() => setFiltreAcheteur('Non assigné')} className="text-xs font-medium text-amber-700 underline underline-offset-2">Filtrer →</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {nonAssignes.slice(0, 4).map(t => (
                  <button key={t.id} onClick={() => setSelected(t)} className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs text-amber-800 hover:bg-amber-100 transition">
                    {t.reference} — {t.titre.slice(0, 22)}{t.titre.length > 22 ? '…' : ''}
                  </button>
                ))}
                {nonAssignes.length > 4 && <span className="self-center text-xs text-amber-600">+{nonAssignes.length - 4} autres</span>}
              </div>
            </div>
          )}

          {needRappel.length > 0 && (
            <div className="rounded-2xl border border-orange-200 bg-orange-50 px-5 py-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-orange-800">⏱ {needRappel.length} ticket{needRappel.length > 1 ? 's' : ''} en cours depuis plus de 5 jours — rappel recommandé</p>
                <button
                  onClick={() => needRappel.forEach(t => { const log = { date: TODAY, sentBy: 'Responsable Achat' }; setTickets(prev => prev.map(tk => tk.id === t.id ? { ...tk, rappelsEnvoyes: [...tk.rappelsEnvoyes, log] } : tk)); showToast(`Rappel envoyé à ${t.acheteurAssigne} pour ${t.reference}`, 'warning') })}
                  className="rounded-full bg-orange-600 px-3 py-1 text-xs font-semibold text-white hover:bg-orange-700 transition"
                >
                  Tous envoyer
                </button>
              </div>
              <div className="space-y-2">
                {needRappel.map(t => (
                  <div key={t.id} className="flex items-center justify-between rounded-xl border border-orange-100 bg-white px-3 py-2">
                    <div>
                      <span className="font-mono text-xs text-neutral-400 mr-2">{t.reference}</span>
                      <span className="text-sm font-medium text-neutral-800">{t.titre}</span>
                      <span className="ml-2 text-xs text-orange-600">· {joursEnCours(t)}j en cours · {t.acheteurAssigne}</span>
                    </div>
                    <button onClick={() => setSelected(t)} className="shrink-0 rounded-full border border-orange-400 px-3 py-1 text-xs font-medium text-orange-700 hover:bg-orange-50 transition">
                      Envoyer rappel →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {enRetard.length > 0 && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
              <p className="text-sm font-semibold text-red-800">
                ⚠ {enRetard.length} ticket{enRetard.length > 1 ? 's' : ''} avec délai dépassé
                <button onClick={() => setFiltreDate('en_retard')} className="ml-3 text-xs font-medium text-red-700 underline underline-offset-2">Filtrer →</button>
              </p>
            </div>
          )}
        </div>

        {/* ── Panneau filtres ── */}
        <div className="rounded-2xl border border-neutral-100 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium text-neutral-700">Filtres & Recherche</h3>
            {hasFiltres && (
              <button onClick={resetFiltres} className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-600 hover:bg-red-100 transition">✕ Réinitialiser</button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Recherche */}
            <div className="relative lg:col-span-2">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M9.5 9.5L12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              <input type="text" placeholder="Titre, référence, acheteur…" value={search} onChange={e => setSearch(e.target.value)}
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2 pl-8 pr-3 text-xs text-neutral-700 placeholder-neutral-400 outline-none focus:border-ades-green focus:bg-white"
              />
            </div>
            <select value={filtreAcheteur} onChange={e => setFiltreAcheteur(e.target.value)} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700 outline-none focus:border-ades-green">
              {acheteursDisponibles.map(a => <option key={a}>{a}</option>)}
            </select>
            <select value={filtreProjet} onChange={e => setFiltreProjet(e.target.value)} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700 outline-none focus:border-ades-green">
              {PROJETS.map(p => <option key={p}>{p}</option>)}
            </select>
            <select value={filtrePriorite} onChange={e => setFiltrePriorite(e.target.value)} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700 outline-none focus:border-ades-green">
              {PRIORITES.map(p => <option key={p} value={p}>{p === 'Toutes' ? 'Toutes les priorités' : `Priorité ${p}`}</option>)}
            </select>
            <select value={filtreDate} onChange={e => setFiltreDate(e.target.value as typeof filtreDate)} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700 outline-none focus:border-ades-green">
              <option value="tous">Toutes les dates</option>
              <option value="en_retard">Délai dépassé</option>
              <option value="urgent_delai">Échéance dans 3j</option>
              <option value="cette_semaine">Cette semaine</option>
            </select>
            <div className="flex items-center gap-4 lg:col-span-2">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-600">
                <input type="checkbox" checked={filtreRappel} onChange={e => setFiltreRappel(e.target.checked)} className="accent-ades-green rounded" />
                Rappel requis uniquement
              </label>
            </div>
          </div>
          {/* Pills statut */}
          <div className="mt-3 flex flex-wrap gap-2">
            {statutsFiltres.map(f => {
              const count = f.key === 'tous' ? tickets.length : tickets.filter(t => t.statut === f.key).length
              return (
                <button key={f.key} onClick={() => setFiltreStatut(f.key)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${filtreStatut === f.key ? 'bg-ades-green text-white' : 'border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'}`}
                >
                  {f.label} <span className="opacity-60">({count})</span>
                </button>
              )
            })}
          </div>
          {ticketsFiltres.length !== tickets.length && (
            <p className="mt-2 text-xs text-neutral-400">{ticketsFiltres.length} ticket{ticketsFiltres.length > 1 ? 's' : ''} affiché{ticketsFiltres.length > 1 ? 's' : ''} sur {tickets.length}</p>
          )}
        </div>

        {/* ── Tableau des tickets ── */}
        <div className="rounded-2xl border border-neutral-100 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-neutral-700">
              Tickets centralisés
              <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">{ticketsFiltres.length}</span>
            </h3>
            <p className="text-xs text-neutral-400">Cliquer sur une ligne pour gérer</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100">
                  <th className="pb-2 text-left text-xs font-normal text-neutral-400 pr-3">Référence</th>
                  <th className="pb-2 text-left text-xs font-normal text-neutral-400 pr-3">Titre</th>
                  <th className="pb-2 text-left text-xs font-normal text-neutral-400 pr-3">Acheteur</th>
                  <th className="pb-2 text-left text-xs font-normal text-neutral-400 pr-3">Projet</th>
                  <th className="pb-2 text-left text-xs font-normal text-neutral-400 pr-3">Statut</th>
                  <th className="pb-2 text-left text-xs font-normal text-neutral-400 pr-3 cursor-pointer select-none hover:text-neutral-600" onClick={() => toggleTri('priorite')}>
                    Priorité <SortIcon col="priorite" />
                  </th>
                  <th className="pb-2 text-left text-xs font-normal text-neutral-400 pr-3 cursor-pointer select-none hover:text-neutral-600" onClick={() => toggleTri('dateEcheance')}>
                    Échéance <SortIcon col="dateEcheance" />
                  </th>
                  <th className="pb-2 text-left text-xs font-normal text-neutral-400 pr-3 cursor-pointer select-none hover:text-neutral-600" onClick={() => toggleTri('joursEnCours')}>
                    En cours <SortIcon col="joursEnCours" />
                  </th>
                  <th className="pb-2 text-left text-xs font-normal text-neutral-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {ticketsFiltres.length === 0 && (
                  <tr><td colSpan={9} className="py-10 text-center text-xs text-neutral-400">Aucun ticket ne correspond aux filtres sélectionnés.</td></tr>
                )}
                {ticketsFiltres.map(t => {
                  const isOverdue    = daysUntil(t.dateEcheance) < 0 && t.statut !== 'cloture' && t.statut !== 'rejete'
                  const rappelDispo  = needsRappel(t) && Boolean(t.acheteurAssigne)
                  const joursEC      = joursEnCours(t)

                  return (
                    <tr key={t.id} onClick={() => setSelected(t)}
                      className={`cursor-pointer border-b border-neutral-50 transition last:border-0 hover:bg-neutral-50/60 ${isOverdue ? 'bg-red-50/20' : ''}`}
                    >
                      <td className="py-2.5 pr-3"><span className="font-mono text-xs text-neutral-400">{t.reference}</span></td>
                      <td className="py-2.5 pr-3">
                        <p className="text-sm font-medium text-neutral-800 max-w-[180px] truncate">{t.titre}</p>
                        {isOverdue && <span className="rounded bg-red-100 px-1 py-0.5 text-[10px] text-red-700">Retard</span>}
                      </td>
                      <td className="py-2.5 pr-3">
                        {t.acheteurAssigne
                          ? <span className="text-xs text-neutral-700">{t.acheteurAssigne}</span>
                          : <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-600">Non assigné</span>
                        }
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-neutral-500">{t.projet}</td>
                      <td className="py-2.5 pr-3"><StatutBadge statut={t.statut} /></td>
                      <td className="py-2.5 pr-3"><PrioriteBadge priorite={t.priorite} /></td>
                      <td className={`py-2.5 pr-3 text-xs ${isOverdue ? 'font-medium text-red-700' : 'text-neutral-500'}`}>{formatDate(t.dateEcheance)}</td>
                      <td className="py-2.5 pr-3">
                        {joursEC > 0
                          ? <span className={`text-xs ${joursEC >= 5 ? 'font-semibold text-amber-700' : 'text-neutral-400'}`}>{joursEC}j</span>
                          : <span className="text-xs text-neutral-300">—</span>
                        }
                      </td>
                      <td className="py-2.5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          {t.statut !== 'cloture' && t.statut !== 'rejete' && (
                            <button onClick={() => setSelected(t)} className="rounded-lg border border-ades-green/30 bg-green-50 px-2 py-1 text-xs text-ades-green transition hover:bg-green-100">
                              {t.acheteurAssigne ? 'Réassigner' : 'Assigner'}
                            </button>
                          )}
                          {rappelDispo && (
                            <button
                              onClick={() => { const log = { date: TODAY, sentBy: 'Responsable Achat' }; setTickets(prev => prev.map(tk => tk.id === t.id ? { ...tk, rappelsEnvoyes: [...tk.rappelsEnvoyes, log] } : tk)); showToast(`Rappel envoyé à ${t.acheteurAssigne} pour ${t.reference}`, 'warning') }}
                              className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700 transition hover:bg-amber-100"
                            >
                              Rappel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </>
  )
}
