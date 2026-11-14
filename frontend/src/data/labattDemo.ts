import type {
  PositionStance, ProposalCommunityAggregateDTO, ProposalFeedbackSubmissionDTO, ProposalSpecificElementDTO,
} from './proposalFeedbackDTO'

export const LABATT_PROPOSAL_ID = 'toronto-labatt-river-towers'
export const LABATT_DEMO_HASH = '#labatt-demo'

export interface DemoChange {
  feature_id: string
  title: string
  summary: string
  before: string
  after: string
}

export interface DemoRound {
  id: string
  label: string
  date: string
  summary: string
  arrangements: string[]
  features: ProposalSpecificElementDTO[]
  changes: DemoChange[]
  aggregate: ProposalCommunityAggregateDTO
  comments: ProposalFeedbackSubmissionDTO[]
  requirement_assessments: Record<string, RequirementAssessment>
}

interface RequirementAssessment {
  status: 'potentially addressed' | 'unresolved' | 'uncertain'
  feature_id: string | null
  explanation: string
  version_id: string | null
  passage: string | null
}

export interface DemoJourney {
  revision: string | null
  current_version_id: string
  versions: DemoRound[]
  previous_response: ProposalFeedbackSubmissionDTO
  current_response: ProposalFeedbackSubmissionDTO | null
  participant_action: 'not reviewed' | 'reconfirmed' | 'revised'
  requirement_assessment: RequirementAssessment | null
  review_totals: { unreviewed: number; reconfirmed: number; revised: number }
  grouping_origin: 'prepared'
  distinct_participants: number
  current_only: number
  matched_positions: { participants: number; earlier: Record<PositionStance, number>; current: Record<PositionStance, number> }
}

const SESSION_KEY = 'proviso.labatt-demo.session'

export function labattDemoSession(): string {
  const stored = sessionStorage.getItem(SESSION_KEY)
  if (stored && /^[0-9a-f]{64}$/.test(stored)) return stored
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('')
  sessionStorage.setItem(SESSION_KEY, token)
  return token
}

export function demoVersionLabel(version: Pick<DemoRound, 'date' | 'label'>): string {
  const date = new Date(version.date + 'T00:00:00Z')
  return version.label + ' · ' + date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}
