'use client'

import { useEffect, useState, type ChangeEvent, type DragEvent } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, FileText, UploadCloud } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { useTicketsList } from '@/app/hooks/useTicketsList'



// ─── Types ────────────────────────────────────────────────────────────────────

type TicketStatus = 'créé' | 'en cours' | 'clôturé' | 'rejeté'
type Priority = 'normal' | 'urgent'


interface Comment {
  id: string
  author: string
  date: string
  text: string
  internal: boolean
}

interface Attachment {
  id: string
  name: string
  type: 'acte_vente' | 'devis' | 'facture' | 'bon_commande' | 'autre'
  url: string
  date: string
}

interface Ticket {
  id: string
  reference: string
  title: string
  project: string
  status: TicketStatus
  priority: Priority
  assignedTo: string
  assignedManually: boolean       // ← distingue affectation manuelle
  createdAt: string
  takenInChargeAt: string | null  // ← date prise en charge effective
  deadline: string
  supplier?: string
  amount?: number
  description: string
  commandeRecue: boolean          // ← requis pour clôture
  comments: Comment[]
  attachments: Attachment[]
}

// ─── Données fictives ─────────────────────────────────────────────────────────

const INITIAL_TICKETS: Ticket[] = [
  {
    id: '1',
    reference: 'ACH-2025-001',
    title: 'Fournitures de bureau – Q2',
    project: 'Projet Alpha',
    status: 'en cours',
    priority: 'normal',
    assignedTo: 'Jean Dupont',
    assignedManually: false,
    createdAt: '2025-05-10',
    takenInChargeAt: '2025-05-11',
    deadline: '2025-06-20',
    supplier: 'Bureau Plus',
    amount: 1250000,
    commandeRecue: false,
    description: "Commande trimestrielle de fournitures de bureau pour l'équipe projet Alpha.",
    comments: [
      { id: 'c1', author: 'Jean Dupont', date: '2025-05-12', text: 'Devis reçu, en attente de validation.', internal: true },
    ],
    attachments: [
      { id: 'a1', name: 'Devis_BureauPlus_001.pdf', type: 'devis', url: '#', date: '2025-05-12' },
    ],
  },
  {
    id: '2',
    reference: 'ACH-2025-002',
    title: 'Matériel informatique – laptops',
    project: 'Projet Beta',
    status: 'créé',
    priority: 'urgent',
    assignedTo: 'Jean Dupont',
    assignedManually: true,       // affectation manuelle
    createdAt: '2025-05-14',
    takenInChargeAt: null,        // pas encore pris en charge
    deadline: '2025-05-28',
    commandeRecue: false,
    description: 'Acquisition de 5 laptops pour les nouveaux collaborateurs du projet Beta.',
    comments: [],
    attachments: [],
  },
  {
    id: '3',
    reference: 'ACH-2025-003',
    title: 'Services de maintenance réseau',
    project: 'Projet Alpha',
    status: 'en cours',
    priority: 'urgent',
    assignedTo: 'Jean Dupont',
    assignedManually: true,
    createdAt: '2025-05-15',
    takenInChargeAt: '2025-05-15',
    deadline: '2025-05-25',
    commandeRecue: false,
    description: "Contrat annuel de maintenance réseau pour les locaux du projet Alpha.",
    comments: [
      { id: 'c2', author: 'Sophie Martin', date: '2025-05-15', text: 'Urgent : infrastructure critique.', internal: false },
    ],
    attachments: [],
  },
  {
    id: '4',
    reference: 'ACH-2025-004',
    title: 'Mobilier salle de conférence',
    project: 'Projet Gamma',
    status: 'clôturé',
    priority: 'normal',
    assignedTo: 'Jean Dupont',
    assignedManually: false,
    createdAt: '2025-04-20',
    takenInChargeAt: '2025-04-21',
    deadline: '2025-05-10',
    supplier: 'Mobilier Pro',
    amount: 3800000,
    commandeRecue: true,
    description: 'Remplacement du mobilier de la salle de conférence principale.',
    comments: [
      { id: 'c3', author: 'Jean Dupont', date: '2025-05-08', text: 'Livraison confirmée et conforme.', internal: true },
    ],
    attachments: [
      { id: 'a2', name: 'Bon_livraison_MOB.pdf', type: 'bon_commande', url: '#', date: '2025-05-08' },
    ],
  },
  {
    id: '5',
    reference: 'ACH-2025-005',
    title: 'Logiciels de comptabilité',
    project: 'Projet Beta',
    status: 'rejeté',
    priority: 'normal',
    assignedTo: 'Jean Dupont',
    assignedManually: false,
    createdAt: '2025-04-25',
    takenInChargeAt: '2025-04-26',
    deadline: '2025-05-15',
    commandeRecue: false,
    description: 'Licence pour 10 postes du logiciel de comptabilité.',
    comments: [
      { id: 'c4', author: 'Direction', date: '2025-05-01', text: 'Budget non disponible ce trimestre.', internal: false },
    ],
    attachments: [],
  },
  {
    id: '6',
    reference: 'ACH-2025-006',
    title: 'Équipements de protection individuelle',
    project: 'Projet Gamma',
    status: 'en cours',
    priority: 'urgent',
    assignedTo: 'Jean Dupont',
    assignedManually: true,
    createdAt: '2025-05-16',
    takenInChargeAt: '2025-05-17',
    deadline: '2025-05-30',
    supplier: 'SafetyFirst',
    amount: 750000,
    commandeRecue: false,
    description: "EPI pour l'équipe terrain du projet Gamma – casques, gilets, chaussures de sécurité.",
    comments: [],
    attachments: [
      { id: 'a3', name: 'Devis_SafetyFirst.pdf', type: 'devis', url: '#', date: '2025-05-17' },
    ],
  },
  {
    id: '7',
    reference: 'ACH-2025-007',
    title: 'Véhicule de service – utilitaire',
    project: 'Projet Delta',
    status: 'créé',
    priority: 'normal',
    assignedTo: 'Jean Dupont',
    assignedManually: true,
    createdAt: '2025-06-01',
    takenInChargeAt: null,        // non pris en charge depuis +48h
    deadline: '2025-06-18',
    commandeRecue: false,
    description: "Location longue durée d'un véhicule utilitaire pour les déplacements terrain.",
    comments: [],
    attachments: [],
  },
]

const PROJECTS = ['Tous les projets', 'Projet Alpha', 'Projet Beta', 'Projet Gamma', 'Projet Delta']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

function daysBetween(a: string, b: string) {
  return Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatAmount(n: number) {
  return new Intl.NumberFormat('fr-MG', { style: 'currency', currency: 'MGA', maximumFractionDigits: 0 }).format(n)
}

function statusClasses(s: string) {
  const map: Record<string, string> = {
    'créé':     'bg-blue-50 text-blue-700 border border-blue-200',
    'en cours': 'bg-amber-50 text-amber-700 border border-amber-200',
    'clôturé':  'bg-green-50 text-green-700 border border-green-200',
    'rejeté':   'bg-red-50 text-red-700 border border-red-200',
    'urgent':   'bg-orange-50 text-orange-700 border border-orange-200',
  }
  return map[s] ?? 'bg-neutral-100 text-neutral-600'
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    'créé': 'Créé', 'en cours': 'En cours', 'clôturé': 'Clôturé', 'rejeté': 'Rejeté', 'urgent': 'Urgent',
  }
  return map[s] ?? s
}

// ─── Micro-composants ─────────────────────────────────────────────────────────

function Badge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClasses(status)}`}>
      {statusLabel(status)}
    </span>
  )
}

function DeadlineBadge({ deadline, status }: { deadline: string; status: TicketStatus }) {
  if (status === 'clôturé' || status === 'rejeté') return null
  const days = daysUntil(deadline)
  const cls =
    days < 0 ? 'bg-red-50 text-red-700 border border-red-200'
    : days <= 3 ? 'bg-orange-50 text-orange-700 border border-orange-200'
    : days <= 7 ? 'bg-amber-50 text-amber-700 border border-amber-200'
    : 'bg-neutral-50 text-neutral-500 border border-neutral-200'
  const label = days < 0 ? `Dépassé de ${Math.abs(days)}j` : days === 0 ? "Aujourd'hui" : `J-${days}`
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      ⏱ {label}
    </span>
  )
}

function DelaiPriseEnCharge({ ticket }: { ticket: Ticket }) {
  if (ticket.status === 'créé' && !ticket.takenInChargeAt) {
    const hours = Math.ceil((Date.now() - new Date(ticket.createdAt).getTime()) / 3600000)
    const isLate = hours > 48
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${isLate ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
        {isLate ? '⚠ Non pris en charge +48h' : `⏳ En attente (${hours}h)`}
      </span>
    )
  }
  if (ticket.takenInChargeAt) {
    const delay = daysBetween(ticket.createdAt, ticket.takenInChargeAt)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-neutral-50 px-2.5 py-0.5 text-xs text-neutral-500 border border-neutral-200">
        Pris en charge en {delay === 0 ? 'le jour même' : `${delay}j`}
      </span>
    )
  }
  return null
}

function KpiCard({
  label, value, sub, valueClass = 'text-neutral-900',
}: {
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

// ─── Modal Ticket ─────────────────────────────────────────────────────────────

function TicketModal({
  ticket, onClose, onUpdate,
}: {
  ticket: Ticket; onClose: () => void; onUpdate: (t: Ticket) => void
}) {
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'attachments'>('details')
  const [newComment, setNewComment] = useState('')
  const [isInternal, setIsInternal] = useState(true)
  const [status, setStatus] = useState<TicketStatus>(ticket.status)
  const [supplier, setSupplier] = useState(ticket.supplier ?? '')
  const [amount, setAmount] = useState(ticket.amount ? String(ticket.amount) : '')
  const [commandeRecue, setCommandeRecue] = useState(ticket.commandeRecue)
  const [saving, setSaving] = useState(false)
  const [cloturureError, setCloturureError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [dragOverType, setDragOverType] = useState<Attachment['type'] | null>(null)
  const [uploadError, setUploadError] = useState('')

  const days = daysUntil(ticket.deadline)
  const deadlineColor = days < 0 ? 'text-red-600' : days <= 3 ? 'text-orange-600' : days <= 7 ? 'text-amber-600' : 'text-neutral-600'

  // Prendre en charge : passe le ticket "en cours" et enregistre la date
  function handlePrendreEnCharge() {
    const now = new Date().toISOString().split('T')[0]
    onUpdate({ ...ticket, status: 'en cours', takenInChargeAt: now })
  }

  function handleSave() {
    setSaving(true)
    setTimeout(() => {
      onUpdate({ ...ticket, status, supplier, amount: amount ? Number(amount) : undefined, commandeRecue })
      setSaving(false)
    }, 400)
  }

  function handleCloturer() {
    setCloturureError('')
    if (!commandeRecue) {
      setCloturureError('Veuillez confirmer la réception de la commande avant de clôturer.')
      return
    }
    if (ticket.attachments.filter(a => a.type === 'bon_commande' || a.type === 'facture').length === 0) {
      setCloturureError('Merci de joindre un bon de commande ou une facture avant de clôturer.')
      return
    }
    onUpdate({ ...ticket, status: 'clôturé', commandeRecue: true })
    onClose()
  }

  function handleAddComment() {
    if (!newComment.trim()) return
    const comment: Comment = {
      id: `c${Date.now()}`,
      author: 'Jean Dupont',
      date: new Date().toISOString().split('T')[0],
      text: newComment.trim(),
      internal: isInternal,
    }
    onUpdate({ ...ticket, comments: [...ticket.comments, comment] })
    setNewComment('')
  }



  function addFiles(files: FileList | File[], type: Attachment['type']) {
    const selectedFiles = Array.from(files)

    if (selectedFiles.length === 0) return

    const allowedExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg']
    const invalidFile = selectedFiles.find((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase()
      return !extension || !allowedExtensions.includes(extension)
    })

    if (invalidFile) {
      setUploadError(`Format non pris en charge : ${invalidFile.name}`)
      return
    }

    setUploadError('')
    setUploading(true)

    const newAttachments: Attachment[] = selectedFiles.map((file) => ({
      id: `a${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: file.name,
      type,
      url: URL.createObjectURL(file),
      date: new Date().toISOString().split('T')[0],
    }))

    onUpdate({
      ...ticket,
      attachments: [...ticket.attachments, ...newAttachments],
    })

    setUploading(false)
  }

  function handleFileUpload(e: ChangeEvent<HTMLInputElement>, type: Attachment['type']) {
    if (e.target.files) {
      addFiles(e.target.files, type)
    }

    e.target.value = ''
  }

  function handleDrop(e: DragEvent<HTMLLabelElement>, type: Attachment['type']) {
    e.preventDefault()
    setDragOverType(null)
    addFiles(e.dataTransfer.files, type)
  }


  
  const documentTypes: Array<{
    type: Attachment['type']
    title: string
    hint: string
  }> = [
    { type: 'acte_vente', title: 'Acte de vente', hint: 'Document signe ou scan officiel' },
    { type: 'devis', title: 'Devis', hint: 'Offre fournisseur ou estimation' },
    { type: 'facture', title: 'Facture', hint: 'Facture proforma ou definitive' },
    { type: 'bon_commande', title: 'Bon de commande', hint: 'BC valide par le service achat' },
    { type: 'autre', title: 'Autre document', hint: 'Justificatif, image ou annexe' },
  ]

  const typeIcon = (t: string) => t === 'acte_vente' ? 'AV' : t === 'devis' ? 'DEV' : t === 'facture' ? 'FAC' : t === 'bon_commande' ? 'BC' : 'DOC'
  const typeColor = (t: string) =>
    t === 'acte_vente' ? 'bg-rose-100 text-rose-700'
    : t === 'devis' ? 'bg-blue-100 text-blue-700'
    : t === 'facture' ? 'bg-green-100 text-green-700'
    : t === 'bon_commande' ? 'bg-purple-100 text-purple-700'
    : 'bg-neutral-100 text-neutral-600'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto p-4 pt-16">
      <div className="w-full max-w-2xl rounded-[2rem] border border-slate-200 bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 p-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-neutral-400">{ticket.reference}</span>
              <Badge status={ticket.status} />
              {ticket.priority === 'urgent' && <Badge status="urgent" />}
              {ticket.assignedManually && (
                <span className="inline-flex items-center rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700 border border-violet-200">
                  ✦ Affecté manuellement
                </span>
              )}
            </div>
            <h2 className="mt-1 text-lg font-semibold text-neutral-900">{ticket.title}</h2>
            <p className="text-sm text-neutral-500">{ticket.project}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition">✕</button>
        </div>

        {/* Prise en charge rapide */}
        {ticket.status === 'créé' && !ticket.takenInChargeAt && (
          <div className="mx-6 mt-4 flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-amber-800">Ce ticket n'a pas encore été pris en charge</p>
              <p className="text-xs text-amber-600 mt-0.5">Cliquez pour démarrer le traitement</p>
            </div>
            <button
              onClick={handlePrendreEnCharge}
              className="shrink-0 rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
            >
              Prendre en charge
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-100 px-6 pt-3">
          {(['details', 'comments', 'attachments'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium transition ${activeTab === tab ? 'border-b-2 border-ades-green text-ades-green' : 'text-neutral-500 hover:text-neutral-700'}`}
            >
              {tab === 'details' ? 'Détails'
                : tab === 'comments' ? `Commentaires (${ticket.comments.length})`
                : `Pièces jointes (${ticket.attachments.length})`}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">

          {/* ── DETAILS ── */}
          {activeTab === 'details' && (
            <div className="space-y-5">
              {/* Grille infos */}
              <div className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-100 bg-neutral-50 p-4 text-sm">
                <div>
                  <p className="text-xs text-neutral-400 mb-0.5">Créé le</p>
                  <p className="font-medium text-neutral-700">{formatDate(ticket.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 mb-0.5">Échéance</p>
                  <p className={`font-semibold ${deadlineColor}`}>{formatDate(ticket.deadline)}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 mb-0.5">Prise en charge</p>
                  <p className="font-medium text-neutral-700">
                    {ticket.takenInChargeAt ? formatDate(ticket.takenInChargeAt) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 mb-0.5">Délai de prise en charge</p>
                  {ticket.takenInChargeAt
                    ? <p className="font-medium text-neutral-700">{daysBetween(ticket.createdAt, ticket.takenInChargeAt) === 0 ? 'Jour même' : `${daysBetween(ticket.createdAt, ticket.takenInChargeAt)} jour(s)`}</p>
                    : <p className="font-medium text-red-600">Non traité</p>
                  }
                </div>
                <div>
                  <p className="text-xs text-neutral-400 mb-0.5">Assigné à</p>
                  <p className="font-medium text-neutral-700">{ticket.assignedTo}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 mb-0.5">Délai restant</p>
                  <p className={`font-semibold ${deadlineColor}`}>
                    {days < 0 ? `Dépassé de ${Math.abs(days)}j` : days === 0 ? "Aujourd'hui" : `${days} jour(s)`}
                  </p>
                </div>
              </div>

              {/* Description */}
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-400">Description</p>
                <p className="rounded-2xl border border-slate-100 bg-neutral-50 p-4 text-sm text-neutral-700">{ticket.description}</p>
              </div>

              {/* Fournisseur & montant */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">Informations fournisseur</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1">Nom du fournisseur</label>
                    <input
                      type="text"
                      value={supplier}
                      onChange={(e) => setSupplier(e.target.value)}
                      placeholder="Saisir le fournisseur…"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-ades-green focus:ring-2 focus:ring-ades-green/20 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1">Montant (MGA)</label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-ades-green focus:ring-2 focus:ring-ades-green/20 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Statut */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">Mettre à jour le statut</p>
                <div className="flex flex-wrap gap-2">
                  {(['créé', 'en cours', 'clôturé', 'rejeté'] as TicketStatus[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${status === s ? statusClasses(s) + ' ring-2 ring-offset-1 ring-ades-green/40' : 'border-slate-200 text-neutral-500 hover:bg-neutral-50'}`}
                    >
                      {statusLabel(s)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Confirmation réception commande */}
              <div className={`rounded-2xl border p-4 ${commandeRecue ? 'border-green-200 bg-green-50/40' : 'border-slate-200 bg-neutral-50'}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={commandeRecue}
                    onChange={(e) => setCommandeRecue(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-ades-green focus:ring-ades-green"
                  />
                  <div>
                    <p className={`text-sm font-semibold ${commandeRecue ? 'text-green-700' : 'text-neutral-700'}`}>
                      {commandeRecue ? '✓ Commande reçue et conforme' : 'Confirmer la réception de la commande'}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      Requis pour pouvoir clôturer le ticket. Joindre le bon de commande ou la facture dans l'onglet Pièces jointes.
                    </p>
                  </div>
                </label>
              </div>

              {/* Erreur clôture */}
              {cloturureError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {cloturureError}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 rounded-full bg-ades-green px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ades-green/90 disabled:opacity-60"
                >
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
                {ticket.status !== 'clôturé' && ticket.status !== 'rejeté' && (
                  <button
                    onClick={handleCloturer}
                    className="rounded-full border border-green-600 px-4 py-2.5 text-sm font-semibold text-green-700 transition hover:bg-green-50"
                  >
                    Clôturer le ticket
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── COMMENTAIRES ── */}
          {activeTab === 'comments' && (
            <div className="space-y-4">
              {ticket.comments.length === 0 ? (
                <p className="py-6 text-center text-sm text-neutral-400">Aucun commentaire pour le moment.</p>
              ) : (
                <ul className="space-y-3">
                  {ticket.comments.map((c) => (
                    <li key={c.id} className={`rounded-2xl border p-4 text-sm ${c.internal ? 'border-amber-100 bg-amber-50/50' : 'border-slate-100 bg-white'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-neutral-800">{c.author}</span>
                        <div className="flex items-center gap-2">
                          {c.internal && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Interne</span>
                          )}
                          <span className="text-xs text-neutral-400">{formatDate(c.date)}</span>
                        </div>
                      </div>
                      <p className="text-neutral-700">{c.text}</p>
                    </li>
                  ))}
                </ul>
              )}
              <div className="rounded-2xl border border-slate-100 bg-neutral-50 p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Nouveau commentaire</p>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={3}
                  placeholder="Saisir un commentaire…"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-ades-green focus:ring-2 focus:ring-ades-green/20 resize-none transition"
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-neutral-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                      className="rounded"
                    />
                    Commentaire interne
                  </label>
                  <button
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                    className="rounded-full bg-ades-green px-4 py-2 text-sm font-semibold text-white transition hover:bg-ades-green/90 disabled:opacity-50"
                  >
                    Publier
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── PIÈCES JOINTES ── */}
          {activeTab === 'attachments' && (
            <div className="space-y-4">
              {/* Rappel clôture */}
              {ticket.status !== 'clôturé' && (
                <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700">
                  Pour clôturer ce ticket, joindre un <strong>bon de commande</strong> ou une <strong>facture</strong> confirmant la réception.
                </div>
              )}

              {ticket.attachments.length === 0 ? (
                <p className="py-4 text-center text-sm text-neutral-400">Aucune pièce jointe.</p>
              ) : (
                <ul className="space-y-2">
                  {ticket.attachments.map((a) => (
                    <li key={a.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-neutral-50 p-3">
                      <div className="flex items-center gap-3">
                        <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${typeColor(a.type)}`}>
                          {typeIcon(a.type)}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-neutral-800">{a.name}</p>
                          <p className="text-xs text-neutral-400 capitalize">{a.type.replace('_', ' ')} · {formatDate(a.date)}</p>
                        </div>
                      </div>
                      <a href={a.url} className="rounded-lg px-3 py-1.5 text-xs font-medium text-ades-green border border-ades-green/30 hover:bg-ades-green/5 transition">
                        Voir
                      </a>
                    </li>
                  ))}
                </ul>
              )}

              <div className="space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Soumettre un document</p>
                    <p className="mt-1 text-sm text-neutral-500">Glissez-deposez l'acte de vente ou selectionnez un fichier depuis votre poste.</p>
                  </div>
                  <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-500">
                    PDF, Word, Excel, image
                  </span>
                </div>

                {uploadError && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                    <AlertCircle className="h-4 w-4" />
                    {uploadError}
                  </div>
                )}

                <div className="grid gap-3 md:grid-cols-2">
                  {documentTypes.map(({ type, title, hint }) => {
                    const isDragOver = dragOverType === type
                    const isActeVente = type === 'acte_vente'
                    const hasAttachment = ticket.attachments.some((attachment) => attachment.type === type)

                    return (
                      <label
                        key={type}
                        onDragOver={(e) => {
                          e.preventDefault()
                          setDragOverType(type)
                        }}
                        onDragLeave={() => setDragOverType(null)}
                        onDrop={(e) => handleDrop(e, type)}
                        className={[
                          'group relative flex min-h-[132px] cursor-pointer flex-col justify-between rounded-2xl border border-dashed p-4 transition',
                          isActeVente ? 'md:col-span-2' : '',
                          isDragOver
                            ? 'border-ades-green bg-ades-green/10 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-ades-green/50 hover:bg-ades-green/5',
                        ].join(' ')}
                      >
                        <input
                          type="file"
                          multiple
                          className="hidden"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                          onChange={(e) => handleFileUpload(e, type)}
                        />

                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${typeColor(type)}`}>
                              {typeIcon(type)}
                            </span>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-neutral-800">{title}</p>
                                {isActeVente && (
                                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                                    Requis
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-xs text-neutral-500">{hint}</p>
                            </div>
                          </div>
                          {hasAttachment ? (
                            <CheckCircle2 className="h-5 w-5 shrink-0 text-ades-green" />
                          ) : (
                            <FileText className="h-5 w-5 shrink-0 text-neutral-300 transition group-hover:text-ades-green" />
                          )}
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
                          <span className="inline-flex min-w-0 items-center gap-2">
                            <UploadCloud className="h-4 w-4 shrink-0" />
                            <span className="truncate">{isDragOver ? 'Relachez pour deposer' : 'Glisser ici ou cliquer'}</span>
                          </span>
                          <span className="shrink-0 font-medium text-ades-green">
                            {uploading ? 'Upload...' : 'Choisir'}
                          </span>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Zone upload par type */}
              <div className="hidden">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Joindre un document</p>
                {(['devis', 'facture', 'bon_commande', 'autre'] as const).map((type) => (
                  <div key={type} className="flex items-center justify-between rounded-xl border border-dashed border-slate-200 px-4 py-2.5">
                    <span className={`rounded px-2 py-0.5 text-xs font-bold ${typeColor(type)}`}>{typeIcon(type)}</span>
                    <span className="flex-1 ml-3 text-sm text-neutral-600 capitalize">{type.replace('_', ' ')}</span>
                    
                    <label className="cursor-pointer rounded-full border border-ades-green px-3 py-1 text-xs font-medium text-ades-green hover:bg-ades-green/5 transition">
                      {uploading ? 'Upload…' : 'Choisir…'}
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                        onChange={(e) => handleFileUpload(e, type)}
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

import RoleGuard from '@/app/authenticated/role-guard'

export default function DashboardAcheteurPage() {
  return (
    <RoleGuard allowedRoles={['acheteur']}>
      <DashboardAcheteurContent />
    </RoleGuard>
  )
}

function DashboardAcheteurContent() {
  const { tickets: apiTickets, loading, error } = useTicketsList({ per_page: 200 })

  const [tickets, setTickets] = useState<Ticket[]>([])
  
  useEffect(() => {
    // Map API response to the UI Ticket shape if needed.
    setTickets(
      apiTickets.map((t: any) => ({
        id: String(t.id),
        reference: String(t.reference ?? t.titre ?? ''),
        title: String(t.title ?? t.titre ?? ''),
        project: String(t.project ?? 'Non assigné'),
        status: (t.statut ?? t.status ?? 'en cours') as TicketStatus,
        priority: (t.priorite ?? t.priority ?? 'normal') as Priority,
        assignedTo: String(t.acheteur ?? t.assignedTo ?? 'Non assigné'),
        assignedManually: Boolean(t.assignedManually ?? false),
        createdAt: String(t.dateCreation ?? t.createdAt ?? new Date().toISOString().split('T')[0]),
        takenInChargeAt: (t.takenInChargeAt ?? t.datePriseEnCharge ?? null) as string | null,
        deadline: String(t.dateEcheance ?? t.deadline ?? new Date().toISOString().split('T')[0]),
        supplier: t.supplier ? String(t.supplier) : undefined,
        amount: t.amount != null ? Number(t.amount) : undefined,
        description: String(t.description ?? ''),
        commandeRecue: Boolean(t.commandeRecue ?? false),
        comments: (Array.isArray(t.comments) ? t.comments : []) as any,
        attachments: (Array.isArray(t.attachments) ? t.attachments : []) as any,
      }))
    )
  }, [apiTickets])



  const [selectedProject, setSelectedProject] = useState('Tous les projets')

  const [selectedStatus, setSelectedStatus] = useState<string>('tous')
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [search, setSearch] = useState('')

  // ── KPIs ──
  const active = tickets.filter((t) => t.status !== 'clôturé' && t.status !== 'rejeté')
  const nonPrisEnCharge = tickets.filter((t) => t.status === 'créé' && !t.takenInChargeAt)
  const enRetard = tickets.filter((t) => daysUntil(t.deadline) < 0 && t.status !== 'clôturé' && t.status !== 'rejeté')

  // ── Suivi par projet ──
  const projectStats = PROJECTS.filter((p) => p !== 'Tous les projets').map((proj) => {
    const pt = tickets.filter((t) => t.project === proj)
    return {
      name: proj,
      total: pt.length,
      actifs: pt.filter((t) => t.status !== 'clôturé' && t.status !== 'rejeté').length,
      clotures: pt.filter((t) => t.status === 'clôturé').length,
      urgents: pt.filter((t) => t.priority === 'urgent' && t.status !== 'clôturé').length,
      retards: pt.filter((t) => daysUntil(t.deadline) < 0 && t.status !== 'clôturé' && t.status !== 'rejeté').length,
    }
  }).filter((p) => p.total > 0)

  // ── Filtres ──
  const filtered = tickets.filter((t) => {
    const matchProject = selectedProject === 'Tous les projets' || t.project === selectedProject
    const matchStatus = selectedStatus === 'tous' || t.status === selectedStatus
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.reference.toLowerCase().includes(search.toLowerCase())
    return matchProject && matchStatus && matchSearch
  })

  function handleUpdate(updated: Ticket) {
    setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    setSelectedTicket(updated)
  }

  const statusFilters = [
    { key: 'tous', label: 'Tous', count: tickets.length },
    { key: 'créé', label: 'Créés', count: tickets.filter((t) => t.status === 'créé').length },
    { key: 'en cours', label: 'En cours', count: tickets.filter((t) => t.status === 'en cours').length },
    { key: 'clôturé', label: 'Clôturés', count: tickets.filter((t) => t.status === 'clôturé').length },
    { key: 'rejeté', label: 'Rejetés', count: tickets.filter((t) => t.status === 'rejeté').length },
  ]

  return (
    <div className="space-y-8">

      {/* ── En-tête ── */}
      <div className="rounded-xl border border-slate-200 bg-white/95 px-6 py-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-neutral-900">Espace Acheteur</h1>
            <p className="mt-2 max-w-2xl text-sm text-neutral-600">
              Gérez vos tickets assignés, suivez les délais de prise en charge et clôturez les commandes reçues.
            </p>
          </div>
          {/* <Link
            href="/dashboard"
            className="rounded-xl border border-ades-green bg-white px-4 py-2 text-sm font-semibold text-ades-green transition hover:bg-ades-green/10"
          >
            Retour au dashboard
          </Link> */}
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
        <KpiCard label="Tickets assignés" value={tickets.length} sub="Total sous ma responsabilité" />
        <KpiCard label="Actifs" value={active.length} sub="En cours de traitement" valueClass="text-blue-700" />
        <KpiCard label="Urgents" value={tickets.filter((t) => t.priority === 'urgent' && t.status !== 'clôturé').length} sub="Action rapide requise" valueClass="text-orange-600" />
        <KpiCard label="Non pris en charge" value={nonPrisEnCharge.length} sub={nonPrisEnCharge.length > 0 ? 'Action requise' : 'Aucun'} valueClass={nonPrisEnCharge.length > 0 ? 'text-red-600' : 'text-neutral-400'} />
        <KpiCard label="En retard" value={enRetard.length} sub={enRetard.length > 0 ? 'Délais dépassés' : 'Aucun retard'} valueClass={enRetard.length > 0 ? 'text-red-600' : 'text-neutral-400'} />
      </div>

      {/* ── Alerte tickets non pris en charge ── */}
      {nonPrisEnCharge.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
          <p className="text-sm font-semibold text-red-800">
            ⚠ {nonPrisEnCharge.length} ticket{nonPrisEnCharge.length > 1 ? 's' : ''} non pris en charge depuis plus de 48h
          </p>
          <ul className="mt-2 space-y-1">
            {nonPrisEnCharge.map((t) => (
              <li key={t.id} className="flex items-center justify-between text-sm text-red-700">
                <span>{t.reference} — {t.title}</span>
                <button
                  onClick={() => setSelectedTicket(t)}
                  className="rounded-full border border-red-400 px-3 py-0.5 text-xs font-medium text-red-700 hover:bg-red-100 transition"
                >
                  Traiter →
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Suivi par projet ── */}
      <Card className="card-ades">
        <CardHeader>
          <CardTitle>Suivi par projet</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {projectStats.map((p) => (
              <button
                key={p.name}
                onClick={() => setSelectedProject(selectedProject === p.name ? 'Tous les projets' : p.name)}
                className={`rounded-2xl border p-4 text-left transition hover:border-ades-green/40 hover:bg-ades-green/5 ${selectedProject === p.name ? 'border-ades-green bg-ades-green/5' : 'border-slate-100 bg-white'}`}
              >
                <p className="text-sm font-semibold text-neutral-800">{p.name}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-500">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" />{p.actifs} actif{p.actifs > 1 ? 's' : ''}</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-400" />{p.clotures} clôturé{p.clotures > 1 ? 's' : ''}</span>
                  {p.urgents > 0 && <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-400" />{p.urgents} urgent{p.urgents > 1 ? 's' : ''}</span>}
                  {p.retards > 0 && <span className="flex items-center gap-1 text-red-600"><span className="h-2 w-2 rounded-full bg-red-400" />{p.retards} retard{p.retards > 1 ? 's' : ''}</span>}
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className="h-full rounded-full bg-ades-green transition-all"
                    style={{ width: `${p.total ? Math.round((p.clotures / p.total) * 100) : 0}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-neutral-400">{p.total ? Math.round((p.clotures / p.total) * 100) : 0}% clôturé</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Liste des tickets ── */}
      <Card className="card-ades">
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle>Tickets assignés</CardTitle>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher…"
                className="rounded-full border border-slate-200 px-4 py-1.5 text-sm outline-none focus:border-ades-green focus:ring-2 focus:ring-ades-green/20 transition"
              />
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-ades-green transition bg-white"
              >
                {PROJECTS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          {/* Filtres statut */}
          <div className="mt-3 flex flex-wrap gap-2">
            {statusFilters.map((f) => (
              <button
                key={f.key}
                onClick={() => setSelectedStatus(f.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${selectedStatus === f.key ? 'bg-ades-green text-white' : 'border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'}`}
              >
                {f.label} <span className="opacity-70">({f.count})</span>
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent>
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-400">Aucun ticket correspondant aux filtres.</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((ticket) => {
                const isOverdue = daysUntil(ticket.deadline) < 0 && ticket.status !== 'clôturé' && ticket.status !== 'rejeté'
                return (
                  <button
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    className={`w-full rounded-3xl border p-4 text-left transition hover:border-ades-green/40 hover:shadow-sm ${isOverdue ? 'border-red-100 bg-red-50/30' : 'border-[rgba(76,139,64,0.12)] bg-white/90'}`}
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium text-neutral-400">{ticket.reference}</span>
                          <Badge status={ticket.status} />
                          {ticket.priority === 'urgent' && <Badge status="urgent" />}
                          {ticket.assignedManually && (
                            <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-700 border border-violet-200">✦ Manuel</span>
                          )}
                          <DeadlineBadge deadline={ticket.deadline} status={ticket.status} />
                          <DelaiPriseEnCharge ticket={ticket} />
                        </div>
                        <p className="mt-1.5 font-semibold text-neutral-900 truncate">{ticket.title}</p>
                        <p className="text-sm text-neutral-500">{ticket.project}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-400 shrink-0 md:text-right">
                        {ticket.supplier && <span className="font-medium text-neutral-600">{ticket.supplier}</span>}
                        {ticket.amount && <span className="font-semibold text-ades-green">{formatAmount(ticket.amount)}</span>}
                        {ticket.attachments.length > 0 && <span>📎 {ticket.attachments.length}</span>}
                        {ticket.comments.length > 0 && <span>💬 {ticket.comments.length}</span>}
                        <span>Échéance : {formatDate(ticket.deadline)}</span>
                        <span className="rounded-full border border-ades-green px-3 py-1 text-ades-green hover:bg-ades-green/5 transition">
                          Ouvrir →
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Modal ── */}
      {selectedTicket && (
        <TicketModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  )
}
