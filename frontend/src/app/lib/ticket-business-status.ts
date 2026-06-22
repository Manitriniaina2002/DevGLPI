export type TicketBusinessStatus = 'Créé' | 'Assigné' | 'En cours de traitement' | 'Clos' | 'Rejeté'

type TicketRecord = Record<string, unknown>

export function resolveTicketBusinessStatus(ticket: TicketRecord, workflow?: TicketRecord | null): TicketBusinessStatus {
  if (isTicketRejected(ticket, workflow)) return 'Rejeté'

  const buyer = String(firstValue(ticket, ['acheteur', 'assignedTo', 'assigned_to', 'acheteur_assigne', 'buyer']) ?? '')
  const workflowSteps = getWorkflowSteps(workflow)
  if (workflowSteps.length > 0) {
    const resolution = workflowSteps.find((step) => /resolution|r[ée]solution|livraison|cl[oô]ture/.test(stepName(step)))
    if (resolution && isCompletedStep(resolution)) return 'Clos'

    const treatment = workflowSteps.find((step) => /solution|traitement|achat/.test(stepName(step)))
    if (treatment && (isCompletedStep(treatment) || isActiveStep(treatment))) return 'En cours de traitement'

    const assignment = workflowSteps.find((step) => /attribution|assignation|assign/.test(stepName(step)))
    const assignedBuyer = String(firstValue(assignment ?? {}, ['acheteur_assigne', 'buyer', 'assigned_to']) ?? firstValue(workflow ?? {}, ['acheteur_assigne', 'buyer', 'assigned_to']) ?? buyer)
    if ((assignment && isCompletedStep(assignment)) || hasAssignedBuyer(assignedBuyer)) return 'Assigné'

    return 'Créé'
  }

  const statusCode = numberValue(ticket.status ?? ticket.statut_code ?? ticket.status_code)
  const statusText = values(ticket, ['status_label', 'statut', 'status_name', 'statusName', 'etat', 'state']).join(' ').toLowerCase()
  const resolutionDate = firstValue(ticket, ['date_resolution', 'dateResolution', 'closedate', 'closedAt', 'solvedate', 'resolution_date'])

  if (statusCode === 5 || statusCode === 6 || resolutionDate !== undefined || /clos|cl[oô]tur|r[ée]solu|livr|termin|done|completed|resolved|closed/.test(statusText)) return 'Clos'
  if (statusCode === 3 || statusCode === 4 || /traitement|progress|pending|attente|planifi/.test(statusText)) return 'En cours de traitement'

  if (statusCode === 2 || hasAssignedBuyer(buyer) || /assign|attrib/.test(statusText)) return 'Assigné'
  return 'Créé'
}

export function isTicketRejected(ticket: TicketRecord, workflow?: TicketRecord | null) {
  const workflowSteps = getWorkflowSteps(workflow)
  if (workflow && containsRejection(values(workflow, ['statut_global', 'global_status', 'statut', 'status', 'detail', 'decision', 'resultat']))) return true
  if (workflowSteps.some((step) => containsRejection(values(step, ['statut', 'status', 'state', 'detail', 'decision', 'resultat', 'label'])))) return true

  const delivered = workflowSteps.some((step) => /resolution|r[ée]solution|livraison|cl[oô]ture/.test(stepName(step)) && isCompletedStep(step))
  if (delivered) return false

  if (booleanValue(firstValue(ticket, ['is_rejected', 'rejected', 'refused']))) return true
  if (containsRejection(values(ticket, ['status_label', 'statut', 'status_name', 'statusName', 'etat', 'state', 'validation_status', 'validation_result']))) return true
  return false
}

function getWorkflowSteps(workflow?: TicketRecord | null): TicketRecord[] {
  if (!workflow) return []
  const steps = firstValue(workflow, ['etapes', 'steps', 'history', 'historique'])
  if (!Array.isArray(steps)) return []
  return steps.filter((step): step is TicketRecord => Boolean(step) && typeof step === 'object' && !Array.isArray(step))
}

function stepName(step: TicketRecord) {
  return String(firstValue(step, ['etape', 'key', 'type', 'step', 'name']) ?? '').toLowerCase()
}

function isCompletedStep(step: TicketRecord) {
  const status = String(firstValue(step, ['statut', 'status', 'state']) ?? '').toLowerCase()
  return /done|completed|closed|resolved|termin|livr|success/.test(status)
}

function isActiveStep(step: TicketRecord) {
  const status = String(firstValue(step, ['statut', 'status', 'state']) ?? '').toLowerCase()
  return /current|progress|active|processing|traitement|open/.test(status)
}

function containsRejection(items: unknown[]) {
  return items.some((value) => /refused|rejected|rejet|refus/.test(String(value).toLowerCase()))
}

function values(record: TicketRecord, keys: string[]) {
  return keys.map((key) => record[key]).filter((value) => value !== null && value !== undefined && value !== '')
}

function firstValue(record: TicketRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (value !== null && value !== undefined && value !== '') return value
  }
  return undefined
}

function numberValue(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function booleanValue(value: unknown) {
  return value === true || value === 1 || String(value).toLowerCase() === 'true'
}

function hasAssignedBuyer(value: string) {
  const normalized = value.trim().toLowerCase()
  return normalized !== '' && normalized !== '-' && normalized !== 'non renseigné' && normalized !== 'non assigné' && normalized !== 'non assigne'
}
