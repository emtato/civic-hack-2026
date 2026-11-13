import { useEffect, useRef, useState } from 'react'
import type { Proposal } from '../data/proposals'
import {
  ORDERED_POSITIONS, ORDERED_STAKEHOLDERS, POSITION_CONFIG, STAKEHOLDER_CONFIG,
  applyFeedbackToAggregate, createEmptyAggregate, formatPercentage,
} from '../data/proposalFeedbackDTO'
import type { ConditionClusterDTO, ProposalFeedbackSubmissionDTO } from '../data/proposalFeedbackDTO'
import { getParticipantId, readDemoFeedback, saveDemoFeedback } from '../data/feedbackSession'
import { fetchParticipantFeedback, fetchProposalAggregate, submitProposalFeedback } from '../api/proposalsApi'
import { FeedbackForm } from './FeedbackForm'
import { Icon } from './Icon'
import './ProposalFeedback.css'

interface Props {
  proposal: Proposal
  isResponding: boolean
  onRespondingChange: (open: boolean) => void
}

export const ELEMENT_POSITIONS = ['oppose', 'neutral', 'support', 'unsure'] as const

export function DistributionChart({ counts, total, elements = false }: {
  counts: Partial<Record<string, number>>
  total: number
  elements?: boolean
}) {
  const keys = elements ? ELEMENT_POSITIONS : ORDERED_POSITIONS
  const sum = keys.reduce((acc, key) => acc + (counts[key] || 0), 0)
  return (
    <div className="feedback-distribution">
      <div className="feedback-stacked-bar" aria-hidden="true">
        {sum ? keys.map(key => (
          <span key={key} style={{ width: `${((counts[key] || 0) / sum) * 100}%`, background: POSITION_CONFIG[key].color }}
            title={`${POSITION_CONFIG[key].label}: ${counts[key] || 0}`} />
        )) : <span className="feedback-no-responses">No responses yet</span>}
      </div>
      <dl className={`feedback-distribution-key ${elements ? 'element-key' : ''}`}>
        {keys.map(key => (
          <div key={key}>
            <dt><i style={{ background: POSITION_CONFIG[key].color }} />{POSITION_CONFIG[key].shortLabel}</dt>
            <dd><strong>{counts[key] || 0}</strong><span>{formatPercentage(counts[key] || 0, total)}</span></dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function ConditionGroup({ cluster, total }: { cluster: ConditionClusterDTO; total: number }) {
  return (
    <details className={`feedback-condition-group ${cluster.is_ungrouped ? 'is-ungrouped' : ''}`}>
      <summary>
        <span className="feedback-cluster-icon"><Icon name={cluster.icon} /></span>
        <span className="feedback-cluster-main">
          <span className="feedback-cluster-title">{cluster.label}</span>
          <span className="feedback-cluster-track" aria-hidden="true"><i style={{ width: formatPercentage(cluster.count, total) }} /></span>
          <span className="feedback-cluster-meta">{cluster.count} {cluster.count === 1 ? 'condition' : 'conditions'} · {formatPercentage(cluster.count, total)} of conditions</span>
        </span>
        <Icon name="back" className="feedback-disclosure" />
      </summary>
      <div className="feedback-evidence">
        <p className="feedback-help">{cluster.items.length < cluster.count
          ? `Showing ${cluster.items.length} supplied ${cluster.items.length === 1 ? 'example' : 'examples'} of ${cluster.count} conditions in this group.`
          : 'Original comments and the requirements recorded alongside them.'}</p>
        {!cluster.items.length && <p className="feedback-help">No individual examples are supplied for this group.</p>}
        {cluster.items.map(item => (
          <article className="feedback-quote" key={item.id}>
            <span className={`feedback-requirement-tag ${item.is_conditional_support ? 'conditional' : ''}`}>
              {item.is_conditional_support ? 'Explicit support condition' : 'Requirement / concern'}
            </span>
            {item.verbatim_quote && <blockquote>“{item.verbatim_quote}”</blockquote>}
            <div className="feedback-recorded-requirement"><strong>Recorded requirement</strong><p>{item.extracted_requirement}</p></div>
            {(item.location_label || item.time_window) && <div className="feedback-quote-context">
              {item.location_label && <span><Icon name="pin" />{item.location_label}</span>}
              {item.time_window && <span><Icon name="clock" />{item.time_window}</span>}
            </div>}
          </article>
        ))}
      </div>
    </details>
  )
}

export function ProposalFeedback({ proposal, isResponding, onRespondingChange }: Props) {
  const [aggregate, setAggregate] = useState(() => proposal.community_aggregate || createEmptyAggregate())
  const [mode, setMode] = useState<'loading' | 'server' | 'demo'>('loading')
  const [response, setResponse] = useState<ProposalFeedbackSubmissionDTO | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const savingRef = useRef(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    let active = true
    setMode('loading')
    Promise.all([fetchProposalAggregate(proposal.id), fetchParticipantFeedback(proposal.id, getParticipantId())])
      .then(([live, existing]) => {
        if (!active) return
        setAggregate(live || proposal.community_aggregate || createEmptyAggregate())
        setResponse(existing)
        setMode('server')
      })
      .catch(() => {
        if (!active) return
        const local = readDemoFeedback(proposal.id)
        const sample = proposal.community_aggregate || createEmptyAggregate()
        setAggregate(local ? applyFeedbackToAggregate(sample, local) : sample)
        setResponse(local)
        setMode('demo')
      })
    return () => { active = false }
  }, [proposal.id, loadAttempt])

  async function save(submission: ProposalFeedbackSubmissionDTO) {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setError('')
    try {
      if (mode === 'demo') {
        const persisted = saveDemoFeedback(submission)
        setAggregate(current => applyFeedbackToAggregate(current, submission, response))
        setResponse(submission)
        setReceipt(persisted ? 'Demo response saved on this device. You can return and edit it.' : 'Demo response saved for this visit. Browser storage is unavailable; it will not survive a refresh.')
      } else {
        const result = await submitProposalFeedback(submission)
        if (!mountedRef.current) return
        setAggregate(result.community_aggregate)
        setResponse(result.feedback)
        setReceipt('Your response was saved to the prototype. You can return and edit it.')
      }
      onRespondingChange(false)
      requestAnimationFrame(() => headingRef.current?.focus())
    } catch {
      if (mountedRef.current) setError('Your response could not be saved. Your answers are still here. Check the connection and try again.')
    } finally {
      savingRef.current = false
      if (mountedRef.current) setSaving(false)
    }
  }

  const date = new Date(aggregate.last_updated)
  return (
    <section className="proposal-feedback" aria-label="Proposal feedback">
      <div className="feedback-demo-notice">
        <Icon name="info" />
        <div><strong>{mode === 'loading' ? 'Connecting to community feedback…' : mode === 'demo' ? 'Demo mode · sample community feedback' : 'Prototype community feedback'}</strong>
          <p>{mode === 'demo' ? 'Live feedback is unavailable. Seeded responses are fictional; new demo responses are saved only on this device.' : 'Seeded responses are fictional. This prototype is not an official City consultation.'}</p>
          {mode === 'demo' && !isResponding && <button className="feedback-inline-button" onClick={() => { setReceipt(''); setLoadAttempt(n => n + 1) }}>Retry connection</button>}
        </div>
      </div>

      {receipt && <div className="feedback-receipt" role="status"><Icon name="check" /><p>{receipt}</p></div>}

      <div hidden={!isResponding}>
        {mode === 'loading' ? <p className="feedback-help" role="status">Loading your saved response before opening the form…</p> : (
          <FeedbackForm key={`${proposal.id}-${mode}`} proposal={proposal} elements={aggregate.proposal_specific}
            existing={response} demo={mode === 'demo'} saving={saving} error={error} active={isResponding}
            onSave={save} onCancel={() => { setError(''); onRespondingChange(false) }} />
        )}
      </div>

      <div hidden={isResponding}>
        <div className="feedback-section-heading feedback-community-heading">
          <div><span className="eyebrow">THE COMMUNITY PICTURE</span><h2 ref={headingRef} tabIndex={-1}>Different perspectives. Shared place.</h2></div>
          <span className="feedback-live-label"><i />{mode === 'demo' ? 'SAMPLE + DEVICE RESPONSES' : mode === 'loading' ? 'LOADING' : 'PROTOTYPE RESPONSES'}</span>
        </div>
        <p className="feedback-intro">See where people stand, what matters to them, and what would make this proposal work.</p>

        <div className="feedback-stat-row">
          <div><strong>{aggregate.total_participants}</strong><span>participants</span></div>
          <div><strong>{aggregate.total_conditions}</strong><span>recorded conditions</span></div>
          <div className="feedback-stat-updated"><Icon name="clock" /><span>Updated<br />{Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}</span></div>
        </div>

        <div className="feedback-invitation">
          <span className="feedback-invitation-icon"><Icon name="message" /></span>
          <div><h3>{response ? 'Your perspective is part of this.' : 'What would make it work for you?'}</h3><p>{response ? `${POSITION_CONFIG[response.position].label} · Your response can change as your needs do.` : 'Share your position, the details that matter, and any requirements.'}</p></div>
          <button className="feedback-action" disabled={mode === 'loading'} onClick={() => { setReceipt(''); setError(''); onRespondingChange(true) }}>
            {response ? 'Edit your response' : 'Share your perspective'}<Icon name="arrow" />
          </button>
        </div>

        <section className="feedback-card" aria-labelledby="position-heading">
          <div className="feedback-section-heading"><h3 id="position-heading">Overall position</h3><span>{aggregate.total_participants} responses</span></div>
          <p className="feedback-help">Every position is shown, including people who need more information.</p>
          <DistributionChart counts={aggregate.position_distribution} total={aggregate.total_participants} />
        </section>

        <section className="feedback-card" aria-labelledby="connection-heading">
          <div className="feedback-section-heading"><h3 id="connection-heading">Connection to this place</h3><span>Self-reported</span></div>
          <p className="feedback-help">One primary connection per participant.</p>
          <div className="feedback-stakeholders">
            {ORDERED_STAKEHOLDERS.map(key => {
              const config = STAKEHOLDER_CONFIG[key]
              const count = aggregate.stakeholder_distribution[key] || 0
              return <div className="feedback-stakeholder" key={key}>
                <Icon name={config.icon} /><span>{config.label}</span>
                <span className="feedback-role-track" aria-hidden="true"><i style={{ width: formatPercentage(count, aggregate.total_participants), background: config.color }} /></span>
                <strong>{count}</strong><span className="feedback-role-percentage">{formatPercentage(count, aggregate.total_participants)}</span>
              </div>
            })}
          </div>
        </section>

        <section className="feedback-card" aria-labelledby="elements-heading">
          <div className="feedback-section-heading"><h3 id="elements-heading">The details matter</h3><span>Proposal-specific elements</span></div>
          <p className="feedback-help">People can support the whole proposal and feel differently about individual changes. Each element has its own response count.</p>
          {!aggregate.proposal_specific.length && <p className="feedback-empty">No element questions have been added to this proposal yet.</p>}
          {aggregate.proposal_specific.map(element => <article className="feedback-element" key={element.id}>
            <div className="feedback-section-heading"><h4>{element.title}</h4><span>{element.total_responses} responses</span></div>
            <p className="feedback-help">{element.prompt}</p>
            <DistributionChart counts={element.distribution} total={element.total_responses} elements />
          </article>)}
        </section>

        <section className="feedback-card feedback-conditions" aria-labelledby="conditions-heading">
          <div className="feedback-section-heading"><h3 id="conditions-heading">What would make a difference</h3><span>{aggregate.total_conditions} conditions</span></div>
          <p className="feedback-help">Explore grouped requirements and their original comments. A condition is a specific need; it only means conditional support when the participant explicitly says so.</p>
          {aggregate.condition_clusters.length ? aggregate.condition_clusters.map(cluster => <ConditionGroup key={cluster.id} cluster={cluster} total={aggregate.total_conditions} />)
            : <p className="feedback-empty">No conditions recorded yet. Individual and less common needs will stay visible here.</p>}
          <p className="feedback-help feedback-count-note">Percentages use recorded conditions, not participants. Groups may include the same person. Results describe participants, not a representative vote of the neighbourhood.</p>
        </section>
      </div>
    </section>
  )
}
