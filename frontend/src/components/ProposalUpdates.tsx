import { useEffect, useMemo, useState } from 'react'
import { fetchProposalSnapshot } from '../api/proposalsApi'
import { useProposalUpdates } from '../data/ProposalUpdatesContext'
import { comparisonFieldLabel, comparisonFields, formatComparisonValue, highlightTextChanges } from '../data/proposalComparison'
import type { ComparisonField } from '../data/proposalComparison'
import type { ProposalSnapshot, ProposalSnapshotDiff } from '../data/proposalUpdates'
import { Icon } from './Icon'
import './ProposalUpdates.css'

function dateLabel(value: string): string {
  // MongoDB's default codec returns UTC datetimes without an offset.
  const date = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : value + 'Z')
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString()
}

function SourceLinks({ snapshot }: { snapshot?: ProposalSnapshot }) {
  if (snapshot?.is_demo) return null
  const urls = snapshot?.source_urls.filter(url => /^https?:\/\//i.test(url)) ?? []
  return <div className="updates-source-links">{urls.map((url, index) =>
    <a key={url} href={url} target="_blank" rel="noopener noreferrer">Official notice{urls.length > 1 ? ` ${index + 1}` : ''} ↗</a>
  )}</div>
}

function FieldComparison({ field }: { field: ComparisonField }) {
  const removed = field.operation === 'removed'
  const added = field.operation === 'added'
  const before = added ? '' : formatComparisonValue(field.before, field.path)
  const after = removed ? '' : formatComparisonValue(field.after, field.path)
  const segments = useMemo(() => highlightTextChanges(before, after), [before, after])
  return <article className={`updates-field is-${field.operation}`}>
    <div className="updates-field-heading">
      <h3>{comparisonFieldLabel(field.path)}</h3>
      <span>{field.operation === 'unchanged' ? 'Unchanged' : field.operation === 'added' ? 'Added' : field.operation === 'removed' ? 'Removed' : 'Changed'}</span>
    </div>
    <div className="updates-pair">
      <div className="updates-value updates-before" aria-label="Earlier value">
        <span className="updates-mobile-label">Earlier</span>
        {added ? <p className="updates-absent">Not present in the earlier capture.</p> : <p>{segments.before.map((segment, index) =>
          segment.changed ? <del key={index}>{segment.text}</del> : <span key={index}>{segment.text}</span>
        )}</p>}
      </div>
      <div className="updates-value updates-after" aria-label="Later value">
        <span className="updates-mobile-label">Later</span>
        {removed ? <p className="updates-absent">Not present in the later capture.</p> : <p>{segments.after.map((segment, index) =>
          segment.changed ? <ins key={index}>{segment.text}</ins> : <span key={index}>{segment.text}</span>
        )}</p>}
      </div>
    </div>
  </article>
}

function SnapshotComparison({ diff }: { diff: ProposalSnapshotDiff }) {
  const [result, setResult] = useState<{ before: ProposalSnapshot; after: ProposalSnapshot } | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setError('')
    setResult(null)
    Promise.all([
      fetchProposalSnapshot(diff.proposal_id, diff.before_snapshot_id, controller.signal),
      fetchProposalSnapshot(diff.proposal_id, diff.after_snapshot_id, controller.signal),
    ]).then(([before, after]) => {
      if (!controller.signal.aborted) setResult({ before, after })
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Saved versions could not be loaded.')
    })
    return () => controller.abort()
  }, [diff.proposal_id, diff.before_snapshot_id, diff.after_snapshot_id, attempt])

  const fields = useMemo(() => comparisonFields(diff.changes), [diff.changes])
  return <>
    {!result && !error && <p className="updates-status" role="status">Loading saved versions…</p>}
    {error && <div className="updates-error" role="alert"><p>{error}</p><button className="text-button" onClick={() => setAttempt(value => value + 1)}>Try again</button></div>}
    <div className="updates-version-headings updates-pair">
      <div><h3>{diff.is_demo ? 'Demo previous version' : 'Earlier'}{result && !result.before.is_demo ? ` · Capture ${result.before.sequence}` : ''}</h3>
        {result && <p>{result.before.is_demo ? 'Fictional wording for comparison' : dateLabel(result.before.captured_at)}</p>}<SourceLinks snapshot={result?.before} /></div>
      <div><h3>{result ? `Capture on ${dateLabel(result.after.captured_at)}` : 'Later capture'}</h3>
        <SourceLinks snapshot={result?.after} /></div>
    </div>
    {fields.length ? fields.map(field => <FieldComparison key={field.path} field={field} />)
      : <p className="updates-empty">These captures contain no field changes.</p>}
  </>
}

export function ProposalUpdates({ proposalId }: { proposalId: string }) {
  const state = useProposalUpdates()[proposalId]
  const [selectedId, setSelectedId] = useState('')
  const diffs = state?.diffs ?? []
  const selected = diffs.find(diff => diff.id === selectedId) ?? diffs[diffs.length - 1]
  return <section className="proposal-updates" aria-labelledby="proposal-updates-heading">
    <div className="updates-heading"><span className="updates-eyebrow"><Icon name="layers" /> Proposal history</span>
      <h2 id="proposal-updates-heading">What changed</h2>
      <p>Compare earlier and later copies of the official notice. Removed words are crossed out; additions are underlined.</p>
    </div>
    <div className="updates-notice"><Icon name="info" /><p>{selected?.is_demo
      ? 'demo change, the "before" version is an example to show how this would work'
      : 'Detected changes have not been reviewed. They may include small edits as well as changes to the proposal.'}</p></div>
    {state?.status === 'error' && <div className="updates-error" role="alert"><p>{state.error}</p>{selected && <p>Previously detected changes are still available below.</p>}</div>}
    {(!state || state.status === 'checking') && <p className="updates-status" role="status">Loading saved updates…</p>}
    {state?.status === 'pending' && <p className="updates-status" role="status">Waiting for the first scheduled source check. The backend checks hourly, even when nobody has this page open.</p>}
    {state?.checked_at && <p className="updates-checked">Source last checked {dateLabel(state.checked_at)} · Backend checks hourly.</p>}
    {selected ? <>
      <div className="updates-history-control">
        <label htmlFor="update-comparison">Compare changes</label>
        <select id="update-comparison" value={selected.id} onChange={event => setSelectedId(event.target.value)}>
          {[...diffs].reverse().map((diff, index) => <option key={diff.id} value={diff.id}>
            {diff.is_demo ? 'Demo comparison' : `Change ${diffs.length - index}`}{index === 0 ? ' · Latest' : ''} · {diff.changes.length} {diff.changes.length === 1 ? 'field' : 'fields'}
          </option>)}
        </select>
      </div>
      <SnapshotComparison key={selected.id} diff={selected} />
    </> : state?.status === 'ready' ? <div className="updates-empty"><Icon name="clock" /><h3>No changes detected yet</h3>
      <p>The first check saves an initial copy. Changes found during later checks will appear here for comparison.</p></div> : null}
  </section>
}
