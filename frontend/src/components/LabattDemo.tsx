import { useEffect, useRef, useState } from 'react'
import { DemoSessionConflict, fetchLabattDemo, previewLabattDemoRequests, resetLabattDemo, saveLabattDemo } from '../api/labattDemoApi'
import { demoVersionLabel } from '../data/labattDemo'
import type { DemoChange, DemoJourney, DemoRound } from '../data/labattDemo'
import { POSITION_CONFIG } from '../data/proposalFeedbackDTO'
import type { ProposalFeedbackSubmissionDTO } from '../data/proposalFeedbackDTO'
import type { Proposal } from '../data/proposals'
import { FeedbackForm } from './FeedbackForm'
import { Icon } from './Icon'
import { ProposalComments } from './ProposalComments'
import { ConditionGroup, DistributionChart } from './ProposalFeedback'
import { FieldComparison } from './ProposalUpdates'
import './LabattDemo.css'

export type DetailTab = 'overview' | 'feedback' | 'updates'
type ReviewMode = 'previous' | 'keep' | 'change' | 'edit'

export function useLabattDemo(active: boolean) {
  const [journey, setJourney] = useState<DemoJourney | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!active) {
      setJourney(null)
      setLoadError(false)
      return
    }
    const controller = new AbortController()
    setLoadError(false)
    fetchLabattDemo(controller.signal).then(result => {
      if (!controller.signal.aborted) setJourney(result)
    }).catch(() => {
      if (!controller.signal.aborted) setLoadError(true)
    })
    return () => controller.abort()
  }, [active, attempt])
  return { journey, setJourney, loadError, retry: () => setAttempt(value => value + 1) }
}

function ChangeNotes({ version, journey }: { version: DemoRound; journey: DemoJourney }) {
  const assessment = journey.requirement_assessment
  return <>
    <h3>Changes since your response</h3>
    <ul className="labatt-change-notes">
      {version.changes.map(change => <li key={change.feature_id}>
        <strong>{change.title}</strong>
        <p>{change.summary}</p>
        {assessment?.feature_id === change.feature_id && <>
          <span className="labatt-assessment">Related to your requirement</span>
          {assessment.passage && <blockquote>“{assessment.passage}”</blockquote>}
        </>}
      </li>)}
    </ul>
    {assessment && <p className="labatt-assessment-result"><strong>Requirement {assessment.status}.</strong> {assessment.explanation}</p>}
  </>
}

function FeedbackImpact({ change, earlier, current }: { change: DemoChange; earlier: DemoRound; current: DemoRound }) {
  const evidence = earlier.aggregate.condition_clusters.flatMap(group => group.items).filter(item =>
    earlier.requirement_assessments[item.id]?.feature_id === change.feature_id)
  const comment = (participantId?: string) => current.comments.find(row => row.participant_id === participantId)
  const example = evidence.find(item => earlier.requirement_assessments[item.id].status === 'potentially addressed'
    && comment(item.participant_id)) ?? evidence.find(item => comment(item.participant_id)) ?? evidence[0]
  if (!example) return null
  const assessment = earlier.requirement_assessments[example.id]
  const laterComment = comment(example.participant_id)
  const beforeRating = earlier.aggregate.proposal_specific.find(element => element.id === change.feature_id)
  const afterRating = current.aggregate.proposal_specific.find(element => element.id === change.feature_id)

  return <div className="labatt-impact">
    <span className="labatt-assessment">{assessment.status}</span>
    <div className="labatt-impact-evidence">
      <div>
        <h4>Earlier request</h4>
        <p>{example.extracted_requirement}</p>
        {example.verbatim_quote && <blockquote>“{example.verbatim_quote}”</blockquote>}
      </div>
      <div>
        <h4>How the revision responds</h4>
        <p>{assessment.explanation}</p>
        {laterComment && <><h4>Same participant in the current round</h4><blockquote>“{laterComment.comment}”</blockquote></>}
      </div>
    </div>
    {beforeRating && afterRating && <p className="feedback-help">
      Support for this feature among all its raters went from {beforeRating.distribution.support ?? 0} of {beforeRating.total_responses} to {afterRating.distribution.support ?? 0} of {afterRating.total_responses}.
    </p>}
  </div>
}

function DemoComparison({ version, journey, source }: { version: DemoRound; journey: DemoJourney; source: string }) {
  const earlier = journey.versions.find(round => round.id !== journey.current_version_id)!
  const current = journey.versions.find(round => round.id === journey.current_version_id)!
  return <section className="proposal-updates" aria-labelledby="demo-updates-heading">
    <div className="updates-heading">
      <h2 id="demo-updates-heading">From feedback to amendment</h2>
      <p>{version.id === current.id ? 'See the earlier requests, the revised wording, and how the same participants responded.' : 'These requests came from the first feedback round. See how the next proposal responded to them.'}</p>
      {source && <div className="updates-source-links"><a href={source} target="_blank" rel="noopener noreferrer">Official notice for reference ↗</a></div>}
    </div>
    <div className="updates-version-headings updates-pair">
      <div><h3>{demoVersionLabel(earlier)}</h3></div>
      <div><h3>{demoVersionLabel(current)}</h3></div>
    </div>
    {current.changes.map(change => <section key={change.feature_id} className="labatt-comparison-item">
      <FieldComparison label={change.title} field={{
        path: '/' + change.feature_id, operation: change.before === change.after ? 'unchanged' : 'changed',
        before: change.before, after: change.after,
      }} />
      <FeedbackImpact change={change} earlier={earlier} current={current} />
    </section>)}
    <section className="feedback-card">
      <h3>Overall positions of the {journey.matched_positions.participants} people who responded to both versions</h3>
      <div className="labatt-matched-positions">
        <div><h4>{demoVersionLabel(earlier)}</h4>
          <DistributionChart counts={journey.matched_positions.earlier} total={journey.matched_positions.participants} />
        </div>
        <div><h4>{demoVersionLabel(current)}</h4>
          <DistributionChart counts={journey.matched_positions.current} total={journey.matched_positions.participants} />
        </div>
      </div>
    </section>
  </section>
}

function DemoCommunity({ proposal, version, journey, current }: {
  proposal: Proposal; version: DemoRound; journey: DemoJourney; current: boolean
}) {
  const { aggregate } = version
  const { review_totals: review } = journey
  return <>
    <div className="feedback-section-heading"><h2>Community responses</h2><span>{demoVersionLabel(version)}</span></div>
    <div className="feedback-stat-row labatt-totals">
      <div><strong>{aggregate.total_participants}</strong><span>Responses in this version</span></div>
      {current && <>
        <div><strong>{review.unreviewed}</strong><span>Earlier participants awaiting review</span></div>
        <div><strong>{review.reconfirmed}</strong><span>Reconfirmed</span></div>
        <div><strong>{review.revised}</strong><span>Revised</span></div>
      </>}
    </div>
    {current && <p className="feedback-help">{journey.distinct_participants} people across both versions · {journey.current_only} responded only to Current</p>}
    <section className="feedback-card">
      <h3>Overall position</h3>
      <DistributionChart counts={aggregate.position_distribution} total={aggregate.total_participants} />
    </section>
    <section className="feedback-card" aria-label="Proposal-specific ratings">
      {!aggregate.proposal_specific.length && <p className="feedback-empty">No feature questions in this round.</p>}
      {aggregate.proposal_specific.map(element => <article className="feedback-element" key={element.id}>
        <div className="feedback-section-heading"><h4>{element.title}</h4><span>{element.total_responses} responses</span></div>
        <p className="feedback-help">{element.prompt}</p>
        <DistributionChart counts={element.distribution} total={element.total_responses} elements />
      </article>)}
    </section>
    <section className="feedback-card feedback-conditions">
      <div className="feedback-section-heading"><h3>What would make a difference</h3><span>{aggregate.total_conditions} requests</span></div>
      {journey.grouping_origin === 'prepared' && <p className="feedback-help">Request groups were prepared from the responses in this round.</p>}
      {aggregate.total_conditions
        ? aggregate.condition_clusters.filter(group => group.count).map(group =>
          <ConditionGroup key={group.id} cluster={group} total={aggregate.total_conditions} reviewed
            renderAssessment={item => {
              const assessment = version.requirement_assessments[item.id]
              if (!assessment) return null
              const revised = journey.versions.find(round => round.id === assessment.version_id)
              const change = revised?.changes.find(note => note.feature_id === assessment.feature_id)
              return <div className="labatt-assessment-result">
                <strong>{revised?.label} assessment · {assessment.status}</strong>
                {change && <p>{change.title}</p>}
                {assessment.passage && <blockquote>“{assessment.passage}”</blockquote>}
                <p>{assessment.explanation}</p>
              </div>
            }} />)
        : <p className="feedback-empty">No specific requests in this round.</p>}
    </section>
    <ProposalComments proposalId={proposal.id} layout="grid" storedComments={version.comments} />
  </>
}

export function LabattDemoContent({ proposal, journey, version, detailTab, onTab, onJourney, onBusy }: {
  proposal: Proposal
  journey: DemoJourney
  version: DemoRound
  detailTab: DetailTab
  onTab: (tab: DetailTab) => void
  onJourney: (journey: DemoJourney) => void
  onBusy: (busy: boolean) => void
}) {
  const [reviewMode, setReviewMode] = useState<ReviewMode | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState('')
  const inFlight = useRef(false)
  const mounted = useRef(false)
  const reviewHeading = useRef<HTMLHeadingElement>(null)
  const actions = useRef<HTMLDivElement>(null)
  const current = version.id === journey.current_version_id
  const previous = journey.previous_response
  const earlier = journey.versions.find(round => round.id === previous.version_id)!
  const tab = detailTab

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (tab === 'feedback' && reviewMode === 'previous') reviewHeading.current?.focus()
  }, [tab, reviewMode])

  function startReview() {
    setError('')
    setReceipt('')
    setReviewMode(journey.current_response ? 'edit' : 'previous')
    onTab('feedback')
  }

  async function mutate(submission?: ProposalFeedbackSubmissionDTO) {
    if (inFlight.current || !current) return
    inFlight.current = true
    setBusy(true)
    onBusy(true)
    setError('')
    setReceipt('')
    try {
      const updated = submission
        ? await saveLabattDemo(journey.revision, submission)
        : await resetLabattDemo(journey.revision)
      if (!mounted.current) return
      onJourney(updated)
      setReviewMode(null)
      setReceipt(submission ? 'Your response was saved for the current version.' : 'Your demo has been reset.')
      requestAnimationFrame(() => actions.current?.focus())
    } catch (reason) {
      let message = submission ? 'Your response couldn’t be saved. Your answers are still here. Try again.' : 'Your demo couldn’t reset. Try again.'
      if (reason instanceof DemoSessionConflict) {
        const latest = await fetchLabattDemo().catch(() => null)
        if (!mounted.current) return
        if (latest) {
          onJourney(latest)
          message = submission
            ? 'This session changed. Your draft is still here. Confirm again to save it.'
            : 'This session changed. Try Reset my demo again.'
        }
      }
      if (mounted.current) setError(message)
    } finally {
      inFlight.current = false
      if (mounted.current) { setBusy(false); onBusy(false) }
    }
  }

  const reviewingForm = reviewMode && reviewMode !== 'previous'
  const residentActions = current && <div className="labatt-actions" ref={actions} tabIndex={-1}>
    <button className="feedback-action" type="button" disabled={busy} onClick={startReview}
      data-tooltip={journey.current_response ? 'Change the response you saved for the current demo version. Saving replaces that response.' : 'Step into the role of a returning resident: compare a sample earlier response with the revised proposal, then keep or change it.'}>
      {journey.current_response ? 'Edit your current response' : 'Try the resident review'} <Icon name="arrow" />
    </button>
    <button className="feedback-inline-button" type="button" disabled={busy} onClick={() => void mutate()}
      data-tooltip="Clear your saved current-version demo response and return to not reviewed. The sample community data and earlier response stay intact. This affects only your demo session.">Reset my demo</button>
  </div>

  return <div className="proposal-feedback labatt-demo">
    {receipt && <div className="feedback-receipt" role="status"><Icon name="check" /><p>{receipt}</p></div>}
    {error && !reviewingForm && <p className="feedback-error" role="alert">{error}</p>}
    {tab === 'overview' && <div className="proposal-overview">
      <div className="overview-main">
        <section className="overview-card overview-brief">
          <h2>Summary</h2><p>{version.summary}</p>
          <ul className="overview-changes">{version.arrangements.map(text =>
            <li key={text}><Icon name="check" /><span>{text}</span></li>
          )}</ul>
        </section>
        <section className="overview-card overview-sentiment">
          <div className="overview-card-heading"><h2>Community sentiment</h2><span>{version.aggregate.total_participants} responses</span></div>
          <DistributionChart counts={version.aggregate.position_distribution} total={version.aggregate.total_participants} />
          <button className="overview-link" data-tooltip="See the positions, ratings, comments, and requests recorded for the selected demo version." onClick={() => onTab('feedback')}>Explore community feedback <Icon name="arrow" /></button>
        </section>
        <section className="overview-card overview-update labatt-overview-impact">
          <h2>How feedback shaped the revision</h2>
          <p>{current
            ? 'Earlier respondents asked for evening pickup, later deliveries, and a safe path around the loading area.'
            : 'See how the next version responds to the requests recorded in this round.'}</p>
          {current && <ul className="overview-changes">{version.changes.map(change =>
            <li key={change.feature_id}><Icon name={change.before === change.after ? 'info' : 'check'} /><span>{change.summary}</span></li>
          )}</ul>}
          <button className="overview-link" data-tooltip="Compare earlier requests with the revised wording and see how the same participants responded." onClick={() => onTab('updates')}>Trace feedback to changes <Icon name="arrow" /></button>
        </section>
      </div>
      <div className="overview-side">
        {current && <section className="overview-card overview-participate">
          <h2>Returning resident</h2>
          <p>{journey.current_response ? 'Your current response is ' + journey.participant_action + '.' : 'Revisit an earlier response after the proposal changes.'}</p>
          {residentActions}
        </section>}
        <ProposalComments proposalId={proposal.id} storedComments={version.comments} />
      </div>
    </div>}

    {tab === 'feedback' && !reviewMode && <>
      {residentActions}
      <DemoCommunity proposal={proposal} version={version} journey={journey} current={current} />
    </>}
    {reviewMode === 'previous' && <section className="feedback-card labatt-review" hidden={tab !== 'feedback'}>
      <button className="back-button" type="button" onClick={() => {
        setReviewMode(null)
        requestAnimationFrame(() => actions.current?.focus())
      }}><Icon name="back" /> Back to community</button>
      <h2 ref={reviewHeading} tabIndex={-1}>This proposal has changed. Review your previous response.</h2>
      <p className="feedback-help">{demoVersionLabel(earlier)} · {journey.participant_action}</p>
      <dl className="labatt-prior-response">
        <div><dt>Overall position</dt><dd>{POSITION_CONFIG[previous.position].label}</dd></div>
        {previous.condition && <div><dt>{previous.condition.is_conditional_support ? 'Support condition' : 'Requirement'}</dt><dd>{previous.condition.requirement}</dd></div>}
        <div><dt>Original comment</dt><dd><blockquote>“{previous.comment}”</blockquote></dd></div>
      </dl>
      <ChangeNotes version={version} journey={journey} />
      <div className="labatt-actions">
        <button className="feedback-action" data-tooltip="Carry your earlier answers into a confirmation screen for the current version. Nothing is saved until you confirm." onClick={() => setReviewMode('keep')}>Keep my response</button>
        <button className="feedback-secondary-button" data-tooltip="Start with your earlier answers and edit your position, ratings, comment, or requirement before confirming for the current version." onClick={() => setReviewMode('change')}>Review and change</button>
      </div>
    </section>}
    {reviewingForm && <div hidden={tab !== 'feedback'}>
      <details className="feedback-card labatt-review" open>
        <summary data-tooltip="Expand or collapse the revision notes and the assessment of your earlier requirement.">Relevant changes since your earlier response</summary>
        <ChangeNotes version={version} journey={journey} />
      </details>
      <FeedbackForm proposal={proposal} elements={version.features}
        existing={reviewMode === 'edit' ? journey.current_response : previous} demo={false}
        previewRequests={previewLabattDemoRequests}
        versionContext={{ id: version.id, participantId: previous.participant_id, confirmPrevious: reviewMode === 'keep' }}
        active={tab === 'feedback'} saving={busy} error={error}
        onSave={mutate} onCancel={() => { setError(''); setReviewMode(reviewMode === 'edit' ? null : 'previous') }} />
    </div>}
    {tab === 'updates' && <DemoComparison version={version} journey={journey} source={proposal.source} />}
  </div>
}
