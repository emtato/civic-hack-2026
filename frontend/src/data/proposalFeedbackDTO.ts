/**
 * Proposal Feedback & Community Aggregate DTO
 *
 * Designed for CIVIC Hack 2026:
 * - Part 1: Visual sentiment distributions, stakeholder connection breakdown,
 *   element-level ratings, and AI-grouped condition clusters with drill-down verbatim evidence.
 * - Part 2: Interactive citizen feedback submission (stance, role, element ratings,
 *   free-text comment, structured condition, and optional concern coordinates).
 */

// ============================================================================
// 1. Primitive Keys & Scales
// ============================================================================

/**
 * 5-point Likert scale for overall proposal stance + separate 'unsure' option.
 * Municipal rule: Never average positions into a single score.
 */
export type PositionStance =
  | 'strongly_oppose'
  | 'oppose'
  | 'neutral'
  | 'support'
  | 'strongly_support'
  | 'unsure'

/**
 * Universal stakeholder connection dimension.
 * Helps municipal staff distinguish immediate residents/business owners from citywide interest.
 */
export type StakeholderRole =
  | 'resident'   // Live in immediate neighbourhood
  | 'business'   // Local business owner or employee
  | 'commuter'   // Regular transit rider, cyclist, or daily commuter
  | 'visitor'    // Occasional visitor for dining/recreation
  | 'citywide'   // Toronto resident interested in broad city policy

/**
 * Element-level rating choice for proposal-specific design features.
 */
export type ElementRatingKey = 'oppose' | 'neutral' | 'support' | 'unsure'

// ============================================================================
// 2. Display Configurations & Metadata
// ============================================================================

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

// ============================================================================
// 3. Condition Item & Condition Cluster DTOs (The Free-Form Section)
// ============================================================================

/**
 * Individual verified condition record contributed by a resident.
 * Preserves verbatim comments, exact requirements, time windows, and optional coordinates.
 */
export interface ConditionItemDTO {
  id: string
  participant_id?: string
  verbatim_quote: string
  extracted_requirement: string
  is_conditional_support: boolean // true = "I support if...", false = standalone objection
  time_window?: string           // e.g. "7–9 AM weekdays"
  location_label?: string        // e.g. "Augusta Ave near Baldwin St"
  concern_coordinates?: [number, number]
  submitted_at: string
}

/**
 * Cluster row for the condition bar chart.
 * Represents an AI-grouped or rule-grouped theme of citizen conditions.
 */
export interface ConditionClusterDTO {
  id: string
  label: string                  // e.g. "Commercial Loading Windows (7–9 AM)"
  icon: string                   // Lucide/SVG icon identifier e.g. "bus", "pin", "check"
  category?: string              // Feature or topic reference
  count: number                  // Total conditions in this cluster
  percentage?: number            // Computed share of all conditions
  is_ungrouped?: boolean         // True for minority/unmatched conditions (prevents loss)
  items: ConditionItemDTO[]      // Verbatim evidence list (for drill-down expansion)
}

// ============================================================================
// 4. Proposal-Specific Elements (Array of Row Maps)
// ============================================================================

/**
 * Row map for a proposal-specific design element.
 * E.g., 'Commercial Delivery Hours', 'Weekend Pedestrianization', etc.
 */
export interface ProposalSpecificElementDTO {
  id: string                     // e.g. 'loading_hours', 'pedestrian_schedule'
  title: string                  // e.g. 'Commercial Loading Windows'
  prompt: string                 // e.g. 'Restricting delivery access to 7–10 AM on weekdays'
  category?: string
  distribution: Record<ElementRatingKey, number> // Map for each row's rating counts
  total_responses: number
}

// ============================================================================
// 5. Overall Proposal Community Aggregate DTO (Part 1 Display)
// ============================================================================

/**
 * Complete community aggregate DTO for a proposal.
 * Powers the charts, distribution bars, and condition clusters in the Community tab.
 */
export interface ProposalCommunityAggregateDTO {
  total_participants: number
  total_conditions: number
  last_updated: string

  /**
   * Distribution of overall stances.
   * Map format ensures O(1) lookup & safety against duplicates.
   */
  position_distribution: Record<PositionStance, number>

  /**
   * Breakdown by personal stakeholder connection to the project area.
   */
  stakeholder_distribution: Record<StakeholderRole, number>

  /**
   * Array of proposal-specific element rows, each with its own distribution map.
   */
  proposal_specific: ProposalSpecificElementDTO[]

  /**
   * Free-form condition section: bar chart clusters with inspectable underlying quotes.
   */
  condition_clusters: ConditionClusterDTO[]
}

// ============================================================================
// 6. Citizen Feedback Submission DTO (Part 2 Feedback Input)
// ============================================================================

/**
 * Citizen submission payload sent when a participant submits their position & conditions.
 */
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
  condition?: {
    feature_id?: string
    requirement: string
    is_conditional_support: boolean
    time_window?: string
    location_label?: string
  }
  concern_coordinates?: [number, number]
  submitted_at: string
}

// ============================================================================
// 7. Business Logic & Aggregation Rules
// ============================================================================

/**
 * Safely computes the percentage of a count relative to a total.
 */
export function getPercentage(count: number, total: number): number {
  if (!total || total <= 0) return 0
  return Math.round((count / total) * 100)
}

/**
 * Returns formatted percentage string (e.g. "45%").
 */
export function formatPercentage(count: number, total: number): string {
  return `${getPercentage(count, total)}%`
}

/**
 * Immutably updates an existing Community Aggregate DTO with a new citizen submission.
 * This enables instant live updates to all charts and clusters without page reloads.
 */
export function applyFeedbackToAggregate(
  aggregate: ProposalCommunityAggregateDTO,
  submission: ProposalFeedbackSubmissionDTO
): ProposalCommunityAggregateDTO {
  // 1. Clone deep structure
  const next: ProposalCommunityAggregateDTO = {
    ...aggregate,
    total_participants: aggregate.total_participants + 1,
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

  // 2. Increment position stance count
  if (submission.position in next.position_distribution) {
    next.position_distribution[submission.position] =
      (next.position_distribution[submission.position] || 0) + 1
  }

  // 3. Increment stakeholder connection count
  if (submission.stakeholder_role in next.stakeholder_distribution) {
    next.stakeholder_distribution[submission.stakeholder_role] =
      (next.stakeholder_distribution[submission.stakeholder_role] || 0) + 1
  }

  // 4. Update proposal-specific element distribution rows
  for (const row of next.proposal_specific) {
    const userRating = submission.element_ratings[row.id]
    if (userRating && userRating in row.distribution) {
      row.distribution[userRating] = (row.distribution[userRating] || 0) + 1
      row.total_responses += 1
    }
  }

  // 5. If user supplied an explicit condition or comment, add to condition clusters
  if (submission.condition || submission.comment.trim()) {
    next.total_conditions += 1

    const newConditionItem: ConditionItemDTO = {
      id: `cond-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      participant_id: submission.participant_id,
      verbatim_quote: submission.comment.trim(),
      extracted_requirement:
        submission.condition?.requirement || submission.comment.trim(),
      is_conditional_support:
        submission.condition?.is_conditional_support ??
        (submission.position === 'support' || submission.position === 'strongly_support'),
      time_window: submission.condition?.time_window,
      location_label: submission.condition?.location_label,
      concern_coordinates: submission.concern_coordinates,
      submitted_at: submission.submitted_at,
    }

    // Try matching to a cluster by feature_id or keyword, else add to ungrouped cluster
    let targetCluster = next.condition_clusters.find(
      c => submission.condition?.feature_id && c.id.includes(submission.condition.feature_id)
    )

    if (!targetCluster) {
      // Default to ungrouped cluster or first cluster
      targetCluster =
        next.condition_clusters.find(c => c.is_ungrouped) ||
        next.condition_clusters[next.condition_clusters.length - 1]
    }

    if (targetCluster) {
      targetCluster.count += 1
      targetCluster.items.unshift(newConditionItem)
    }
  }

  return next
}

/**
 * Creates an empty aggregate DTO template for a new proposal.
 */
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
