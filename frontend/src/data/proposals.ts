import {
  ProposalCommunityAggregateDTO,
} from './proposalFeedbackDTO'

export * from './proposalFeedbackDTO'

export type ProposalStatus = string
export type Topic = string

export interface Proposal {
  id: string
  title: string
  neighbourhood: string
  topic: Topic
  status: ProposalStatus
  coordinates: [number, number] | null
  summary: string
  changes: string[]
  source: string
  shape: [number, number][]
  community_aggregate?: ProposalCommunityAggregateDTO
}

// Real project references, enriched with realistic initial consultation aggregates.
export const proposals: Proposal[] = [
  {
    id: 'kensington',
    title: 'A new chapter for Kensington Market',
    neighbourhood: 'Kensington Market',
    topic: 'Public space',
    status: 'Open for feedback',
    coordinates: [43.6545, -79.4025],
    summary:
      'Explore how street and public-space changes could work for the people who live, work and spend time in the market.',
    changes: [
      'Street and public-space improvements',
      'Access for deliveries and local businesses',
      'Space for walking, gathering and accessible pickup',
    ],
    source:
      'https://www.toronto.ca/community-people/get-involved/public-consultations/infrastructure-projects/kensington-market-construction/',
    shape: [
      [43.6568, -79.4033],
      [43.6546, -79.4025],
      [43.6524, -79.4016],
    ],
    community_aggregate: {
      total_participants: 45,
      total_conditions: 39,
      last_updated: '2026-11-13T10:15:00Z',
      position_distribution: {
        strongly_oppose: 7,
        oppose: 4,
        neutral: 2,
        support: 19,
        strongly_support: 10,
        unsure: 3,
      },
      stakeholder_distribution: {
        resident: 20,
        business: 12,
        commuter: 5,
        visitor: 6,
        citywide: 2,
      },
      proposal_specific: [
        {
          id: 'loading_windows',
          title: 'Commercial Loading Windows (7–10 AM)',
          prompt: 'Dedicated morning curb access for business deliveries before pedestrian-heavy hours',
          distribution: {
            oppose: 11,
            neutral: 5,
            support: 26,
            unsure: 3,
          },
          total_responses: 45,
        },
        {
          id: 'pedestrian_zones',
          title: 'Weekend Pedestrianization',
          prompt: 'Restricting general vehicle traffic on Augusta & Baldwin on weekend afternoons',
          distribution: {
            oppose: 6,
            neutral: 3,
            support: 34,
            unsure: 2,
          },
          total_responses: 45,
        },
        {
          id: 'accessible_pickup',
          title: 'Accessible & Wheel-Trans Pickup Zones',
          prompt: 'Permanent accessible stopping spaces near Bellevue Square and Nassau Street',
          distribution: {
            oppose: 2,
            neutral: 4,
            support: 37,
            unsure: 2,
          },
          total_responses: 45,
        },
      ],
      condition_clusters: [
        {
          id: 'cluster-loading',
          label: 'Commercial Loading Windows (7–9 AM)',
          icon: 'bus',
          count: 18,
          percentage: 46,
          items: [
            {
              id: 'c1',
              verbatim_quote:
                'I run a bakery on Augusta. We support pedestrianization if flour and dairy deliveries can stop within 30m between 7–9 AM.',
              extracted_requirement: 'Dedicated delivery window 7–9 AM within 30m of 180 Augusta Ave',
              is_conditional_support: true,
              time_window: '7–9 AM weekdays',
              location_label: 'Augusta Ave (Nassau to Baldwin)',
              submitted_at: '2026-11-12T14:30:00Z',
            },
            {
              id: 'c2',
              verbatim_quote:
                'Distributors will refuse Kensington drop-offs if loading bays are moved to perimeter arterial streets.',
              extracted_requirement: 'Maintain on-street loading bays inside market interior',
              is_conditional_support: true,
              time_window: 'Morning before 10 AM',
              location_label: 'Baldwin St near Kensington Ave',
              submitted_at: '2026-11-12T16:15:00Z',
            },
          ],
        },
        {
          id: 'cluster-accessible',
          label: 'Accessible / Wheel-Trans Drop-off Zones',
          icon: 'access',
          count: 11,
          percentage: 28,
          items: [
            {
              id: 'c3',
              verbatim_quote:
                'My mother relies on Wheel-Trans for clinic visits on Nassau. An accessible pickup zone must remain open in the evening.',
              extracted_requirement: 'Accessible passenger pickup zone active until 8 PM near 45 Nassau St',
              is_conditional_support: true,
              time_window: 'Evening (until 8 PM)',
              location_label: 'Nassau St clinic entrance',
              submitted_at: '2026-11-12T18:00:00Z',
            },
            {
              id: 'c4',
              verbatim_quote:
                'Cobblestone repaving must have a smooth flush lane for wheelchairs and walkers.',
              extracted_requirement: 'Continuous flush wheel path across pedestrianized segments',
              is_conditional_support: true,
              location_label: 'Augusta Ave',
              submitted_at: '2026-11-13T09:20:00Z',
            },
          ],
        },
        {
          id: 'cluster-parking',
          label: 'Customer & Short-Term Parking',
          icon: 'pin',
          count: 7,
          percentage: 18,
          items: [
            {
              id: 'c5',
              verbatim_quote:
                'Elderly patrons and grocery shoppers need 15-minute quick-stop spots on weekday mornings.',
              extracted_requirement: 'Retain 4–6 short-term (15-min) parking spots on St. Andrew St',
              is_conditional_support: true,
              time_window: 'Weekday mornings',
              location_label: 'St. Andrew St',
              submitted_at: '2026-11-12T11:45:00Z',
            },
          ],
        },
        {
          id: 'cluster-ungrouped',
          label: 'Ungrouped / Unique Access Conditions',
          icon: 'target',
          count: 3,
          percentage: 8,
          is_ungrouped: true,
          items: [
            {
              id: 'c6',
              verbatim_quote:
                'Need dedicated cargo bike corrals to prevent bikes from blocking narrow sidewalk ramps.',
              extracted_requirement: 'Designated cargo bike parking corral on Baldwin St',
              is_conditional_support: false,
              location_label: 'Baldwin St near Bellevue',
              submitted_at: '2026-11-13T08:10:00Z',
            },
          ],
        },
      ],
    },
  },
  {
    id: 'esplanade',
    title: 'Making room on The Esplanade',
    neighbourhood: 'St. Lawrence',
    topic: 'Accessibility',
    status: 'Updated proposal',
    coordinates: [43.6494, -79.3655],
    summary:
      'Take a closer look at street access, accessible pickup and getting around The Esplanade and Mill Street.',
    changes: [
      'Connections for people walking and cycling',
      'Accessible pickup and loading arrangements',
      'Local access along the street',
    ],
    source:
      'https://www.toronto.ca/community-people/get-involved/public-consultations/infrastructure-projects/the-esplanade-mill-street/',
    shape: [
      [43.6481, -79.3714],
      [43.6494, -79.3655],
      [43.6507, -79.3588],
    ],
    community_aggregate: {
      total_participants: 36,
      total_conditions: 28,
      last_updated: '2026-11-13T11:00:00Z',
      position_distribution: {
        strongly_oppose: 4,
        oppose: 3,
        neutral: 3,
        support: 16,
        strongly_support: 8,
        unsure: 2,
      },
      stakeholder_distribution: {
        resident: 22,
        business: 4,
        commuter: 8,
        visitor: 2,
        citywide: 0,
      },
      proposal_specific: [
        {
          id: 'transit_priority',
          title: 'Dedicated Bus & Local Access Lanes',
          prompt: 'Prioritizing 121 Esplanade buses while preserving local residential garage access',
          distribution: {
            oppose: 5,
            neutral: 4,
            support: 25,
            unsure: 2,
          },
          total_responses: 36,
        },
        {
          id: 'senior_pickup',
          title: 'Senior Residence Curbside Pickups',
          prompt: 'Dedicated accessible drop-off bays directly in front of residential building lobbies',
          distribution: {
            oppose: 1,
            neutral: 2,
            support: 31,
            unsure: 2,
          },
          total_responses: 36,
        },
      ],
      condition_clusters: [
        {
          id: 'cluster-senior',
          label: 'Senior Residence Curbside Pickup',
          icon: 'access',
          count: 16,
          percentage: 57,
          items: [
            {
              id: 'e1',
              verbatim_quote:
                'I live at 133 The Esplanade. I support the bike lanes if Wheel-Trans can still pull up right to the front lobby door.',
              extracted_requirement: 'Curbside loading directly in front of 133 The Esplanade lobby',
              is_conditional_support: true,
              location_label: '133 The Esplanade',
              submitted_at: '2026-11-12T13:00:00Z',
            },
          ],
        },
        {
          id: 'cluster-cycling',
          label: 'Bi-directional Cycle Track Separation',
          icon: 'bus',
          count: 9,
          percentage: 32,
          items: [
            {
              id: 'e2',
              verbatim_quote:
                'Physical concrete barriers needed between the cycle track and delivery vans near Lower Sherbourne.',
              extracted_requirement: 'Concrete curb separation rather than paint buffer',
              is_conditional_support: true,
              location_label: 'Intersection at Lower Sherbourne',
              submitted_at: '2026-11-12T15:20:00Z',
            },
          ],
        },
        {
          id: 'cluster-ungrouped',
          label: 'Ungrouped / Unique Access Conditions',
          icon: 'target',
          count: 3,
          percentage: 11,
          is_ungrouped: true,
          items: [
            {
              id: 'e3',
              verbatim_quote: 'Emergency fire vehicle clearance must be verified on Mill Street cul-de-sac.',
              extracted_requirement: 'Fire hydrant clearance verification on Mill St',
              is_conditional_support: false,
              submitted_at: '2026-11-13T09:00:00Z',
            },
          ],
        },
      ],
    },
  },
  {
    id: 'dufferin',
    title: 'A better bus journey on Dufferin',
    neighbourhood: 'Dufferin corridor',
    topic: 'Streets & transit',
    status: 'Under review',
    coordinates: [43.665, -79.437],
    summary:
      'Consider how changes along a busy transit corridor could affect bus journeys, curb access and everyday travel.',
    changes: [
      'Bus-priority measures along the corridor',
      'Access to stops and street crossings',
      'Loading, pickup and local access',
    ],
    source:
      'https://www.toronto.ca/services-payments/streets-parking-transportation/transportation-projects/rapidto/rapidto-dufferin-street/',
    shape: [
      [43.656, -79.4335],
      [43.665, -79.437],
      [43.676, -79.4415],
    ],
    community_aggregate: {
      total_participants: 58,
      total_conditions: 42,
      last_updated: '2026-11-13T09:45:00Z',
      position_distribution: {
        strongly_oppose: 12,
        oppose: 8,
        neutral: 4,
        support: 21,
        strongly_support: 11,
        unsure: 2,
      },
      stakeholder_distribution: {
        resident: 24,
        business: 14,
        commuter: 16,
        visitor: 3,
        citywide: 1,
      },
      proposal_specific: [
        {
          id: 'bus_lanes',
          title: 'Peak-Hour Bus Priority Lanes',
          prompt: 'Dedicated curb-lane transit priority between Bloor St and Queen St during 7–9 AM and 4–6 PM',
          distribution: {
            oppose: 16,
            neutral: 5,
            support: 34,
            unsure: 3,
          },
          total_responses: 58,
        },
        {
          id: 'crossings',
          title: 'Mid-Block Pedestrian Crossings',
          prompt: 'Adding signalized crosswalks near secondary schools and high-density stops',
          distribution: {
            oppose: 4,
            neutral: 3,
            support: 49,
            unsure: 2,
          },
          total_responses: 58,
        },
      ],
      condition_clusters: [
        {
          id: 'cluster-retail-parking',
          label: 'Off-Peak Merchant Parking & Deliveries',
          icon: 'pin',
          count: 22,
          percentage: 52,
          items: [
            {
              id: 'd1',
              verbatim_quote:
                'Small grocers along Dufferin need parking preserved between 10 AM and 3 PM so customers can load heavy boxes.',
              extracted_requirement: 'Allow 1-hour customer parking during off-peak hours (10 AM–3 PM)',
              is_conditional_support: true,
              time_window: '10 AM–3 PM',
              location_label: 'Dufferin between Wallace and Dupont',
              submitted_at: '2026-11-12T10:00:00Z',
            },
          ],
        },
        {
          id: 'cluster-bus-frequency',
          label: 'Express Bus Service (29 & 929 Stop Retention)',
          icon: 'bus',
          count: 14,
          percentage: 33,
          items: [
            {
              id: 'd2',
              verbatim_quote:
                'Transit priority must not remove the stop at Hallam St, which serves seniors walking from Dufferin Grove.',
              extracted_requirement: 'Preserve local 29 stop at Hallam Street northbound and southbound',
              is_conditional_support: true,
              location_label: 'Dufferin & Hallam',
              submitted_at: '2026-11-12T17:45:00Z',
            },
          ],
        },
        {
          id: 'cluster-ungrouped',
          label: 'Ungrouped / Unique Access Conditions',
          icon: 'target',
          count: 6,
          percentage: 15,
          is_ungrouped: true,
          items: [
            {
              id: 'd3',
              verbatim_quote: 'Left-turn bays needed at Sylvan Ave to prevent general traffic gridlock.',
              extracted_requirement: 'Maintain dedicated left-turn pocket at Sylvan Ave',
              is_conditional_support: false,
              submitted_at: '2026-11-13T08:30:00Z',
            },
          ],
        },
      ],
    },
  },
]
