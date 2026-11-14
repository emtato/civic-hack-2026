import type { ProposalSnapshot, ProposalSnapshotChange } from './proposalUpdates.ts'

export interface TextSegment { text: string; changed: boolean }

/** Word-level LCS with a bounded cost for large notices; never truncates source text. */
export function highlightTextChanges(before: string, after: string): { before: TextSegment[]; after: TextSegment[] } {
  const a = before.match(/\s+|\S+/g) ?? []
  const b = after.match(/\s+|\S+/g) ?? []
  let prefix = 0
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++
  let suffix = 0
  while (suffix < a.length - prefix && suffix < b.length - prefix
      && a[a.length - suffix - 1] === b[b.length - suffix - 1]) suffix++
  const left = a.slice(prefix, a.length - suffix)
  const right = b.slice(prefix, b.length - suffix)
  const result = { before: [] as TextSegment[], after: [] as TextSegment[] }
  const append = (side: TextSegment[], text: string, changed: boolean) => {
    if (!text) return
    const last = side[side.length - 1]
    if (last?.changed === changed) last.text += text
    else side.push({ text, changed })
  }
  append(result.before, a.slice(0, prefix).join(''), false)
  append(result.after, b.slice(0, prefix).join(''), false)
  if ((left.length + 1) * (right.length + 1) > 250_000) {
    // Preserve common ends and highlight the changed middle instead of allocating
    // an unbounded quadratic matrix for a large replacement.
    append(result.before, left.join(''), true)
    append(result.after, right.join(''), true)
  } else {
    const width = right.length + 1
    const table = new Uint32Array((left.length + 1) * width)
    for (let i = left.length - 1; i >= 0; i--) {
      for (let j = right.length - 1; j >= 0; j--) {
        table[i * width + j] = left[i] === right[j]
          ? 1 + table[(i + 1) * width + j + 1]
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1])
      }
    }
    let i = 0
    let j = 0
    while (i < left.length || j < right.length) {
      if (i < left.length && j < right.length && left[i] === right[j]) {
        append(result.before, left[i++], false)
        append(result.after, right[j++], false)
      } else if (i < left.length && (j === right.length || table[(i + 1) * width + j] >= table[i * width + j + 1])) {
        append(result.before, left[i++], true)
      } else {
        append(result.after, right[j++], true)
      }
    }
  }
  append(result.before, suffix ? a.slice(-suffix).join('') : '', false)
  append(result.after, suffix ? b.slice(-suffix).join('') : '', false)
  return result
}

const labels: Record<string, string> = {
  noticeDescription: 'Description', accessibilityDescription: 'Accessibility',
  noticeDescriptionLinks: 'Links in description', accessibilityDescriptionLinks: 'Accessibility links',
  noticeDate: 'Publication date', noticeId: 'Notice number', noticeHeadingType: 'Notice type',
  backgroundInformationList: 'Background documents', otherReferenceList: 'Other references',
  addressList: 'Locations', eventList: 'Events', planningApplicationNumbers: 'Planning application numbers',
  decisionBody: 'Decision body', signedBy: 'Signed by', emailAddress: 'Email address',
  contactName: 'Name', latitudeCoordinate: 'Latitude', longitudeCoordinate: 'Longitude',
}

function humanize(key: string): string {
  return labels[key] ?? key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, char => char.toUpperCase())
}

export function comparisonFieldLabel(path: string): string {
  return path.split('/').slice(1).map(part => part.replace(/~1/g, '/').replace(/~0/g, '~'))
    .map((part, index) => index === 0 && part === 'notices' ? '' : index === 1 ? `Notice ${part}` : humanize(part))
    .filter(Boolean).join(' · ')
}

export function formatComparisonValue(value: unknown, path = ''): string {
  if (value === null || value === undefined) return 'Not specified'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (path.endsWith('/noticeDate') && typeof value === 'number') return new Date(value).toLocaleString()
  if (Array.isArray(value)) return value.length ? value.map(item => formatComparisonValue(item)).join('\n\n') : 'None listed'
  if (typeof value === 'object') return Object.entries(value).map(([key, item]) => `${humanize(key)}: ${formatComparisonValue(item)}`).join('\n') || 'No details'
  return String(value)
}

export interface ComparisonField {
  path: string
  operation: 'added' | 'removed' | 'changed' | 'unchanged'
  before: unknown
  after: unknown
}

function flatten(value: unknown, path = '', fields = new Map<string, unknown>()): Map<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length) {
    for (const [key, item] of Object.entries(value)) flatten(item, `${path}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`, fields)
  } else fields.set(path, value)
  return fields
}

export function comparisonFields(
  changes: ProposalSnapshotChange[], before?: ProposalSnapshot, after?: ProposalSnapshot, showUnchanged = false,
): ComparisonField[] {
  if (!showUnchanged || !before || !after) return changes.map(change => ({ ...change }))
  const left = flatten(before.content)
  const right = flatten(after.content)
  return [...new Set([...left.keys(), ...right.keys()])].sort().map(path => ({
    path, before: left.get(path), after: right.get(path),
    operation: !left.has(path) ? 'added' : !right.has(path) ? 'removed'
      : changes.some(change => path === change.path || path.startsWith(change.path + '/')) ? 'changed' : 'unchanged',
  }))
}
