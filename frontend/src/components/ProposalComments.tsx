import { useEffect, useId, useMemo, useState } from 'react'
import { fetchProposalFeedback, voteOnComment } from '../api/proposalsApi'
import { STAKEHOLDER_CONFIG } from '../data/proposalFeedbackDTO'
import type { ProposalFeedbackSubmissionDTO } from '../data/proposalFeedbackDTO'
import type { AuthUser } from '../data/auth'
import { Icon } from './Icon'

type SortMode = 'new' | 'top'

function scoreOf(comment: ProposalFeedbackSubmissionDTO): number {
  return comment.score ?? ((comment.upvotes ?? 0) - (comment.downvotes ?? 0))
}

export function ProposalComments({ proposalId, refreshKey, layout = 'list', currentUser = null }: {
  proposalId: string
  refreshKey?: string
  layout?: 'list' | 'grid'
  currentUser?: AuthUser | null
}) {
  const headingId = useId()
  const sortId = useId()
  const Heading = layout === 'grid' ? 'h3' : 'h2'
  const AuthorHeading = layout === 'grid' ? 'h4' : 'h3'
  const [result, setResult] = useState<{
    proposalId: string
    state: 'loading' | 'ready' | 'error'
    comments: ProposalFeedbackSubmissionDTO[]
  }>({ proposalId, state: 'loading', comments: [] })
  const [attempt, setAttempt] = useState(0)
  const [sort, setSort] = useState<SortMode>('top')
  const [pendingVote, setPendingVote] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setResult({ proposalId, state: 'loading', comments: [] })
    fetchProposalFeedback(proposalId, controller.signal)
      .then(feedback => {
        if (controller.signal.aborted) return
        const comments = feedback.filter(row => row.comment.trim())
        setResult({ proposalId, state: 'ready', comments })
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ proposalId, state: 'error', comments: [] })
      })
    return () => controller.abort()
  }, [proposalId, refreshKey, attempt])

  const current = result.proposalId === proposalId ? result : null

  const sortedComments = useMemo(() => {
    const rows = current?.comments ? [...current.comments] : []
    const byNewest = (a: ProposalFeedbackSubmissionDTO, b: ProposalFeedbackSubmissionDTO) =>
      (b.submitted_at || '').localeCompare(a.submitted_at || '')
    return rows.sort((a, b) => sort === 'top'
      ? (scoreOf(b) - scoreOf(a)) || byNewest(a, b)
      : byNewest(a, b))
  }, [current?.comments, sort])

  async function castVote(comment: ProposalFeedbackSubmissionDTO, direction: 1 | -1) {
    if (!currentUser || pendingVote) return
    const owner = comment.participant_id
    const previous = comment.my_vote ?? 0
    // Clicking the active arrow clears the vote; otherwise it replaces it.
    const next = previous === direction ? 0 : direction
    setPendingVote(owner)
    // Optimistic update so the count reacts immediately.
    setResult(state => ({
      ...state,
      comments: state.comments.map(row => row.participant_id === owner
        ? applyVote(row, previous, next) : row),
    }))
    try {
      const updated = await voteOnComment(proposalId, owner, next)
      setResult(state => ({
        ...state,
        comments: state.comments.map(row => row.participant_id === owner
          ? { ...row, upvotes: updated.upvotes, downvotes: updated.downvotes, score: updated.score, my_vote: updated.my_vote }
          : row),
      }))
    } catch {
      // Revert to the pre-click tallies on failure.
      setResult(state => ({
        ...state,
        comments: state.comments.map(row => row.participant_id === owner
          ? applyVote(row, next, previous) : row),
      }))
    } finally {
      setPendingVote(null)
    }
  }

  return (
    <section className={`overview-card overview-comments${layout === 'grid' ? ' community-comments' : ''}`} aria-labelledby={headingId}>
      <div className="overview-card-heading">
        <Heading id={headingId}>Comments</Heading>
        <div className="overview-comments-tools">
          {current?.state === 'ready' && <span>{current.comments.length}</span>}
          {current?.state === 'ready' && current.comments.length > 1 && (
            <label className="overview-comments-sort" htmlFor={sortId}>
              <span>Sort by:</span>
              <select id={sortId} value={sort} onChange={event => setSort(event.target.value as SortMode)}>
                <option value="top">Most liked</option>
                <option value="new">Newest</option>
              </select>
            </label>
          )}
        </div>
      </div>
      {!current || current.state === 'loading' ? <p role="status">Loading comments…</p>
        : current.state === 'error' ? <div role="alert">
          <p>Comments couldn’t load.</p>
          <button className="text-button" onClick={() => setAttempt(value => value + 1)}>Try again</button>
        </div>
        : !current.comments.length ? <p className="overview-caption">No comments yet.</p>
        : <>
          <div className="overview-comments-list" role="region" aria-label="Comments" tabIndex={0}>
            {sortedComments.map(comment => {
              const author = STAKEHOLDER_CONFIG[comment.stakeholder_role].label
              const requirement = comment.condition?.requirement.trim()
              const myVote = comment.my_vote ?? 0
              const isOwn = currentUser?.username === comment.participant_id
              const canVote = !!currentUser && !isOwn
              const voteTitle = !currentUser ? 'Log in to vote' : isOwn ? 'You can’t vote on your own comment' : undefined
              const busy = pendingVote === comment.participant_id
              return <article className="overview-comment" key={comment.participant_id}>
                <div className="overview-comment-head">
                  <div className="overview-comment-author"><span aria-hidden="true">{author.charAt(0)}</span><AuthorHeading>{author}</AuthorHeading></div>
                  <div className="overview-comment-votes" title={voteTitle}>
                    <button type="button" className={`overview-vote-button${myVote === 1 ? ' is-active' : ''}`}
                      disabled={!canVote || busy} aria-pressed={myVote === 1} aria-label="Upvote comment"
                      onClick={() => castVote(comment, 1)}><Icon name="chevron-up" /></button>
                    <span className="overview-vote-score" aria-label={`Score ${scoreOf(comment)}`}>{scoreOf(comment)}</span>
                    <button type="button" className={`overview-vote-button${myVote === -1 ? ' is-active down' : ''}`}
                      disabled={!canVote || busy} aria-pressed={myVote === -1} aria-label="Downvote comment"
                      onClick={() => castVote(comment, -1)}><Icon name="chevron-down" /></button>
                  </div>
                </div>
                <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{comment.comment}</p>
                {requirement && <div className="overview-comment-requirement">
                  <span className="overview-requirement-tag">Requirement</span>
                  <p>{requirement}</p>
                  {(comment.condition?.location_label || comment.condition?.time_window) && <span className="overview-comment-requirement-context">
                    {[comment.condition?.location_label, comment.condition?.time_window].filter(Boolean).join(' · ')}
                  </span>}
                </div>}
              </article>
            })}
          </div>
          {layout === 'list' && <p className="overview-caption">Scroll to read more</p>}
        </>}
    </section>
  )
}

/** Adjust a comment's tallies when a viewer's vote moves from `from` to `to`. */
function applyVote(
  comment: ProposalFeedbackSubmissionDTO,
  from: number,
  to: number,
): ProposalFeedbackSubmissionDTO {
  let up = comment.upvotes ?? 0
  let down = comment.downvotes ?? 0
  if (from === 1) up -= 1
  else if (from === -1) down -= 1
  if (to === 1) up += 1
  else if (to === -1) down += 1
  return { ...comment, upvotes: up, downvotes: down, score: up - down, my_vote: to }
}
