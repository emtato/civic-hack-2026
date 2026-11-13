import type { Proposal } from '../data/proposals'

export function isCoordinatePair(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 &&
    typeof value[0] === 'number' && Number.isFinite(value[0]) && Math.abs(value[0]) <= 90 &&
    typeof value[1] === 'number' && Number.isFinite(value[1]) && Math.abs(value[1]) <= 180
}

export function hasMapCoordinates(proposal: Proposal): proposal is Proposal & { coordinates: [number, number] } {
  return isCoordinatePair(proposal.coordinates)
}

const text = (value: unknown, fallback = '') =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback

/** Validate the public display DTO, not the separate rich import schema. */
export function parseProposalCatalogue(payload: unknown): Proposal[] {
  if (!Array.isArray(payload)) throw new Error('The proposal service returned an invalid catalogue.')
  const ids = new Set<string>()
  return payload.map(value => {
    if (!value || typeof value !== 'object') throw new Error('The proposal service returned an invalid proposal.')
    const row = value as Record<string, unknown>
    const id = text(row.id)
    const title = text(row.title)
    if (!id || !title || ids.has(id)) throw new Error('The proposal service returned missing or duplicate proposal identifiers.')
    ids.add(id)
    const source = text(row.source)
    return {
      id, title,
      neighbourhood: text(row.neighbourhood, 'Location not specified'),
      topic: text(row.topic, 'Uncategorized'),
      status: text(row.status, 'Status not confirmed'),
      coordinates: isCoordinatePair(row.coordinates) ? row.coordinates : null,
      summary: text(row.summary, 'Summary not available yet.'),
      changes: Array.isArray(row.changes) ? row.changes.filter((item): item is string => typeof item === 'string') : [],
      source: /^https?:\/\//i.test(source) ? source : '',
      shape: Array.isArray(row.shape) && row.shape.every(isCoordinatePair) ? row.shape : [],
      // The aggregate has its own backend contract and live request lifecycle.
      community_aggregate: row.community_aggregate && typeof row.community_aggregate === 'object'
        ? row.community_aggregate as Proposal['community_aggregate'] : undefined,
    }
  })
}
