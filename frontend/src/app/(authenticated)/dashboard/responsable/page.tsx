'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

// ─── Types ─────────────────────────────────────────────────────────────────────

type TicketStatus = 'cree' | 'en_cours' | 'cloture' | 'rejete'
type TicketPriority = 'haute' | 'normale' | 'basse'
type OngletKey = 'overview' | 'acheteurs' | 'projets'

interface Ticket {
  id: string
  titre: string
  description: string
  acheteur: string | null
  projet: string
  statut: TicketStatus
  priorite: TicketPriority
  dateCreation: string
  dateEcheance: string
  enRetard: boolean
  joursSansAction: number
}

interface Acheteur {
  nom: string
  initiales: string
  enCours: number
  retards: number
  clotures: number
  charge: number
}

interface Projet {
  nom: string
  tickets: number
  retards: number
  avancement: number
}

// ─── Données ────────────────────────────────────────────────────────────────────

const INITIAL_TICKETS: Ticket[] = [
  { id: 'TK-001', titre: 'Achat équipements réseau',    description: 'Commande de switches et routeurs pour la salle serveur',    acheteur: 'A. Martin', projet: 'Projet Alpha', statut: 'en_cours', priorite: 'haute',   dateCreation: '2025-06-01', dateEcheance: '2025-06-05', enRetard: true,  joursSansAction: 8 },
  { id: 'TK-002', titre: 'Fournitures bureau Q3',        description: 'Commande trimestrielle de fournitures de bureau',           acheteur: null,        projet: 'Projet Beta',  statut: 'cree',     priorite: 'normale', dateCreation: '2025-06-02', dateEcheance: '2025-06-09', enRetard: false, joursSansAction: 7 },
  { id: 'TK-003', titre: 'Licence logiciel ERP',         description: 'Renouvellement licence annuelle ERP SAP',                   acheteur: 'C. Leroy',  projet: 'Projet Gamma', statut: 'en_cours', priorite: 'haute',   dateCreation: '2025-05-28', dateEcheance: '2025-06-03', enRetard: true,  joursSansAction: 6 },
  { id: 'TK-004', titre: 'Matériel informatique',        description: 'Laptops et écrans pour nouveaux collaborateurs',             acheteur: 'D. Sow',    projet: 'Projet Alpha', statut: 'cloture',  priorite: 'normale', dateCreation: '2025-05-20', dateEcheance: '2025-05-30', enRetard: false, joursSansAction: 0 },
  { id: 'TK-005', titre: 'Mobilier open space',          description: 'Bureaux réglables et chaises ergonomiques',                 acheteur: 'A. Martin', projet: 'Projet Delta', statut: 'en_cours', priorite: 'basse',   dateCreation: '2025-06-03', dateEcheance: '2025-06-10', enRetard: false, joursSansAction: 2 },
  { id: 'TK-006', titre: 'Prestation consultant SI',     description: "Audit architecture système d'information",                  acheteur: 'C. Leroy',  projet: 'Projet Beta',  statut: 'en_cours', priorite: 'haute',   dateCreation: '2025-05-25', dateEcheance: '2025-06-01', enRetard: true,  joursSansAction: 9 },
  { id: 'TK-007', titre: 'Câblage salle serveur',        description: 'Installation câblage réseau structuré',                     acheteur: 'B. Dupont', projet: 'Projet Alpha', statut: 'rejete',   priorite: 'normale', dateCreation: '2025-05-30', dateEcheance: '2025-06-06', enRetard: false, joursSansAction: 0 },
  { id: 'TK-008', titre: 'Abonnement cloud AWS',         description: 'Renouvellement contrat AWS Enterprise',                     acheteur: 'D. Sow',    projet: 'Projet Gamma', statut: 'cloture',  priorite: 'haute',   dateCreation: '2025-05-15', dateEcheance: '2025-05-25', enRetard: false, joursSansAction: 0 },
  { id: 'TK-009', titre: 'Imprimantes multifonctions',   description: 'Remplacement parc imprimantes 3e étage',                   acheteur: null,        projet: 'Projet Delta', statut: 'cree',     priorite: 'basse',   dateCreation: '2025-06-05', dateEcheance: '2025-06-15', enRetard: false, joursSansAction: 4 },
  { id: 'TK-010', titre: 'Formation cybersécurité',      description: 'Programme de formation SOC pour 12 agents',                 acheteur: 'C. Leroy',  projet: 'Projet Alpha', statut: 'en_cours', priorite: 'haute',   dateCreation: '2025-05-29', dateEcheance: '2025-06-04', enRetard: true,  joursSansAction: 7 },
  { id: 'TK-011', titre: 'Véhicule de service',          description: 'Location longue durée VL commercial',                       acheteur: null,        projet: 'Projet Beta',  statut: 'cree',     priorite: 'haute',   dateCreation: '2025-06-04', dateEcheance: '2025-06-12', enRetard: false, joursSansAction: 5 },
  { id: 'TK-012', titre: 'Maintenance climatisation',    description: 'Contrat entretien annuel groupe froid',                     acheteur: 'B. Dupont', projet: 'Projet Gamma', statut: 'en_cours', priorite: 'normale', dateCreation: '2025-05-31', dateEcheance: '2025-06-07', enRetard: false, joursSansAction: 3 },
]

const ACHETEURS_LIST: Acheteur[] = [
  { nom: 'A. Martin', initiales: 'AM', enCours: 5, retards: 2, clotures: 14, charge: 72 },
  { nom: 'B. Dupont', initiales: 'BD', enCours: 4, retards: 1, clotures: 11, charge: 55 },
  { nom: 'C. Leroy',  initiales: 'CL', enCours: 6, retards: 3, clotures: 10, charge: 88 },
  { nom: 'D. Sow',    initiales: 'DS', enCours: 3, retards: 0, clotures: 12, charge: 40 },
]

const PROJETS: Projet[] = [
  { nom: 'Projet Alpha', tickets: 22, retards: 3, avancement: 68 },
  { nom: 'Projet Beta',  tickets: 17, retards: 4, avancement: 52 },
  { nom: 'Projet Gamma', tickets: 15, retards: 0, avancement: 90 },
  { nom: 'Projet Delta', tickets:  9, retards: 1, avancement: 44 },
]

const PIE_DATA = [
  { name: 'Clôturés', value: 47 },
  { name: 'En cours', value: 18 },
  { name: 'En retard', value: 8 },
  { name: 'Rejetés', value: 5 },
]
const PIE_COLORS = ['#3B6D11', '#185FA5', '#BA7517', '#A32D2D']

const MONTHLY_DATA = [
  { mois: 'Jan', crees: 38, clotures: 30, retards: 2 },
  { mois: 'Fév', crees: 44, clotures: 38, retards: 3 },
  { mois: 'Mar', crees: 51, clotures: 44, retards: 4 },
  { mois: 'Avr', crees: 56, clotures: 48, retards: 5 },
  { mois: 'Mai', crees: 60, clotures: 53, retards: 7 },
  { mois: 'Juin', crees: 63, clotures: 47, retards: 8 },
]

const WEEKLY_DATA = [
  { semaine: 'S1', crees: 18, clotures: 12 },
  { semaine: 'S2', crees: 14, clotures: 13 },
  { semaine: 'S3', crees: 16, clotures: 11 },
  { semaine: 'S4', crees: 15, clotures: 11 },
]

// ─── Config ────────────────────────────────────────────────────────────────────

const STATUT_CONFIG: Record<TicketStatus, { label: string; className: string }> = {
  cree:     { label: 'Créé',     className: 'bg-blue-50 text-blue-700' },
  en_cours: { label: 'En cours', className: 'bg-amber-50 text-amber-700' },
  cloture:  { label: 'Clôturé',  className: 'bg-green-50 text-green-700' },
  rejete:   { label: 'Rejeté',   className: 'bg-red-50 text-red-700' },
}

const PRIORITE_CONFIG: Record<TicketPriority, { label: string; className: string; dot: string }> = {
  haute:   { label: 'Haute',   className: 'bg-red-50 text-red-700',          dot: 'bg-red-500' },
  normale: { label: 'Normale', className: 'bg-neutral-100 text-neutral-600', dot: 'bg-neutral-400' },
  basse:   { label: 'Basse',   className: 'bg-neutral-50 text-neutral-500',  dot: 'bg-neutral-300' },
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function needsRappel(t: Ticket) {
  return t.joursSansAction >= 5 && t.statut === 'en_cours'
}

// ─── Micro-composants ──────────────────────────────────────────────────────────

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

function Badge({ label, className }: { label: string; className: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs ${className}`}>{label}</span>
}

// ─── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, type, onDismiss }: { message: string; type: 'success' | 'warning' | 'info'; onDismiss: () => void }) {
  const styles = { success: 'border-green-200 bg-green-50 text-green-800', warning: 'border-amber-200 bg-amber-50 text-amber-800', info: 'border-blue-200 bg-blue-50 text-blue-800' }
  const icons  = { success: '✓', warning: '⚠', info: 'ℹ' }
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg ${styles[type]}`}>
      <span className="text-base font-bold">{icons[type]}</span>
      <p className="text-xs font-medium">{message}</p>
      <button onClick={onDismiss} className="ml-2 text-xs opacity-60 hover:opacity-100">✕</button>
    </div>
  )
}

// ─── Modal Assigner ────────────────────────────────────────────────────────────

function ModalAssigner({ ticket, onClose, onConfirm }: {
  ticket: Ticket
  onClose: () => void
  onConfirm: (ticketId: string, acheteur: string) => void
}) {
  const [selected, setSelected] = useState<string>(ticket.acheteur || '')
  const isRe = Boolean(ticket.acheteur)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-neutral-100 bg-white p-6 shadow-xl">
        <div className="mb-5">
          <h2 className="text-base font-semibold text-neutral-900">{isRe ? 'Réassigner le ticket' : 'Assigner le ticket'}</h2>
          <p className="mt-1 text-xs text-neutral-500">{ticket.id} · {ticket.titre}</p>
        </div>
        {isRe && (
          <div className="mb-4 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
            <span className="font-medium">Acheteur actuel :</span> {ticket.acheteur}
          </div>
        )}
        <p className="mb-2 text-xs font-medium text-neutral-500">{isRe ? 'Choisir le nouvel acheteur' : 'Assigner à'}</p>
        <div className="space-y-2">
          {ACHETEURS_LIST.map((a) => {
            const chargeColor = a.charge >= 80 ? '#A32D2D' : a.charge >= 60 ? '#BA7517' : '#185FA5'
            const isSelected = selected === a.nom
            return (
              <button
                key={a.nom}
                onClick={() => setSelected(a.nom)}
                className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${isSelected ? 'border-ades-green bg-green-50/60' : 'border-neutral-100 bg-white hover:border-neutral-200 hover:bg-neutral-50'}`}
              >
                <div className="flex items-center gap-3">
                  <Avatar initiales={a.initiales} color={chargeColor} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-neutral-800">{a.nom}</span>
                      {ticket.acheteur === a.nom && <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">actuel</span>}
                    </div>
                    <div className="mt-1 flex items-center gap-3">
                      <span className="text-xs text-neutral-500">{a.enCours} en cours</span>
                      <ChargeBar value={a.charge} />
                    </div>
                  </div>
                  {isSelected && (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-ades-green">
                      <path d="M3 8.5L6.5 12L13 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              </button>
            )
          })}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-600 transition hover:bg-neutral-50">Annuler</button>
          <button
            disabled={!selected || selected === ticket.acheteur}
            onClick={() => { onConfirm(ticket.id, selected); onClose() }}
            className="rounded-full bg-ades-green px-4 py-2 text-sm font-medium text-white transition hover:bg-ades-green/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isRe ? 'Réassigner' : 'Assigner'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Détail Ticket ───────────────────────────────────────────────────────

function ModalDetailTicket({ ticket, onClose, onAssigner, onCloture, onRejeter, onRappel }: {
  ticket: Ticket
  onClose: () => void
  onAssigner: () => void
  onCloture: (id: string) => void
  onRejeter: (id: string) => void
  onRappel: (t: Ticket) => void
}) {
  const peutRappel = needsRappel(ticket) && Boolean(ticket.acheteur)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-neutral-100 bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-neutral-100 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-neutral-400">{ticket.id}</span>
              {ticket.enRetard && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-700">Retard</span>}
              {needsRappel(ticket) && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">+5j sans action</span>}
            </div>
            <h2 className="mt-1 text-base font-semibold text-neutral-900">{ticket.titre}</h2>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4 4L14 14M14 4L4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div className="px-6 py-4">
          <p className="mb-4 text-sm text-neutral-600">{ticket.description}</p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {[
              ['Statut',    <Badge key="s" label={STATUT_CONFIG[ticket.statut].label}     className={STATUT_CONFIG[ticket.statut].className} />],
              ['Priorité',  <Badge key="p" label={PRIORITE_CONFIG[ticket.priorite].label} className={PRIORITE_CONFIG[ticket.priorite].className} />],
              ['Projet',    <p key="pr" className="font-medium text-neutral-700">{ticket.projet}</p>],
              ['Acheteur',  <p key="a"  className="font-medium text-neutral-700">{ticket.acheteur || <span className="text-neutral-400">Non assigné</span>}</p>],
              ['Créé le',   <p key="c"  className="font-medium text-neutral-700">{ticket.dateCreation}</p>],
              ['Échéance',  <p key="e"  className={`font-medium ${ticket.enRetard ? 'text-red-700' : 'text-neutral-700'}`}>{ticket.dateEcheance}</p>],
            ].map(([label, node], i) => (
              <div key={i} className="rounded-xl bg-neutral-50 px-3 py-2.5">
                <p className="mb-1 text-neutral-400">{label as string}</p>
                {node}
              </div>
            ))}
          </div>
          {peutRappel && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
              <p className="text-xs text-amber-800">
                <span className="font-semibold">⚠ Rappel disponible :</span> Ce ticket est en cours depuis {ticket.joursSansAction} jours sans action.
              </p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 border-t border-neutral-100 px-6 py-4">
          {ticket.statut !== 'cloture' && ticket.statut !== 'rejete' && (
            <>
              <button onClick={onAssigner} className="rounded-full border border-ades-green bg-white px-3 py-1.5 text-xs font-medium text-ades-green transition hover:bg-green-50">
                {ticket.acheteur ? 'Réassigner' : 'Assigner'}
              </button>
              {ticket.statut === 'en_cours' && (
                <button onClick={() => { onCloture(ticket.id); onClose() }} className="rounded-full bg-ades-green px-3 py-1.5 text-xs font-medium text-white transition hover:bg-ades-green/90">
                  Clôturer
                </button>
              )}
              <button onClick={() => { onRejeter(ticket.id); onClose() }} className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100">
                Rejeter
              </button>
              {peutRappel && (
                <button onClick={() => { onRappel(ticket); onClose() }} className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 transition hover:bg-amber-100">
                  Envoyer rappel
                </button>
              )}
            </>
          )}
          <button onClick={onClose} className="ml-auto rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-600 transition hover:bg-neutral-50">Fermer</button>
        </div>
      </div>
    </div>
  )
}

// ─── Section Graphiques ────────────────────────────────────────────────────────

function SectionGraphiques() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-neutral-100 bg-white p-5">
        <h3 className="mb-4 text-sm font-medium text-neutral-700">Répartition par statut</h3>
        <div className="flex items-center gap-6">
          <ResponsiveContainer width="50%" height={160}>
            <PieChart>
              <Pie data={PIE_DATA} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" stroke="none">
                {PIE_DATA.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie>
              <Tooltip formatter={(v) => [`${v} tickets`]} />
            </PieChart>
          </ResponsiveContainer>
          <ul className="flex flex-col gap-2">
            {PIE_DATA.map((d, i) => (
              <li key={d.name} className="flex items-center gap-2 text-xs text-neutral-600">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: PIE_COLORS[i] }} />
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
          <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm bg-blue-600" />Créés</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm bg-green-700" />Clôturés</span>
        </div>
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={WEEKLY_DATA} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke="#f0f0ef" />
            <XAxis dataKey="semaine" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
            <Tooltip />
            <Bar dataKey="crees"    fill="#185FA5" radius={[4,4,0,0]} name="Créés" />
            <Bar dataKey="clotures" fill="#3B6D11" radius={[4,4,0,0]} name="Clôturés" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="col-span-full rounded-2xl border border-neutral-100 bg-white p-5">
        <h3 className="mb-1 text-sm font-medium text-neutral-700">Évolution mensuelle</h3>
        <div className="mb-3 flex gap-4 text-xs text-neutral-500">
          <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm bg-blue-600" />Créés</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm bg-green-700" />Clôturés</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm bg-amber-600" />En retard</span>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={MONTHLY_DATA}>
            <defs>
              <linearGradient id="gcrees" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#185FA5" stopOpacity={0.12} />
                <stop offset="95%" stopColor="#185FA5" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#f0f0ef" />
            <XAxis dataKey="mois"    tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
            <YAxis                   tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
            <Tooltip />
            <Area type="monotone" dataKey="crees"    stroke="#185FA5" strokeWidth={2} fill="url(#gcrees)" name="Créés"      dot={{ r: 3 }} />
            <Area type="monotone" dataKey="clotures" stroke="#3B6D11" strokeWidth={2} fill="none"         name="Clôturés"   dot={{ r: 3 }} />
            <Area type="monotone" dataKey="retards"  stroke="#BA7517" strokeWidth={2} strokeDasharray="4 3" fill="none"    name="En retard" dot={{ r: 3 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── Section Acheteurs ─────────────────────────────────────────────────────────

function SectionAcheteurs() {
  return (
    <div className="rounded-2xl border border-neutral-100 bg-white p-5">
      <h3 className="mb-4 text-sm font-medium text-neutral-700">Suivi par acheteur</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100">
              {['Acheteur','En cours','Retards','Clôturés','Charge'].map((h) => (
                <th key={h} className={`pb-2 text-xs font-normal text-neutral-400 ${h === 'Acheteur' || h === 'Charge' ? 'text-left' : 'text-center'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ACHETEURS_LIST.map((a) => (
              <tr key={a.nom} className="border-b border-neutral-50 last:border-0">
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <Avatar initiales={a.initiales} color={a.charge >= 80 ? '#A32D2D' : '#185FA5'} />
                    <span className="font-medium text-neutral-800">{a.nom}</span>
                  </div>
                </td>
                <td className="py-3 text-center text-neutral-700">{a.enCours}</td>
                <td className="py-3 text-center">
                  {a.retards > 0
                    ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">{a.retards}</span>
                    : <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">0</span>}
                </td>
                <td className="py-3 text-center text-neutral-700">{a.clotures}</td>
                <td className="py-3"><ChargeBar value={a.charge} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Section Projets ───────────────────────────────────────────────────────────

function SectionProjets() {
  return (
    <div className="rounded-2xl border border-neutral-100 bg-white p-5">
      <h3 className="mb-4 text-sm font-medium text-neutral-700">Suivi par projet</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100">
              {['Projet','Tickets','Retards','Avancement'].map((h) => (
                <th key={h} className={`pb-2 text-xs font-normal text-neutral-400 ${h === 'Projet' || h === 'Avancement' ? 'text-left' : 'text-center'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PROJETS.map((p) => (
              <tr key={p.nom} className="border-b border-neutral-50 last:border-0">
                <td className="py-3 font-medium text-neutral-800">{p.nom}</td>
                <td className="py-3 text-center text-neutral-700">{p.tickets}</td>
                <td className="py-3 text-center">
                  {p.retards > 0
                    ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">{p.retards}</span>
                    : <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">0</span>}
                </td>
                <td className="py-3"><ChargeBar value={p.avancement} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Page principale ───────────────────────────────────────────────────────────

export default function DashboardResponsablePage() {
  const [onglet, setOnglet]               = useState<OngletKey>('overview')
  const [tickets, setTickets]             = useState<Ticket[]>(INITIAL_TICKETS)
  const [modalAssigner, setModalAssigner] = useState<Ticket | null>(null)
  const [modalDetail, setModalDetail]     = useState<Ticket | null>(null)
  const [rappelsEnvoyes, setRappels]      = useState<Set<string>>(new Set())
  const [toasts, setToasts]               = useState<{ id: string; message: string; type: 'success' | 'warning' | 'info' }[]>([])

  const showToast = useCallback((message: string, type: 'success' | 'warning' | 'info' = 'success') => {
    const id = Date.now().toString()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const handleAssigner = useCallback((ticketId: string, acheteur: string) => {
    setTickets(prev => prev.map(t =>
      t.id === ticketId ? { ...t, acheteur, statut: t.statut === 'cree' ? 'en_cours' : t.statut } : t
    ))
    showToast(`Ticket ${ticketId} assigné à ${acheteur}`, 'success')
  }, [showToast])

  const handleCloture = useCallback((ticketId: string) => {
    setTickets(prev => prev.map(t =>
      t.id === ticketId ? { ...t, statut: 'cloture', enRetard: false, joursSansAction: 0 } : t
    ))
    showToast(`Ticket ${ticketId} clôturé avec succès`, 'success')
  }, [showToast])

  const handleRejeter = useCallback((ticketId: string) => {
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, statut: 'rejete' } : t))
    showToast(`Ticket ${ticketId} rejeté`, 'info')
  }, [showToast])

  const handleRappel = useCallback((ticket: Ticket) => {
    setRappels(prev => new Set([...prev, ticket.id]))
    showToast(`Rappel envoyé à ${ticket.acheteur} pour ${ticket.id}`, 'warning')
  }, [showToast])

  // KPIs live
  const kpiEnCours     = useMemo(() => tickets.filter(t => t.statut === 'en_cours').length,                                          [tickets])
  const kpiCrees       = useMemo(() => tickets.filter(t => t.statut === 'cree').length,                                              [tickets])
  const kpiRetards     = useMemo(() => tickets.filter(t => t.enRetard).length,                                                       [tickets])
  const kpiNonAssignes = useMemo(() => tickets.filter(t => !t.acheteur && t.statut !== 'cloture' && t.statut !== 'rejete').length,   [tickets])
  const kpiRappelsDus  = useMemo(() => tickets.filter(t => needsRappel(t) && !rappelsEnvoyes.has(t.id)).length,                      [tickets, rappelsEnvoyes])

  // Tickets live pour les modals
  const ticketForDetail = modalDetail  ? tickets.find(t => t.id === modalDetail.id)  || modalDetail  : null
  const ticketForAssign = modalAssigner ? tickets.find(t => t.id === modalAssigner.id) || modalAssigner : null

  const onglets: { key: OngletKey; label: string }[] = [
    { key: 'overview',  label: 'Vue générale' },
    { key: 'acheteurs', label: 'Par acheteur' },
    { key: 'projets',   label: 'Par projet' },
  ]

  return (
    <>
      {/* ── Toasts ── */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2">
        {toasts.map(t => <Toast key={t.id} message={t.message} type={t.type} onDismiss={() => setToasts(p => p.filter(x => x.id !== t.id))} />)}
      </div>

      {/* ── Modals ── */}
      {modalAssigner && ticketForAssign && (
        <ModalAssigner ticket={ticketForAssign} onClose={() => setModalAssigner(null)} onConfirm={handleAssigner} />
      )}
      {modalDetail && ticketForDetail && (
        <ModalDetailTicket
          ticket={ticketForDetail}
          onClose={() => setModalDetail(null)}
          onAssigner={() => { setModalAssigner(ticketForDetail); setModalDetail(null) }}
          onCloture={handleCloture}
          onRejeter={handleRejeter}
          onRappel={handleRappel}
        />
      )}

      <div className="space-y-6">

        {/* ── En-tête ── */}
        <div className="rounded-xl border border-slate-200 bg-white/95 px-6 py-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-neutral-900">Espace Responsable Achat</h1>
              <p className="mt-2 max-w-2xl text-sm text-neutral-600">
                Pilotage global · Assignation & réassignation · Rappels automatiques · Juin 2025
              </p>
            </div>
            <div className="flex gap-3">
              {/* ── Bouton principal vers gestion des tickets ── */}
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
                  <rect x="1" y="1" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M4 5h7M4 7.5h7M4 10h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                Gérer les tickets
              </Link>
              {/* <Link href="/dashboard" className="rounded-full border border-ades-green bg-white px-4 py-2 text-sm font-semibold text-ades-green transition hover:bg-ades-green/10">
                Retour au dashboard
              </Link> */}
            </div>
          </div>
        </div>

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          <KpiCard label="Tickets en cours"    value={kpiEnCours}    sub="À traiter"         valueClass="text-blue-700" />
          <KpiCard label="Nouvellement créés"  value={kpiCrees}      sub="À assigner" />
          <KpiCard label="En retard"           value={kpiRetards}    sub="Action urgente"    valueClass="text-red-700" />
          <KpiCard label="Non assignés"        value={kpiNonAssignes} sub="En attente"       valueClass={kpiNonAssignes > 0 ? 'text-orange-600' : 'text-neutral-400'} />
          <KpiCard label="Rappels en attente"  value={kpiRappelsDus} sub="+5j sans action"   valueClass={kpiRappelsDus > 0 ? 'text-amber-700' : 'text-green-700'} />
        </div>

        {/* ── Raccourcis d'action rapide ── */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Tickets non assignés */}
          {kpiNonAssignes > 0 && (
            <Link
              href="/dashboard/responsable/gestion-tickets?filtre=non_assigne"
              className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 transition hover:bg-amber-100/70"
            >
              <div>
                <p className="text-sm font-semibold text-amber-900">📋 {kpiNonAssignes} non assigné{kpiNonAssignes > 1 ? 's' : ''}</p>
                <p className="mt-0.5 text-xs text-amber-700">Affectation requise</p>
              </div>
              <span className="text-amber-600 text-lg">→</span>
            </Link>
          )}
          {/* Rappels */}
          {kpiRappelsDus > 0 && (
            <Link
              href="/dashboard/responsable/gestion-tickets?filtre=rappel"
              className="flex items-center justify-between rounded-2xl border border-orange-200 bg-orange-50 px-5 py-4 transition hover:bg-orange-100/70"
            >
              <div>
                <p className="text-sm font-semibold text-orange-900">⏱ {kpiRappelsDus} rappel{kpiRappelsDus > 1 ? 's' : ''} à envoyer</p>
                <p className="mt-0.5 text-xs text-orange-700">+5 jours sans action</p>
              </div>
              <span className="text-orange-600 text-lg">→</span>
            </Link>
          )}
          {/* En retard */}
          {kpiRetards > 0 && (
            <Link
              href="/dashboard/responsable/gestion-tickets?filtre=retard"
              className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 px-5 py-4 transition hover:bg-red-100/70"
            >
              <div>
                <p className="text-sm font-semibold text-red-900">⚠ {kpiRetards} ticket{kpiRetards > 1 ? 's' : ''} en retard</p>
                <p className="mt-0.5 text-xs text-red-700">Délais dépassés</p>
              </div>
              <span className="text-red-600 text-lg">→</span>
            </Link>
          )}
        </div>

        {/* ── Navigation onglets ── */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {onglets.map((o) => (
            <button
              key={o.key}
              onClick={() => setOnglet(o.key)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${onglet === o.key ? 'bg-ades-green text-white shadow-sm' : 'border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'}`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* ── Contenu onglets ── */}
        {onglet === 'overview' && (
          <div className="space-y-6">
            <SectionGraphiques />

            {/* Tickets critiques — aperçu rapide */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* En retard */}
              <div className="rounded-2xl border border-neutral-100 bg-white p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-neutral-700">Tickets en retard</h3>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">{tickets.filter(t => t.enRetard).length}</span>
                    <Link href="/dashboard/responsable/gestion-tickets?filtre=retard" className="text-xs text-ades-green underline underline-offset-2 hover:text-ades-green/80">Voir tout →</Link>
                  </div>
                </div>
                <ul className="space-y-3">
                  {tickets.filter(t => t.enRetard).slice(0, 4).map(t => (
                    <li key={t.id} className="flex items-start gap-3 rounded-xl bg-red-50/50 px-3 py-2.5">
                      <span className="mt-0.5 font-mono text-xs text-red-400">{t.id}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-neutral-800">{t.titre}</p>
                        <p className="mt-0.5 text-xs text-neutral-500">{t.acheteur || 'Non assigné'} · Échéance {t.dateEcheance}</p>
                      </div>
                      <button onClick={() => setModalDetail(t)} className="shrink-0 rounded-full border border-neutral-200 bg-white px-2.5 py-0.5 text-xs text-neutral-600 transition hover:bg-neutral-50">Voir</button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Non assignés */}
              <div className="rounded-2xl border border-neutral-100 bg-white p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-neutral-700">Non assignés</h3>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-600">{kpiNonAssignes}</span>
                    <Link href="/dashboard/responsable/gestion-tickets?filtre=non_assigne" className="text-xs text-ades-green underline underline-offset-2 hover:text-ades-green/80">Voir tout →</Link>
                  </div>
                </div>
                <ul className="space-y-3">
                  {tickets.filter(t => !t.acheteur && t.statut !== 'cloture' && t.statut !== 'rejete').slice(0, 4).map(t => (
                    <li key={t.id} className="flex items-start gap-3 rounded-xl bg-orange-50/40 px-3 py-2.5">
                      <span className="mt-0.5 font-mono text-xs text-orange-400">{t.id}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-neutral-800">{t.titre}</p>
                        <p className="mt-0.5 text-xs text-neutral-500">{t.projet} · Créé le {t.dateCreation}</p>
                      </div>
                      <button onClick={() => setModalAssigner(t)} className="shrink-0 rounded-full border border-ades-green bg-white px-2.5 py-0.5 text-xs text-ades-green transition hover:bg-ades-green/10">Affecter</button>
                    </li>
                  ))}
                </ul>
                {kpiNonAssignes === 0 && <p className="py-6 text-center text-xs text-neutral-400">Tous les tickets sont assignés ✓</p>}
                <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                  <p className="text-xs text-amber-800"><span className="font-medium">Acheteur disponible :</span> D. Sow — charge à 40%</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {onglet === 'acheteurs' && <SectionAcheteurs />}
        {onglet === 'projets'   && <SectionProjets />}

      </div>
    </>
  )
}
