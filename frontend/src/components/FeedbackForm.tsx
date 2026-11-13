import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Proposal } from '../data/proposals'
import { ORDERED_POSITIONS, ORDERED_STAKEHOLDERS, POSITION_CONFIG, STAKEHOLDER_CONFIG } from '../data/proposalFeedbackDTO'
import type { ElementRatingKey, PositionStance, ProposalFeedbackSubmissionDTO, ProposalSpecificElementDTO, StakeholderRole } from '../data/proposalFeedbackDTO'
import { getParticipantId } from '../data/feedbackSession'
import { Icon } from './Icon'

const RATINGS: ElementRatingKey[] = ['oppose', 'neutral', 'support', 'unsure']

interface Props {
  proposal: Proposal
  elements: ProposalSpecificElementDTO[]
  existing: ProposalFeedbackSubmissionDTO | null
  demo: boolean
  active: boolean
  saving: boolean
  error: string
  onSave: (submission: ProposalFeedbackSubmissionDTO) => Promise<void>
  onCancel: () => void
}

export function FeedbackForm({ proposal, elements, existing, demo, active, saving, error, onSave, onCancel }: Props) {
  const [position, setPosition] = useState<PositionStance | ''>(existing?.position || '')
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
  const [reviewing, setReviewing] = useState(false)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const requirementRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (active) titleRef.current?.focus()
  }, [active, reviewing])

  // A successful save can update the existing response without losing a draft
  // when the user briefly switches to the overview tab.
  useEffect(() => {
    if (!active) { setReviewing(false); setConfirmed(false) }
  }, [active])

  function buildSubmission(): ProposalFeedbackSubmissionDTO {
    return {
      proposal_id: proposal.id,
      version_id: existing?.version_id,
      participant_id: getParticipantId(),
      position: position as PositionStance,
      stakeholder_role: role as StakeholderRole,
      element_ratings: ratings,
      comment: comment.trim(),
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
        if (hasCondition && !requirement.trim()) {
          setReviewing(false)
          requirementRef.current?.setCustomValidity('Describe your requirement using your own words.')
          requirementRef.current?.reportValidity()
          return
        }
        if (!reviewing) { setReviewing(true); setConfirmed(false) }
        else if (!hasCondition || confirmed) void onSave(buildSubmission())
      }}>
        <div hidden={reviewing}>
          <fieldset className="feedback-fieldset" disabled={saving}>
            <legend><span>01</span>Your overall position <small>Required</small></legend>
            <p className="feedback-help">How do you feel about this proposal as a whole?</p>
            <div className="feedback-position-choices">
              {ORDERED_POSITIONS.map(key => <label key={key} className={`feedback-choice ${position === key ? 'is-selected' : ''}`} style={{ '--choice-color': POSITION_CONFIG[key].color, '--choice-background': POSITION_CONFIG[key].bgLight } as CSSProperties}>
                <input type="radio" name="position" value={key} required={!reviewing} checked={position === key} onChange={() => setPosition(key)} />
                <span>{POSITION_CONFIG[key].label}</span>
              </label>)}
            </div>
          </fieldset>

          <fieldset className="feedback-fieldset" disabled={saving}>
            <legend><span>02</span>Your connection <small>Required</small></legend>
            <p className="feedback-help">Choose the connection that best describes you for this response.</p>
            <div className="feedback-role-choices">
              {ORDERED_STAKEHOLDERS.map(key => <label key={key} className={`feedback-choice ${role === key ? 'is-selected' : ''}`}>
                <input type="radio" name="stakeholder" value={key} required={!reviewing} checked={role === key} onChange={() => setRole(key)} />
                <Icon name={STAKEHOLDER_CONFIG[key].icon} /><span>{STAKEHOLDER_CONFIG[key].label}</span>
              </label>)}
            </div>
          </fieldset>

          {elements.length > 0 && <fieldset className="feedback-fieldset" disabled={saving}>
            <legend><span>03</span>The individual changes <small>Optional</small></legend>
            <p className="feedback-help">Rate any details you have a view on. Skipping a question is different from being neutral or unsure.</p>
            {elements.map(element => <fieldset className="feedback-element-question" key={element.id}>
              <legend>{element.title}</legend><p className="feedback-help">{element.prompt}</p>
              <div className="feedback-element-choices">
                {RATINGS.map(key => <label key={key} className={`feedback-choice ${ratings[element.id] === key ? 'is-selected' : ''}`}>
                  <input type="radio" name={`element-${element.id}`} value={key} checked={ratings[element.id] === key} onChange={() => setRatings(current => ({ ...current, [element.id]: key }))} />
                  <span>{POSITION_CONFIG[key].shortLabel}</span>
                </label>)}
              </div>
              {ratings[element.id] && <button className="feedback-inline-button" type="button" onClick={() => setRatings(current => { const next = { ...current }; delete next[element.id]; return next })}>Clear answer</button>}
            </fieldset>)}
          </fieldset>}

          <fieldset className="feedback-fieldset" disabled={saving}>
            <legend><span>{elements.length ? '04' : '03'}</span>What matters to you <small>Optional</small></legend>
            <label className="feedback-field-label" htmlFor="feedback-comment">Your comment</label>
            <p className="feedback-help" id="comment-help">Share your experience, a concern, or what could make this work. A comment alone is not counted as a support condition.</p>
            <textarea id="feedback-comment" maxLength={4000} rows={4} value={comment} aria-describedby="comment-help" placeholder="For example: I rely on accessible pickup near the entrance in the evening…" onChange={e => { setComment(e.target.value); setConfirmed(false) }} />
            <span className="feedback-character-count">{comment.length} / 4,000</span>
            <label className="feedback-checkbox"><input type="checkbox" checked={hasCondition} onChange={e => { setHasCondition(e.target.checked); setConfirmed(false) }} /><span>I have a specific requirement to record.</span></label>

            {hasCondition && <div className="feedback-condition-fields">
              <p className="feedback-help">Record one requirement in your own words. Include any place or time that matters; no automatic interpretation is applied.</p>
              <label className="feedback-field-label" htmlFor="feedback-requirement">What needs to happen? <small>Required</small></label>
              <textarea id="feedback-requirement" ref={requirementRef} rows={3} maxLength={1000} required={!reviewing && hasCondition} value={requirement} onChange={e => { e.target.setCustomValidity(''); setRequirement(e.target.value); setConfirmed(false) }} placeholder="Keep accessible pickup available near the clinic entrance until 8 p.m." />
              <label className="feedback-field-label" htmlFor="feedback-feature">Related change</label>
              <select id="feedback-feature" value={feature} onChange={e => { setFeature(e.target.value); setConfirmed(false) }}><option value="">Whole proposal / another detail</option>{elements.map(element => <option key={element.id} value={element.id}>{element.title}</option>)}</select>
              <div className="feedback-field-pair">
                <label className="feedback-field-label" htmlFor="feedback-location">Where? <small>Optional</small><input id="feedback-location" maxLength={200} value={location} placeholder="Affected place or entrance" onChange={e => { setLocation(e.target.value); setConfirmed(false) }} /></label>
                <label className="feedback-field-label" htmlFor="feedback-time">When? <small>Optional</small><input id="feedback-time" maxLength={200} value={time} placeholder="Days or hours that matter" onChange={e => { setTime(e.target.value); setConfirmed(false) }} /></label>
              </div>
              <label className="feedback-checkbox"><input type="checkbox" checked={conditional} onChange={e => { setConditional(e.target.checked); setConfirmed(false) }} /><span>I would support this proposal if this requirement is met.</span></label>
              <p className="feedback-help">Your overall position stays as you selected it. A requirement does not automatically imply support.</p>
            </div>}
          </fieldset>
        </div>

        {reviewing && <div className="feedback-review">
          <dl>
            <div><dt>Overall position</dt><dd>{position && POSITION_CONFIG[position].label}</dd></div>
            <div><dt>Your connection</dt><dd>{role && STAKEHOLDER_CONFIG[role].label}</dd></div>
            {elements.map(element => ratings[element.id] && <div key={element.id}><dt>{element.title}</dt><dd>{POSITION_CONFIG[ratings[element.id]].shortLabel}</dd></div>)}
          </dl>
          {comment.trim() && <div className="feedback-review-comment"><h3>Your original words</h3><blockquote>“{comment.trim()}”</blockquote></div>}
          {hasCondition && <div className="feedback-review-condition">
            <h3>Your recorded requirement</h3><p>{requirement.trim()}</p>
            <dl><div><dt>Related change</dt><dd>{elements.find(element => element.id === feature)?.title || 'Whole proposal / another detail'}</dd></div>
              <div><dt>Place</dt><dd>{location.trim() || 'Not specified'}</dd></div><div><dt>Time</dt><dd>{time.trim() || 'Not specified'}</dd></div>
              <div><dt>Conditional support</dt><dd>{conditional ? 'I would support this if my requirement is met.' : 'No promise of support; this is a requirement or concern.'}</dd></div>
            </dl>
            <label className="feedback-checkbox"><input type="checkbox" required checked={confirmed} disabled={saving} onChange={e => setConfirmed(e.target.checked)} /><span>I confirm this requirement and its meaning reflect what I want to say.</span></label>
          </div>}
          <p className="feedback-help">{demo ? 'This response will be saved on this device only.' : 'This response will be included in community results.'} Editing an existing response replaces it without adding another participant.</p>
        </div>}

        {error && <p className="feedback-error" role="alert"><Icon name="info" />{error}</p>}
        <div className="feedback-form-actions">
          {reviewing && <button className="feedback-secondary-button" type="button" disabled={saving} onClick={() => { setReviewing(false); setConfirmed(false) }}><Icon name="back" />Edit answers</button>}
          <button type="submit" className="feedback-action" disabled={saving || (reviewing && hasCondition && !confirmed)}>
            {saving ? 'Saving your response…' : !reviewing ? 'Review your response' : demo ? 'Save response on this device' : existing ? 'Save updated response' : 'Save your response'}<Icon name={reviewing ? 'check' : 'arrow'} />
          </button>
        </div>
      </form>
    </div>
  )
}
