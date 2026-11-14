// Keep stance counts separate from one another.
export type PositionStance =
  | 'strongly_oppose'
  | 'oppose'
  | 'neutral'
  | 'support'
  | 'strongly_support'
  | 'unsure'

export type StakeholderRole =
  | 'resident'   // Live in immediate neighbourhood
  | 'business'   // Local business owner or employee
  | 'commuter'   // Regular transit rider, cyclist, or daily commuter
  | 'visitor'    // Occasional visitor for dining/recreation
  | 'citywide'   // Toronto resident interested in broad city policy

export type ElementRatingKey = 'oppose' | 'neutral' | 'support' | 'unsure'

export interface PositionMeta {
  key: PositionStance
  label: string
  shortLabel: string
  color: string
  bgLight: string
}

export const POSITION_CONFIG: Record<PositionStance, PositionMeta> = {
  strongly_oppose: {
    key: 'strongly_oppose',
    label: 'Strongly Oppose',
    shortLabel: 'Strongly Oppose',
    color: '#9e3b2e',
    bgLight: '#fbeeed',
  },
  oppose: {
    key: 'oppose',
    label: 'Oppose',
    shortLabel: 'Oppose',
    color: '#d16c38',
    bgLight: '#fef3ec',
  },
  neutral: {
    key: 'neutral',
    label: 'Neutral',
    shortLabel: 'Neutral',
    color: '#848d7d',
    bgLight: '#f2f3ef',
  },
  support: {
    key: 'support',
    label: 'Support',
    shortLabel: 'Support',
    color: '#4e855e',
    bgLight: '#edf5ee',
  },
  strongly_support: {
    key: 'strongly_support',
    label: 'Strongly Support',
    shortLabel: 'Strongly Support',
    color: '#285a45',
    bgLight: '#e4f0e7',
  },
  unsure: {
    key: 'unsure',
    label: 'Unsure / Need more info',
    shortLabel: 'Unsure',
    color: '#6e7a85',
    bgLight: '#eff2f5',
  },
}

export const ORDERED_POSITIONS: PositionStance[] = [
  'strongly_oppose',
  'oppose',
  'neutral',
  'support',
  'strongly_support',
  'unsure',
]

export interface StakeholderMeta {
  key: StakeholderRole
  label: string
  icon: string
  color: string
}

export const STAKEHOLDER_CONFIG: Record<StakeholderRole, StakeholderMeta> = {
  resident: {
    key: 'resident',
    label: 'Local Resident',
    icon: 'pin',
    color: '#285a45',
  },
  business: {
    key: 'business',
    label: 'Business Owner / Worker',
    icon: 'layers',
    color: '#be6739',
  },
  commuter: {
    key: 'commuter',
    label: 'Regular Transit / Commuter',
    icon: 'bus',
    color: '#4a6fa5',
  },
  visitor: {
    key: 'visitor',
    label: 'Occasional Visitor',
    icon: 'leaf',
    color: '#7a856f',
  },
  citywide: {
    key: 'citywide',
    label: 'Citywide Interest',
    icon: 'target',
    color: '#8c7d95',
  },
}

export const ORDERED_STAKEHOLDERS: StakeholderRole[] = [
  'resident',
  'business',
  'commuter',
  'visitor',
  'citywide',
]

export interface ConditionItemDTO {
  id: string
  participant_id?: string
  source?: 'requirement' | 'comment'
  grouping_rejected?: boolean
  verbatim_quote: string
  extracted_requirement: string
  is_conditional_support: boolean // true = "I support if...", false = standalone objection
  time_window?: string           // e.g. "7–9 AM weekdays"
  location_label?: string        // e.g. "Augusta Ave near Baldwin St"
  concern_coordinates?: [number, number]
  submitted_at: string
}

export interface ConditionClusterDTO {
  is_suggested?: boolean
  id: string
  label: string                  // e.g. "Commercial Loading Windows (7–9 AM)"
  icon: string                   // Lucide/SVG icon identifier e.g. "bus", "pin", "check"
  category?: string              // Feature or topic reference
  count: number                  // Total conditions in this cluster
  percentage?: number            // Computed share of all conditions
  is_ungrouped?: boolean         // True for minority/unmatched conditions (prevents loss)
  items: ConditionItemDTO[]      // Verbatim evidence list (for drill-down expansion)
}

export interface ProposalSpecificElementDTO {
  id: string                     // e.g. 'loading_hours', 'pedestrian_schedule'
  title: string                  // e.g. 'Commercial Loading Windows'
  prompt: string                 // e.g. 'Restricting delivery access to 7–10 AM on weekdays'
  category?: string
  distribution: Record<ElementRatingKey, number> // Map for each row's rating counts
  total_responses: number
}

export interface ProposalCommunityAggregateDTO {
  total_participants: number
  total_conditions: number
  last_updated: string
  grouping_status?: 'pending' | 'ready' | 'error'
  grouping_error?: string | null
  grouping_updated_at?: string | null
  position_distribution: Record<PositionStance, number>
  stakeholder_distribution: Record<StakeholderRole, number>
  proposal_specific: ProposalSpecificElementDTO[]
  condition_clusters: ConditionClusterDTO[]
}

export interface ConfirmedCommentRequestDTO {
  requirement: string
  quote: string
  time_window?: string | null
  location_label?: string | null
}

export interface ProposalFeedbackSubmissionDTO {
  proposal_id: string
  version_id?: string
  participant_id: string
  position: PositionStance
  stakeholder_role: StakeholderRole
  /**
   * Ratings for each proposal-specific element (keyed by element.id)
   */
  element_ratings: Record<string, ElementRatingKey>
  comment: string
  confirmed_requests?: ConfirmedCommentRequestDTO[] | null
  condition?: {
    feature_id?: string
    requirement: string
    is_conditional_support: boolean
    time_window?: string
    location_label?: string
  }
  concern_coordinates?: [number, number]
  submitted_at: string
  /** Comment vote tallies, populated by the server on read. */
  upvotes?: number
  downvotes?: number
  score?: number
  /** The requesting viewer's vote on this comment: 1, -1, or 0. */
  my_vote?: number
}

export function getPercentage(count: number, total: number): number {
  if (!total || total <= 0) return 0
  return Math.round((count / total) * 100)
}

export function formatPercentage(count: number, total: number): string {
  return `${getPercentage(count, total)}%`
}

export function applyFeedbackToAggregate(
  aggregate: ProposalCommunityAggregateDTO,
  submission: ProposalFeedbackSubmissionDTO,
  previousSubmission?: ProposalFeedbackSubmissionDTO | null,
): ProposalCommunityAggregateDTO {
  const next: ProposalCommunityAggregateDTO = {
    ...aggregate,
    total_participants: aggregate.total_participants + (previousSubmission ? 0 : 1),
    last_updated: submission.submitted_at || new Date().toISOString(),
    position_distribution: { ...aggregate.position_distribution },
    stakeholder_distribution: { ...aggregate.stakeholder_distribution },
    proposal_specific: aggregate.proposal_specific.map(row => ({
      ...row,
      distribution: { ...row.distribution },
    })),
    condition_clusters: aggregate.condition_clusters.map(cluster => ({
      ...cluster,
      items: [...cluster.items],
    })),
  }

  // An edit replaces this participant's contribution rather than adding a vote.
  const sameRequests = !!previousSubmission
    && previousSubmission.comment.trim() === submission.comment.trim()
    && JSON.stringify(previousSubmission.confirmed_requests ?? []) === JSON.stringify(submission.confirmed_requests ?? [])
    && previousSubmission.condition?.requirement === submission.condition?.requirement
    && previousSubmission.condition?.feature_id === submission.condition?.feature_id
    && previousSubmission.condition?.time_window === submission.condition?.time_window
    && previousSubmission.condition?.location_label === submission.condition?.location_label
    && previousSubmission.condition?.is_conditional_support === submission.condition?.is_conditional_support
  if (previousSubmission) {
    next.position_distribution[previousSubmission.position] = Math.max(0, (next.position_distribution[previousSubmission.position] || 0) - 1)
    next.stakeholder_distribution[previousSubmission.stakeholder_role] = Math.max(0, (next.stakeholder_distribution[previousSubmission.stakeholder_role] || 0) - 1)
    for (const row of next.proposal_specific) {
      const rating = previousSubmission.element_ratings[row.id]
      if (rating) {
        row.distribution[rating] = Math.max(0, (row.distribution[rating] || 0) - 1)
        row.total_responses = Math.max(0, row.total_responses - 1)
      }
    }
    for (const cluster of sameRequests ? [] : next.condition_clusters) {
      const remaining = cluster.items.filter(item => item.participant_id !== submission.participant_id)
      const removed = cluster.items.length - remaining.length
      cluster.items = remaining
      cluster.count = Math.max(0, cluster.count - removed)
      next.total_conditions = Math.max(0, next.total_conditions - removed)
    }
  }

  if (submission.position in next.position_distribution) {
    next.position_distribution[submission.position] =
      (next.position_distribution[submission.position] || 0) + 1
  }

  if (submission.stakeholder_role in next.stakeholder_distribution) {
    next.stakeholder_distribution[submission.stakeholder_role] =
      (next.stakeholder_distribution[submission.stakeholder_role] || 0) + 1
  }

  for (const row of next.proposal_specific) {
    const userRating = submission.element_ratings[row.id]
    if (userRating && userRating in row.distribution) {
      row.distribution[userRating] = (row.distribution[userRating] || 0) + 1
      row.total_responses += 1
    }
  }

  const requests: Omit<ConditionItemDTO, 'id' | 'participant_id' | 'submitted_at'>[] = []
  if (submission.condition?.requirement.trim()) {
    requests.push({
      source: 'requirement',
      verbatim_quote: submission.comment.trim(),
      extracted_requirement: submission.condition.requirement.trim(),
      is_conditional_support: submission.condition.is_conditional_support,
      time_window: submission.condition.time_window,
      location_label: submission.condition.location_label,
      concern_coordinates: submission.concern_coordinates,
    })
  }
  for (const request of submission.confirmed_requests ?? []) {
    requests.push({
      source: 'comment', verbatim_quote: request.quote,
      extracted_requirement: request.requirement.trim(), is_conditional_support: false,
      time_window: request.time_window ?? undefined, location_label: request.location_label ?? undefined,
      concern_coordinates: submission.concern_coordinates,
    })
  }
  const seen = new Set<string>()
  for (const request of sameRequests ? [] : requests) {
    const key = JSON.stringify([request.extracted_requirement, request.time_window ?? '', request.location_label ?? ''].map(value => value.trim().toLowerCase()))
    if (seen.has(key)) continue
    seen.add(key)
    next.total_conditions += 1

    const newConditionItem: ConditionItemDTO = {
      ...request,
      id: `cond-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      participant_id: submission.participant_id,
      submitted_at: submission.submitted_at,
    }

    // A shared feature does not establish equivalent requests. Keep new needs
    // inspectable in ungrouped until their meaning has actually been reviewed.
    let targetCluster = next.condition_clusters.find(c => c.is_ungrouped)
    if (!targetCluster) {
      targetCluster = { id: 'cluster-ungrouped', label: 'Ungrouped / individual requirements', icon: 'message', count: 0, is_ungrouped: true, items: [] }
      next.condition_clusters.push(targetCluster)
    }

    if (targetCluster) {
      targetCluster.count += 1
      targetCluster.items.unshift(newConditionItem)
    }
  }

  for (const cluster of next.condition_clusters) {
    cluster.percentage = getPercentage(cluster.count, next.total_conditions)
  }

  return next
}

export function createEmptyAggregate(): ProposalCommunityAggregateDTO {
  return {
    total_participants: 0,
    total_conditions: 0,
    last_updated: new Date().toISOString(),
    position_distribution: {
      strongly_oppose: 0,
      oppose: 0,
      neutral: 0,
      support: 0,
      strongly_support: 0,
      unsure: 0,
    },
    stakeholder_distribution: {
      resident: 0,
      business: 0,
      commuter: 0,
      visitor: 0,
      citywide: 0,
    },
    proposal_specific: [],
    condition_clusters: [
      {
        id: 'cluster-ungrouped',
        label: 'Ungrouped / Unique Access Conditions',
        icon: 'help',
        count: 0,
        is_ungrouped: true,
        items: [],
      },
    ],
  }
}
