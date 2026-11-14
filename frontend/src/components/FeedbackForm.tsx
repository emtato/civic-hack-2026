import { useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Proposal } from '../data/proposals'
import { ORDERED_STAKEHOLDERS, POSITION_CONFIG, STAKEHOLDER_CONFIG } from '../data/proposalFeedbackDTO'
import type { ConfirmedCommentRequestDTO, ElementRatingKey, PositionStance, ProposalFeedbackSubmissionDTO, ProposalSpecificElementDTO, StakeholderRole } from '../data/proposalFeedbackDTO'
import { previewFeedbackRequests } from '../api/proposalsApi'
import { getParticipantId } from '../data/feedbackSession'
import { Icon } from './Icon'

const OVERALL_RATINGS = ['strongly_oppose', 'oppose', 'neutral', 'support', 'strongly_support'] as const
const ELEMENT_RATINGS = ['oppose', 'neutral', 'support'] as const

function FeedbackSlider<T extends Exclude<PositionStance, 'unsure'>>({ label, options, value, onChange, inputRef }: {
  label: string
  options: readonly T[]
  value: T | 'unsure' | ''
  onChange: (value: T | 'unsure' | '') => void
  inputRef?: React.Ref<HTMLInputElement>
}) {
  const id = useId()
  const previousRating = useRef<T | ''>(value === 'unsure' ? '' : value)
  const unsure = value === 'unsure'
  const rating = unsure ? previousRating.current : value
  const index = rating ? options.indexOf(rating) : Math.floor(options.length / 2)
  const meta = value ? POSITION_CONFIG[value] : null

  return <div className={`feedback-slider ${unsure ? 'is-unsure' : ''} ${!value ? 'is-unanswered' : ''}`} style={{ '--rating-count': options.length, '--rating-color': meta?.color || '#8b967e' } as CSSProperties}>
    <div className="feedback-slider-scale">
      <input id={id} ref={inputRef} className="feedback-range" type="range" min={0} max={options.length - 1} step={1} value={index} disabled={unsure}
      aria-label={label} aria-valuetext={unsure ? POSITION_CONFIG.unsure.label : rating ? POSITION_CONFIG[rating].label : 'Not answered; choose a position'}
      data-tooltip="Choose a position with the slider or the labels below. Neutral means neither support nor oppose; Unsure means you need more information."
      onChange={event => onChange(options[Number(event.target.value)])}
      onPointerUp={event => { if (!event.currentTarget.disabled) onChange(options[Number(event.currentTarget.value)]) }}
      onKeyDown={event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); onChange(options[index]) } }} />
      <div className="feedback-slider-labels" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(option => <button key={option} type="button" disabled={unsure} className={value === option ? 'is-selected' : ''}
        aria-label={`${label}: ${POSITION_CONFIG[option].label}`} aria-pressed={value === option} onClick={() => onChange(option)}>
        <span aria-hidden="true" />{POSITION_CONFIG[option].shortLabel}
      </button>)}
      </div>
    </div>
    <label className="feedback-checkbox feedback-unsure">
      <input type="checkbox" aria-label={`${label}: Unsure`} data-tooltip="Choose this if you need more information to form a view. Unchecking it restores your previous rating." checked={unsure} onChange={event => {
        if (event.target.checked) { previousRating.current = value === 'unsure' ? '' : value; onChange('unsure') }
        else onChange(previousRating.current)
      }} />
      <span>Unsure</span>
    </label>
  </div>
}

function SituationSelect({ value, onChange, invalid, buttonRef }: {
  value: StakeholderRole | ''
  onChange: (value: StakeholderRole) => void
  invalid: boolean
  buttonRef: React.RefObject<HTMLButtonElement | null>
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const selected = value ? STAKEHOLDER_CONFIG[value] : null

  useEffect(() => {
    if (!open) return
    function closeOutside(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open])

  useEffect(() => {
    if (open) document.getElementById(`${id}-${activeIndex}`)?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex, id])

  return <div className="feedback-situation-select" ref={containerRef} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
    <button ref={buttonRef} type="button" role="combobox" className={`feedback-choice feedback-situation-trigger ${value ? 'is-selected' : ''}`}
      data-tooltip="Choose your main connection to this place: resident, local business, commuter, visitor, or interested Toronto resident."
      aria-label="Your situation" aria-required="true" aria-invalid={invalid || undefined} aria-describedby={invalid ? 'feedback-answer-error' : undefined}
      aria-haspopup="listbox" aria-expanded={open} aria-controls={id} aria-activedescendant={open ? `${id}-${activeIndex}` : undefined}
      onClick={() => { setActiveIndex(value ? ORDERED_STAKEHOLDERS.indexOf(value) : 0); setOpen(!open) }}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); setOpen(false) }
        else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault()
          const current = open ? activeIndex : value ? ORDERED_STAKEHOLDERS.indexOf(value) : event.key === 'ArrowUp' ? 0 : -1
          setActiveIndex(event.key === 'Home' ? 0 : event.key === 'End' ? ORDERED_STAKEHOLDERS.length - 1 : (current + (event.key === 'ArrowUp' ? -1 : 1) + ORDERED_STAKEHOLDERS.length) % ORDERED_STAKEHOLDERS.length)
          setOpen(true)
        } else if ((event.key === 'Enter' || event.key === ' ') && open) {
          event.preventDefault(); onChange(ORDERED_STAKEHOLDERS[activeIndex]); setOpen(false)
        } else if (event.key.length === 1 && /\S/.test(event.key)) {
          const match = ORDERED_STAKEHOLDERS.findIndex(key => STAKEHOLDER_CONFIG[key].label.toLowerCase().startsWith(event.key.toLowerCase()))
          if (match >= 0) { event.preventDefault(); setActiveIndex(match); setOpen(true) }
        }
      }}>
      <Icon name={selected?.icon || 'user'} /><span>{selected?.label || 'Select your situation'}</span><Icon name="back" className="feedback-select-chevron" />
    </button>
    {open && <div id={id} role="listbox" aria-label="Your situation" className="feedback-situation-options">
      {ORDERED_STAKEHOLDERS.map((key, index) => <div id={`${id}-${index}`} key={key} role="option" aria-selected={value === key}
        className={`feedback-choice ${value === key ? 'is-selected' : ''} ${activeIndex === index ? 'is-active' : ''}`}
        onPointerMove={() => setActiveIndex(index)} onMouseDown={event => event.preventDefault()}
        onClick={() => { onChange(key); setOpen(false); buttonRef.current?.focus() }}>
        <Icon name={STAKEHOLDER_CONFIG[key].icon} /><span>{STAKEHOLDER_CONFIG[key].label}</span>{value === key && <Icon name="check" />}
      </div>)}
    </div>}
  </div>
}

interface Props {
  proposal: Proposal
  elements: ProposalSpecificElementDTO[]
  existing: ProposalFeedbackSubmissionDTO | null
  demo: boolean
  active: boolean
  saving: boolean
  error: string
  versionContext?: { id: string; participantId: string; confirmPrevious: boolean }
  previewRequests?: (
    draft: Pick<ProposalFeedbackSubmissionDTO, 'comment' | 'condition'>,
    signal: AbortSignal,
  ) => Promise<ConfirmedCommentRequestDTO[]>
  onSave: (submission: ProposalFeedbackSubmissionDTO) => Promise<void>
  onCancel: () => void
}

export function FeedbackForm({ proposal, elements, existing, demo, active, saving, error, versionContext, previewRequests, onSave, onCancel }: Props) {
  const [position, setPosition] = useState<PositionStance | ''>(existing?.position || 'neutral')
  const [role, setRole] = useState<StakeholderRole | ''>(existing?.stakeholder_role || '')
  const [ratings, setRatings] = useState<Record<string, ElementRatingKey>>(existing?.element_ratings || {})
  const [comment, setComment] = useState(existing?.comment || '')
  const [hasCondition, setHasCondition] = useState(!!existing?.condition)
  const [requirement, setRequirement] = useState(existing?.condition?.requirement || '')
  const [feature, setFeature] = useState(existing?.condition?.feature_id || '')
  const [location, setLocation] = useState(existing?.condition?.location_label || '')
  const [time, setTime] = useState(existing?.condition?.time_window || '')
  const [conditional, setConditional] = useState(existing?.condition?.is_conditional_support || false)
  const [confirmed, setConfirmed] = useState(false)
  const [reviewing, setReviewing] = useState(versionContext?.confirmPrevious ?? false)
  const [answerError, setAnswerError] = useState('')
  const [requests, setRequests] = useState<ConfirmedCommentRequestDTO[]>([])
  const [previewStatus, setPreviewStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [previewError, setPreviewError] = useState('')
  const [previewAttempt, setPreviewAttempt] = useState(0)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const positionRef = useRef<HTMLInputElement>(null)
  const situationRef = useRef<HTMLButtonElement>(null)
  const requirementRef = useRef<HTMLTextAreaElement>(null)
  const versioned = !!versionContext

  useEffect(() => {
    if (active) titleRef.current?.focus()
  }, [active, reviewing])

  // A successful save can update the existing response without losing a draft
  // when the user briefly switches to the overview tab.
  useEffect(() => {
    if (!active && !versioned) { setReviewing(false); setConfirmed(false) }
  }, [active, versioned])

  useEffect(() => {
    if (!active || !reviewing) return
    const controller = new AbortController()
    setConfirmed(false)
    setRequests([])
    setPreviewError('')
    if (demo || !comment.trim()) {
      setPreviewStatus('ready')
      return () => controller.abort()
    }
    setPreviewStatus('loading')
    const preview = previewRequests ?? ((draft, signal) => previewFeedbackRequests(proposal.id, draft, signal))
    preview({
      comment: comment.trim(),
      condition: hasCondition ? {
        requirement: requirement.trim(), feature_id: feature || undefined,
        time_window: time.trim() || undefined, location_label: location.trim() || undefined,
        is_conditional_support: conditional,
      } : undefined,
    }, controller.signal).then(suggestions => {
      if (controller.signal.aborted) return
      setRequests(suggestions)
      setPreviewStatus('ready')
    }).catch(error => {
      if (controller.signal.aborted) return
      setPreviewError(error instanceof Error ? error.message : 'Your comment could not be analysed.')
      setPreviewStatus('error')
    })
    return () => controller.abort()
  }, [active, reviewing, previewAttempt, previewRequests, demo, proposal.id, comment, hasCondition, requirement, feature, time, location, conditional])

  function editRequest(index: number, changes: Partial<ConfirmedCommentRequestDTO>) {
    setRequests(current => current.map((request, i) => i === index ? { ...request, ...changes } : request))
    setConfirmed(false)
  }

  const recordedRequestCount = new Set([
    ...(hasCondition ? [{ requirement, time_window: time, location_label: location }] : []),
    ...requests,
  ].map(request => JSON.stringify([
    request.requirement, request.time_window ?? '', request.location_label ?? '',
  ].map(value => value.trim().toLowerCase())))).size

  function buildSubmission(): ProposalFeedbackSubmissionDTO {
    return {
      proposal_id: proposal.id,
      version_id: versionContext?.id ?? existing?.version_id,
      participant_id: versionContext?.participantId ?? getParticipantId(),
      position: position as PositionStance,
      stakeholder_role: role as StakeholderRole,
      element_ratings: ratings,
      comment: comment.trim(),
      confirmed_requests: requests,
      condition: hasCondition ? {
        requirement: requirement.trim(),
        feature_id: feature || undefined,
        is_conditional_support: conditional,
        location_label: location.trim() || undefined,
        time_window: time.trim() || undefined,
      } : undefined,
      concern_coordinates: existing?.concern_coordinates,
      submitted_at: new Date().toISOString(),
    }
  }

  return (
    <div className="feedback-form-panel">
      <button className="back-button" type="button" disabled={saving} onClick={onCancel}><Icon name="back" />Back to community</button>
      <span className="eyebrow">{reviewing ? 'REVIEW YOUR PERSPECTIVE' : 'YOUR EVERYDAY EXPERIENCE MATTERS'}</span>
      <h2 ref={titleRef} tabIndex={-1}>{reviewing ? 'Does this reflect what you mean?' : existing ? 'Update your perspective.' : 'Make your perspective count.'}</h2>
      <p className="feedback-intro">{reviewing ? 'Check your position and requirement before saving. Your original words stay alongside your recorded requirement.' : 'Tell us where you stand and what would make a difference. You can come back and edit your response.'}</p>

      <form onSubmit={event => {
        event.preventDefault()
        if (saving) return
        if (!position || !role) {
          setAnswerError(!position ? 'Choose your overall position or select Unsure.' : 'Select the situation that best describes you.')
          if (!position) positionRef.current?.focus()
          else situationRef.current?.focus()
          return
        }
        setAnswerError('')
        if (hasCondition && !requirement.trim()) {
          setReviewing(false)
          requirementRef.current?.setCustomValidity('Describe your requirement using your own words.')
          requirementRef.current?.reportValidity()
          return
        }
        if (!reviewing) { setReviewing(true); setConfirmed(false) }
        else if (previewStatus === 'ready' && confirmed && requests.every(request => request.requirement.trim())) void onSave(buildSubmission())
      }}>
        <div hidden={reviewing}>
          <fieldset className="feedback-fieldset" disabled={saving}>
            <legend><span>01</span>Your overall position <small>Required</small></legend>
            <p className="feedback-help">How do you feel about this proposal as a whole?</p>
            <FeedbackSlider label="Your overall position" options={OVERALL_RATINGS} value={position} inputRef={positionRef} onChange={value => { setPosition(value); setAnswerError('') }} />
          </fieldset>

          <fieldset className="feedback-fieldset" disabled={saving}>
            <legend><span>02</span>Your situation <small>Required</small></legend>
            <p className="feedback-help">Do you live, work, travel through, or visit this area? Choose what best describes you.</p>
            <SituationSelect value={role} onChange={value => { setRole(value); setAnswerError('') }} invalid={!!answerError && !role && !!position} buttonRef={situationRef} />
          </fieldset>

          {elements.length > 0 && <fieldset className="feedback-fieldset" disabled={saving}>
            <legend><span>03</span>The individual changes <small>Optional</small></legend>
            <p className="feedback-help">Rate any details you have a view on. Skipping a question is different from being neutral or unsure.</p>
            {elements.map(element => <fieldset className="feedback-element-question" key={element.id}>
              <legend>{element.title}</legend><p className="feedback-help">{element.prompt}</p>
              <FeedbackSlider label={element.title} options={ELEMENT_RATINGS} value={ratings[element.id] || ''} onChange={value => setRatings(current => {
                const next = { ...current }
                if (value) next[element.id] = value
                else delete next[element.id]
                return next
              })} />
              {ratings[element.id] && <button className="feedback-inline-button" type="button" data-tooltip="Leave this optional feature unrated. An unanswered question is different from Neutral or Unsure." onClick={() => setRatings(current => { const next = { ...current }; delete next[element.id]; return next })}>Clear answer</button>}
            </fieldset>)}
          </fieldset>}

          <fieldset className="feedback-fieldset" disabled={saving}>
            <legend><span>{elements.length ? '04' : '03'}</span>What matters to you <small>Optional</small></legend>
            <label className="feedback-field-label" htmlFor="feedback-comment">Your comment</label>
            <p className="feedback-help" id="comment-help">{versionContext
              ? 'Share your experience, a concern, or what could make this work. Use the requirement field to record a specific request.'
              : 'Share your experience, a concern, or what could make this work. You can review and edit requests identified in your comment before anything is saved or counted. They do not imply a promise of support.'}</p>
            <textarea id="feedback-comment" maxLength={4000} rows={4} value={comment} aria-describedby="comment-help" placeholder="For example: I rely on accessible pickup near the entrance in the evening…" onChange={e => { setComment(e.target.value); setConfirmed(false) }} />
            <span className="feedback-character-count">{comment.length} / 4,000</span>
            <label className="feedback-checkbox"><input type="checkbox" checked={hasCondition} data-tooltip="Add a specific change you want, with an optional place and time. Recording a requirement does not mean you support the proposal." onChange={e => { setHasCondition(e.target.checked); setConfirmed(false) }} /><span>I have a specific requirement to record.</span></label>

            {hasCondition && <div className="feedback-condition-fields">
              <p className="feedback-help">Record one requirement in your own words. Include any place or time that matters. Your wording stays available alongside any suggested group.</p>
              <label className="feedback-field-label" htmlFor="feedback-requirement">What needs to happen? <small>Required</small></label>
              <textarea id="feedback-requirement" ref={requirementRef} rows={3} maxLength={1000} required={!reviewing && hasCondition} value={requirement} onChange={e => { e.target.setCustomValidity(''); setRequirement(e.target.value); setConfirmed(false) }} placeholder="Keep accessible pickup available near the clinic entrance until 8 p.m." />
              <label className="feedback-field-label" htmlFor="feedback-feature">Related change</label>
              <select id="feedback-feature" value={feature} data-tooltip="Link your requirement to a particular proposed change, or leave it about the whole proposal or another detail." onChange={e => { setFeature(e.target.value); setConfirmed(false) }}><option value="">Whole proposal / another detail</option>{elements.map(element => <option key={element.id} value={element.id}>{element.title}</option>)}</select>
              <div className="feedback-field-pair">
                <label className="feedback-field-label" htmlFor="feedback-location">Where? <small>Optional</small><input id="feedback-location" maxLength={200} value={location} placeholder="Affected place or entrance" onChange={e => { setLocation(e.target.value); setConfirmed(false) }} /></label>
                <label className="feedback-field-label" htmlFor="feedback-time">When? <small>Optional</small><input id="feedback-time" maxLength={200} value={time} placeholder="Days or hours that matter" onChange={e => { setTime(e.target.value); setConfirmed(false) }} /></label>
              </div>
              <label className="feedback-checkbox"><input type="checkbox" checked={conditional} data-tooltip="Record that meeting this requirement would earn your support. Your overall position remains the answer you selected above." onChange={e => { setConditional(e.target.checked); setConfirmed(false) }} /><span>I would support this proposal if this requirement is met.</span></label>
              <p className="feedback-help">Your overall position stays as you selected it. A requirement does not automatically imply support.</p>
            </div>}
          </fieldset>
        </div>

        {reviewing && <div className="feedback-review">
          <dl>
            <div><dt>Overall position</dt><dd>{position && POSITION_CONFIG[position].label}</dd></div>
            <div><dt>Your situation</dt><dd>{role && STAKEHOLDER_CONFIG[role].label}</dd></div>
            {elements.map(element => ratings[element.id] && <div key={element.id}><dt>{element.title}</dt><dd>{POSITION_CONFIG[ratings[element.id]].shortLabel}</dd></div>)}
          </dl>
          {comment.trim() && <div className="feedback-review-comment"><h3>Your original words</h3><blockquote>“{comment.trim()}”</blockquote></div>}
          {hasCondition && <div className="feedback-review-condition">
            <h3>Your recorded requirement</h3><p>{requirement.trim()}</p>
            <dl><div><dt>Related change</dt><dd>{elements.find(element => element.id === feature)?.title || 'Whole proposal / another detail'}</dd></div>
              <div><dt>Place</dt><dd>{location.trim() || 'Not specified'}</dd></div><div><dt>Time</dt><dd>{time.trim() || 'Not specified'}</dd></div>
              <div><dt>Conditional support</dt><dd>{conditional ? 'I would support this if my requirement is met.' : 'No promise of support; this is a requirement or concern.'}</dd></div>
            </dl>
          </div>}
          <section aria-label="Requests to record" className="feedback-review-requests">
            <h3>Requests identified in your comment</h3>
            <p className="feedback-help">Edit or remove any suggestion. Only the requests you confirm here will contribute to “What would make a difference”. Your original comment stays unchanged.</p>
            {previewStatus === 'loading' && <p role="status" className="feedback-help">Reading your comment… Nothing has been saved or counted.</p>}
            {previewStatus === 'error' && <div role="alert">
              <p className="feedback-error">{previewError}</p>
              <button type="button" className="feedback-inline-button" onClick={() => setPreviewAttempt(value => value + 1)}>Retry analysis</button>
              <button type="button" className="feedback-inline-button" onClick={() => { setRequests([]); setPreviewStatus('ready'); setConfirmed(false) }}>Continue without AI requests</button>
            </div>}
            {previewStatus === 'ready' && !requests.length && <p className="feedback-help">{demo ? 'AI suggestions are unavailable in device-only mode. Your manually recorded requirement can still count.' : 'No additional comment requests will be recorded. Your comment will still be saved when you submit.'}</p>}
            {requests.map((request, index) => <fieldset className="feedback-fieldset" key={index} disabled={saving}>
              <legend>Request {index + 1}</legend>
              <blockquote>“{request.quote}”</blockquote>
              <label className="feedback-field-label" htmlFor={`review-request-${index}`}>What you want to happen</label>
              <textarea id={`review-request-${index}`} rows={2} maxLength={1000} required value={request.requirement} onChange={event => editRequest(index, { requirement: event.target.value })} />
              <div className="feedback-field-pair">
                <label className="feedback-field-label">Where? <small>Optional</small><input maxLength={200} value={request.location_label ?? ''} onChange={event => editRequest(index, { location_label: event.target.value })} /></label>
                <label className="feedback-field-label">When? <small>Optional</small><input maxLength={200} value={request.time_window ?? ''} onChange={event => editRequest(index, { time_window: event.target.value })} /></label>
              </div>
              <button type="button" className="feedback-inline-button" onClick={() => { setRequests(current => current.filter((_, i) => i !== index)); setConfirmed(false) }}>Remove request</button>
            </fieldset>)}
          </section>
          {previewStatus === 'ready' && <>
            <p className="feedback-help">On submission, your overall position and individual ratings will count as shown above. You will contribute {recordedRequestCount} recorded {recordedRequestCount === 1 ? 'request' : 'requests'} to the request chart. New requests appear ungrouped. Equivalent requests may share a group, with each person counted once per group.</p>
            <label className="feedback-checkbox"><input type="checkbox" required checked={confirmed} disabled={saving} onChange={e => setConfirmed(e.target.checked)} /><span>I confirm my answers and the requests above reflect what I want to say.</span></label>
          </>}
          <p className="feedback-help">{versionContext ? 'Your confirmed response will count in the current version’s results. Your earlier response will remain in the earlier round.'
            : <>{demo ? 'This response will be saved on this device only.' : 'This response will be included in community results.'} Editing an existing response replaces it without adding another participant.</>}</p>
        </div>}

        {answerError && <p id="feedback-answer-error" className="feedback-error" role="alert"><Icon name="info" />{answerError}</p>}
        {error && <p className="feedback-error" role="alert"><Icon name="info" />{error}</p>}
        <div className="feedback-form-actions">
          {reviewing && <button className="feedback-secondary-button" type="button" disabled={saving} onClick={() => { setReviewing(false); setConfirmed(false) }}><Icon name="back" />Edit answers</button>}
          <button type="submit" className="feedback-action" data-tooltip={reviewing ? 'Save the answers and requests you confirmed above. Editing a response replaces it without adding another participant.' : 'Check your answers and any suggested requests before saving. This step does not submit your response.'} disabled={saving || (reviewing && (previewStatus !== 'ready' || !confirmed || requests.some(request => !request.requirement.trim())))}>
            {saving ? 'Saving your response…' : !reviewing ? 'Review your response' : versionContext ? 'Confirm and save response' : demo ? 'Save response on this device' : existing ? 'Save updated response' : 'Save your response'}<Icon name={reviewing ? 'check' : 'arrow'} />
          </button>
        </div>
      </form>
    </div>
  )
}
