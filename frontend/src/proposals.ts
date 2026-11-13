export type ProposalStatus = 'Open for feedback' | 'Under review' | 'Updated proposal'
export type Topic = 'Public space' | 'Streets & transit' | 'Accessibility'

export interface Proposal {
  id: string
  title: string
  neighbourhood: string
  topic: Topic
  status: ProposalStatus
  coordinates: [number, number]
  summary: string
  changes: string[]
  source: string
  shape: [number, number][]
}

// Real project references, with illustrative summaries, locations and UI statuses.
// These are frontend fixtures, not current consultation records or project boundaries.
export const proposals: Proposal[] = [
  {
    id: 'kensington',
    title: 'A new chapter for Kensington Market',
    neighbourhood: 'Kensington Market',
    topic: 'Public space',
    status: 'Open for feedback',
    coordinates: [43.6545, -79.4025],
    summary: 'Explore how street and public-space changes could work for the people who live, work and spend time in the market.',
    changes: ['Street and public-space improvements', 'Access for deliveries and local businesses', 'Space for walking, gathering and accessible pickup'],
    source: 'https://www.toronto.ca/community-people/get-involved/public-consultations/infrastructure-projects/kensington-market-construction/',
    shape: [[43.6568, -79.4033], [43.6546, -79.4025], [43.6524, -79.4016]],
  },
  {
    id: 'esplanade',
    title: 'Making room on The Esplanade',
    neighbourhood: 'St. Lawrence',
    topic: 'Accessibility',
    status: 'Updated proposal',
    coordinates: [43.6494, -79.3655],
    summary: 'Take a closer look at street access, accessible pickup and getting around The Esplanade and Mill Street.',
    changes: ['Connections for people walking and cycling', 'Accessible pickup and loading arrangements', 'Local access along the street'],
    source: 'https://www.toronto.ca/community-people/get-involved/public-consultations/infrastructure-projects/the-esplanade-mill-street/',
    shape: [[43.6481, -79.3714], [43.6494, -79.3655], [43.6507, -79.3588]],
  },
  {
    id: 'dufferin',
    title: 'A better bus journey on Dufferin',
    neighbourhood: 'Dufferin corridor',
    topic: 'Streets & transit',
    status: 'Under review',
    coordinates: [43.665, -79.437],
    summary: 'Consider how changes along a busy transit corridor could affect bus journeys, curb access and everyday travel.',
    changes: ['Bus-priority measures along the corridor', 'Access to stops and street crossings', 'Loading, pickup and local access'],
    source: 'https://www.toronto.ca/services-payments/streets-parking-transportation/transportation-projects/rapidto/rapidto-dufferin-street/',
    shape: [[43.656, -79.4335], [43.665, -79.437], [43.676, -79.4415]],
  },
]
