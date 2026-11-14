/** Detected source changes, separate from reviewed/published proposal revisions. */
export interface ProposalSnapshotChange {
  path: string
  operation: 'added' | 'removed' | 'changed'
  before: unknown
  after: unknown
  text_diff: string | null
}

export interface ProposalSnapshotDiff {
  id: string
  proposal_id: string
  before_snapshot_id: string
  after_snapshot_id: string
  compared_at: string
  changes: ProposalSnapshotChange[]
  classification: 'unclassified'
  review_required: boolean
  is_demo?: boolean
  demo_label?: string | null
}

export interface ProposalUpdateCheck {
  proposal_id: string
  checked_at: string | null
  snapshot_id: string | null
  snapshot_sequence: number
  snapshot_created: boolean
  diffs: ProposalSnapshotDiff[]
  source_status?: 'pending' | 'ready' | 'error'
  source_error?: string | null
}

export interface ProposalUpdateState {
  status: 'checking' | 'ready' | 'error' | 'pending'
  snapshot_id: string | null
  snapshot_sequence: number
  checked_at: string | null
  diffs: ProposalSnapshotDiff[]
  error: string | null
}

export type ProposalUpdates = Record<string, ProposalUpdateState>

export interface ProposalSnapshot {
  id: string
  proposal_id: string
  sequence: number
  captured_at: string
  source_urls: string[]
  content: Record<string, unknown>
  is_demo?: boolean
  demo_label?: string | null
}
