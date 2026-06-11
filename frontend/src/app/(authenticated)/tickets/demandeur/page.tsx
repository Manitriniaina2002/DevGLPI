'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Input } from '@/app/components/ui/input'
import { Textarea } from '@/app/components/ui/textarea'
import { Label } from '@/app/components/ui/label'
import { Button } from '@/app/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select'
import { CheckCircle, FileUp, ArrowLeft, X } from 'lucide-react'

type TicketRequest = {
  id: number
  department: string
  project: string
  requestType: string
  urgency: string
  observer: string
  objet: string
  attachments: string[]
  description: string
}

const departmentOptions = [
  'Co2 & Direction',
  'Cuisine Institutionnelle (CI)',
  'Finance',
  'Informatique',
  'Logistique',
  'Production',
  'Programme-Ecole (PE)',
  'Projet CEPF',
  'Reboisement',
  'Ressources Humaines (RH)',
  'Vente/Marketing',
]

const projectOptions = [
  'M001 - DN & Administration',
  'M002 - Finance',
  'M003 - Ressources humaines (RH)',
  'M004 - Informatique (IT)',
  'M005 - Marketing & Communication',
  'M006 - Vente',
  'M101 - Foyers améliorés OLI',
  'M232 - Programme École',
  'M233 - Empowerment',
  'M240 - Cuisines institutionnelles modulaires',
  'M300 - Reboisement',
  'M321 - Mahajanga La Brousse',
  'M322 - Fianarantsoa Voiala',
  'M323 - Fianarantsoa Vozama',
  'M324 - Farafangana',
  'M325 - Ankazobe / Manakara – TCOTPE',
  'M326 - Fianarantsoa ADIE',
  'M327 - Ejeda Centre Vert',
  'M328 - Andoharanomaitso – DREDD',
  'M329 - Ranohira TAPIA',
  'M410 - Services de certification CO₂',
  'M533 - Givaudan Sava',
  'M690 - Projets internes divers',
  'M507 - Optimisation de capacité, HTC et LNOB+ (EnDev)',
]

const urgencyOptions = ['Très basse', 'Basse', 'Moyenne', 'Haute', 'Très haute']

const observerOptions = [
  'Maryn',
  'Velonkaja',
  'Mbolatiana',
  'Nantenaina',
  'Ella',
  'Sendrahasina',
  'Fidy',
  'Jean Yves',
  'Henintsoa',
  'Pascal',
  'Francia',
]

const supportedExtensions = ['.pdf', '.xlsx', '.doc', '.docx', '.txt', '.msg', '.jpeg', '.jpg', '.gif']
const maxTotalSize = 20 * 1024 * 1024

export default function NewTicketPage() {
  const [department, setDepartment] = useState('')
  const [project, setProject] = useState('')
  const [urgency, setUrgency] = useState('')
  const [observer, setObserver] = useState('')
  const [objet, setObjet] = useState('')
  const [description, setDescription] = useState('')
  const [attachments, setAttachments] = useState<string[]>([])
  const [attachmentError, setAttachmentError] = useState('')
  const [requests, setRequests] = useState<TicketRequest[]>([])
  const [successId, setSuccessId] = useState<number | null>(null)

  useEffect(() => {
    const saved = window.localStorage.getItem('new-ticket-requests')
    if (saved) {
      setRequests(JSON.parse(saved))
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem('new-ticket-requests', JSON.stringify(requests))
  }, [requests])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setAttachmentError('')
    const files = event.target.files
    if (!files || files.length === 0) {
      setAttachments([])
      return
    }


    const selectedFiles = Array.from(files)
    const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0)
    if (totalSize > maxTotalSize) {
      setAttachmentError('Taille totale maximale atteinte (20 Mo).')
      return
    }

    const invalid = selectedFiles.find((file) => {
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
      return !supportedExtensions.includes(ext)
    })

    if (invalid) {
      setAttachmentError('Format non pris en charge. Utilisez .pdf, .xlsx, .doc, .docx, .txt, .msg, .jpeg ou .gif.')
      return
    }

    setAttachments(selectedFiles.map((file) => file.name))
  }





  const handleDrop = (
  event: React.DragEvent<HTMLDivElement>
) => {
  event.preventDefault()
  event.stopPropagation()

  setAttachmentError('')

  const files = event.dataTransfer.files

  if (!files || files.length === 0) return

  const selectedFiles = Array.from(files)

  const totalSize = selectedFiles.reduce(
    (sum, file) => sum + file.size,
    0
  )

  if (totalSize > maxTotalSize) {
    setAttachmentError(
      'Taille totale maximale atteinte (20 Mo).'
    )
    return
  }

  const invalid = selectedFiles.find((file) => {
    const ext = file.name
      .substring(file.name.lastIndexOf('.'))
      .toLowerCase()

    return !supportedExtensions.includes(ext)
  })

  if (invalid) {
    setAttachmentError(
      'Format non pris en charge. Utilisez .pdf, .xlsx, .doc, .docx, .txt, .msg, .jpeg ou .gif.'
    )
    return
  }

  setAttachments(
    selectedFiles.map((file) => file.name)
  )
}

const handleDragOver = (
  event: React.DragEvent<HTMLDivElement>
) => {
  event.preventDefault()
}





  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!department || !project || !urgency || !observer || !objet.trim() || !description.trim()) {
      return
    }

    const id = Math.floor(Math.random() * 9000) + 1000
    const newRequest: TicketRequest = {
      id,
      department,
      project,
      requestType: 'Achat',
      urgency,
      observer,
      objet: objet.trim(),
      attachments,
      description: description.trim(),
    }

    setRequests((current) => [newRequest, ...current])
    setSuccessId(id)
    setDepartment('')
    setProject('')
    setUrgency('')
    setObserver('')
    setObjet('')
    setDescription('')
    setAttachments([])
    setAttachmentError('')
  }

  const triggerFileSelect = () => {
    document.getElementById('attachment')?.click()
  }

  return (
    <div className="min-w-0 space-y-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/dashboard/demandeur"
          className="group mb-4 inline-flex items-center gap-2 text-sm font-medium text-ades-green transition hover:gap-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux dashboards
        </Link>
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-neutral-900">Créer une demande d'achat</h1>
        </div>
      </div>

      <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Main Form */}
        <Card className="card-ades min-w-0 overflow-hidden rounded-2xl border border-neutral-200/80 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.45)] ring-1 ring-white/70">
          <CardHeader className="rounded-t-2xl border-b border-neutral-200/70 bg-gradient-to-r from-slate-50 to-white pb-6 shadow-[inset_0_-1px_0_rgba(255,255,255,0.75)]">
            <CardTitle className="text-2xl">Informations de la demande</CardTitle>
            <p className="mt-2 text-sm text-neutral-600">
              Les champs marqués d'un <span className="font-semibold text-red-500">*</span> sont obligatoires
            </p>
          </CardHeader>
          <CardContent className="pt-8">
            <form className="space-y-8" onSubmit={handleSubmit}>
              {/* Section 1: Service & Projet */}
              <div className="space-y-1">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Contexte</h3>
                <div className="mt-4 grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="department" className="text-sm font-semibold text-neutral-900">
                      Service demandeur <span className="text-red-500">*</span>
                    </Label>
                    <Select value={department} onValueChange={(value) => setDepartment(value)}>
                      <SelectTrigger
                        id="department"
                        className="h-11 rounded-lg border border-neutral-300 bg-white outline-none transition focus:border-ades-green focus:ring-2 focus:ring-ades-green/20 focus-visible:ring-2 focus-visible:ring-ades-green/20 focus-visible:outline-none"
                      >
                        <SelectValue placeholder="Sélectionner un service" />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg">
                        {departmentOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="project" className="text-sm font-semibold text-neutral-900">
                      Projet <span className="text-red-500">*</span>
                    </Label>
                    <Select value={project} onValueChange={(value) => setProject(value)}>
                      <SelectTrigger
                        id="project"
                        className="h-11 rounded-lg border border-neutral-300 bg-white outline-none transition focus:border-ades-green focus:ring-2 focus:ring-ades-green/20 focus-visible:ring-2 focus-visible:ring-ades-green/20 focus-visible:outline-none"
                      >
                        <SelectValue placeholder="Sélectionner un projet" />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg">
                        {projectOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="border-t border-neutral-200/80 shadow-[0_-1px_0_rgba(255,255,255,0.85)]" />

              {/* Section 2: Priority & Approvals */}
              <div className="space-y-1">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Priorité et validation</h3>
                <div className="mt-4 grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="urgency" className="text-sm font-semibold text-neutral-900">
                      Urgence <span className="text-red-500">*</span>
                    </Label>
                    <Select value={urgency} onValueChange={(value) => setUrgency(value)}>
                      <SelectTrigger
                        id="urgency"
                        className="h-11 rounded-lg border border-neutral-300 bg-white outline-none transition focus:border-ades-green focus:ring-2 focus:ring-ades-green/20 focus-visible:ring-2 focus-visible:ring-ades-green/20 focus-visible:outline-none"
                      >
                        <SelectValue placeholder="Sélectionner l'urgence" />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg">
                        {urgencyOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="observer" className="text-sm font-semibold text-neutral-900">
                      Observateur (N+1) <span className="text-red-500">*</span>
                    </Label>
                    <Select value={observer} onValueChange={(value) => setObserver(value)}>
                      <SelectTrigger
                        id="observer"
                        className="h-11 rounded-lg border border-neutral-300 bg-white outline-none transition focus:border-ades-green focus:ring-2 focus:ring-ades-green/20 focus-visible:ring-2 focus-visible:ring-ades-green/20 focus-visible:outline-none"
                      >
                        <SelectValue placeholder="Sélectionner un observateur" />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg">
                        {observerOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Request Type Display */}
                <div className="mt-4">
                  <Label className="text-sm font-semibold text-neutral-900">Type de demande</Label>
                  <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-ades-green/20 bg-gradient-to-r from-ades-green/10 to-ades-green/5 px-4 py-2">
                    <div className="h-2 w-2 rounded-full bg-ades-green" />
                    <span className="font-semibold text-ades-green">Achat</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-neutral-200/80 shadow-[0_-1px_0_rgba(255,255,255,0.85)]" />

              {/* Section 3: Description */}
              <div className="space-y-1">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Détails de la demande</h3>
                <div className="mt-4 space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="objet" className="text-sm font-semibold text-neutral-900">
                      Objet <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="objet"
                      value={objet}
                      onChange={(event) => setObjet(event.target.value)}
                      placeholder="Ex : Achat de mobilier de bureau"
                      className="h-11 rounded-lg border border-neutral-300 outline-none transition focus:border-ades-green focus:ring-2 focus:ring-ades-green/20 focus-visible:ring-2 focus-visible:ring-ades-green/20 focus-visible:outline-none focus-visible:border-ades-green"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-sm font-semibold text-neutral-900">
                      Description détaillée <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      rows={5}
                      placeholder="Décrivez en détail votre besoin, le contexte, les spécifications et les éléments attendus..."
                      className="rounded-lg border border-neutral-300 outline-none transition focus:border-ades-green focus:ring-2 focus:ring-ades-green/20 focus-visible:ring-2 focus-visible:ring-ades-green/20 focus-visible:outline-none focus-visible:border-ades-green"
                    />
                    <p className="text-xs text-neutral-500">Maximum 1000 caractères recommandé</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-neutral-200/80 shadow-[0_-1px_0_rgba(255,255,255,0.85)]" />

              {/* Section 4: Attachments */}
              <div className="space-y-1">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Pièces jointes</h3>
                <div className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-neutral-900">
                      Télécharger des fichiers
                    </Label>

                    {/* Hidden file input */}
                    <input
                      id="attachment"
                      type="file"
                      accept=".pdf,.xlsx,.doc,.docx,.txt,.msg,.jpeg,.jpg,.gif"
                      multiple
                      onChange={handleFileChange}
                      className="sr-only"
                    />

                    {/* Drop zone — click triggers hidden input */}
                    <div
                        role="button"
                        tabIndex={0}
                        onClick={triggerFileSelect}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ')
                            triggerFileSelect()
                        }}
                        className="cursor-pointer rounded-xl border-2 border-dashed border-neutral-300/90 bg-gradient-to-br from-neutral-50/80 to-white p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_10px_28px_-24px_rgba(15,23,42,0.5)] transition hover:border-ades-green/80 hover:bg-ades-green/5 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_16px_34px_-24px_rgba(22,163,74,0.45)] focus:outline-none focus:border-ades-green focus:ring-2 focus:ring-ades-green/20"
                      >
                      {attachments.length > 0 ? (
                        <div className="flex flex-col items-center justify-center gap-3">
                          <FileUp className="h-7 w-7 text-ades-green" />
                          <p className="text-sm font-semibold text-ades-green">
                            {attachments.length} fichier{attachments.length > 1 ? 's' : ''} sélectionné{attachments.length > 1 ? 's' : ''}
                          </p>
                          <ul className="w-full space-y-1.5">
                            {attachments.map((fileName) => (
                              <li key={fileName} className="flex items-center gap-2 rounded-lg border border-ades-green/15 bg-ades-green/10 px-3 py-1.5 text-xs text-ades-green font-medium shadow-sm">
                                <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-ades-green" />
                                <span className="truncate">{fileName}</span>
                              </li>
                            ))}
                          </ul>
                          <p className="text-xs text-neutral-400">Cliquer pour modifier la sélection</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-2">
                          <FileUp className="h-8 w-8 text-ades-green" />
                          <p className="text-center text-sm font-medium text-neutral-900">
                            Glissez-déposez vos fichiers ou cliquez pour sélectionner
                          </p>
                          <p className="text-xs text-neutral-500">PDF, Excel, Word, texte, email ou images (max 20 Mo total)</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {attachmentError && (
                    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      <X className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      {attachmentError}
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-neutral-200/80 shadow-[0_-1px_0_rgba(255,255,255,0.85)]" />

              {/* Submit */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-neutral-600">
                  En envoyant cette demande, vous acceptez que vos informations soient traitées selon notre politique.
                </p>
                <Button
                  type="submit"
                  disabled={!department || !project || !urgency || !observer || !objet.trim() || !description.trim()}
                  size="lg"
                >
                  Envoyer la demande
                </Button>
              </div>

              {/* Success Message */}
              {successId && (
                <div className="animate-in fade-in slide-in-from-top-2 space-y-3 rounded-xl border border-ades-green/30 bg-gradient-to-br from-ades-green/10 to-ades-green/5 p-4 shadow-[0_14px_32px_-24px_rgba(22,163,74,0.55)]">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 flex-shrink-0 text-ades-green" />
                    <div>
                      <p className="font-semibold text-ades-green">Demande envoyée avec succès !</p>
                      <p className="text-sm text-ades-green/80">
                        Référence : <span className="font-mono font-semibold">#{successId}</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Sidebar: All Requests */}
        <div className="min-w-0 self-start">
          <Card className="card-ades min-w-0 overflow-hidden rounded-2xl border border-neutral-200/80 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.5)] ring-1 ring-white/70">
            <CardHeader className="rounded-t-2xl border-b border-neutral-200/70 bg-gradient-to-r from-slate-50 to-white shadow-[inset_0_-1px_0_rgba(255,255,255,0.75)]">
              <CardTitle>Historique complet</CardTitle>
              <p className="mt-1 text-xs text-neutral-600">
                {requests.length} demande{requests.length !== 1 ? 's' : ''}
              </p>
            </CardHeader>
            <CardContent className="pt-4">
              {requests.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
                    <svg className="h-6 w-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <p className="text-sm text-neutral-600">Aucune demande pour le moment</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {requests.map((request) => (
                    <div
                      key={request.id}
                      className="group rounded-xl border border-neutral-200/80 bg-gradient-to-br from-white to-slate-50 p-3 shadow-[0_10px_26px_-24px_rgba(15,23,42,0.55)] transition hover:border-ades-green/35 hover:bg-white hover:shadow-[0_14px_28px_-24px_rgba(15,23,42,0.4)]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-neutral-900">{request.objet}</p>
                          <p className="mt-1 text-xs text-neutral-500">#{request.id}</p>
                        </div>
                        <span className="inline-flex flex-shrink-0 rounded-full bg-ades-green/10 px-2 py-1 text-xs font-medium text-ades-green">
                          {request.urgency}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs text-neutral-600">{request.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
