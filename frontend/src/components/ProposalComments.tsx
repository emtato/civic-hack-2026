import { useEffect, useId, useState } from 'react'
import { fetchProposalFeedback } from '../api/proposalsApi'
import { STAKEHOLDER_CONFIG } from '../data/proposalFeedbackDTO'
import type { ProposalFeedbackSubmissionDTO } from '../data/proposalFeedbackDTO'

export function ProposalComments({ proposalId, refreshKey, layout = 'list' }: {
  proposalId: string
  refreshKey?: string
  layout?: 'list' | 'grid'
}) {
  const headingId = useId()
  const Heading = layout === 'grid' ? 'h3' : 'h2'
  const AuthorHeading = layout === 'grid' ? 'h4' : 'h3'
  const [result, setResult] = useState<{
    proposalId: string
    state: 'loading' | 'ready' | 'error'
    comments: ProposalFeedbackSubmissionDTO[]
  }>({ proposalId, state: 'loading', comments: [] })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setResult({ proposalId, state: 'loading', comments: [] })
    fetchProposalFeedback(proposalId, controller.signal)
      .then(feedback => {
        if (controller.signal.aborted) return
        const comments = feedback.filter(row => row.comment.trim())
          .sort((a, b) => (b.submitted_at || '').localeCompare(a.submitted_at || ''))
        setResult({ proposalId, state: 'ready', comments })
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ proposalId, state: 'error', comments: [] })
      })
    return () => controller.abort()
  }, [proposalId, refreshKey, attempt])

  const current = result.proposalId === proposalId ? result : null
  return (
    <section className={`overview-card overview-comments${layout === 'grid' ? ' community-comments' : ''}`} aria-labelledby={headingId}>
      <div className="overview-card-heading">
        <Heading id={headingId}>Comments</Heading>
        {current?.state === 'ready' && <span>{current.comments.length}</span>}
      </div>
      {!current || current.state === 'loading' ? <p role="status">Loading comments…</p>
        : current.state === 'error' ? <div role="alert">
          <p>Comments couldn’t load.</p>
          <button className="text-button" onClick={() => setAttempt(value => value + 1)}>Try again</button>
        </div>
        : !current.comments.length ? <p className="overview-caption">No comments yet.</p>
        : <>
          <div className="overview-comments-list" role="region" aria-label="Comments" tabIndex={0}>
            {current.comments.map(comment => {
              const author = STAKEHOLDER_CONFIG[comment.stakeholder_role].label
              return <article className="overview-comment" key={comment.participant_id}>
                <div className="overview-comment-author"><span aria-hidden="true">{author.charAt(0)}</span><AuthorHeading>{author}</AuthorHeading></div>
                <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{comment.comment}</p>
              </article>
            })}
          </div>
          {layout === 'list' && <p className="overview-caption">Scroll to read more</p>}
        </>}
    </section>
  )
}
