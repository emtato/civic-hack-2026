import type { Proposal } from './proposals'

// Strip only recognized notice headings, leaving the official source title intact.
// More specific headings come first so a meeting notice keeps its type even when
// followed by another heading such as "City of Toronto Act, 2006 Public Notice".
const noticeHeadings = [
  { pattern: /^Notice of Application\s*[-–—:]\s*(?:Under the Planning Act\s*[-–—:]\s*)?/i, label: 'Notice of Application', kind: 'application' },
  { pattern: /^Notice of Public Meeting\s*[-–—:]\s*/i, label: 'Notice of Public Meeting', kind: 'meeting' },
  { pattern: /^Notice of Intention to Designate\s*[-–—:]\s*/i, label: 'Notice of Intention to Designate', kind: 'intention' },
  { pattern: /^Notice of Proposed Amendment of Designation By-law\s*[-–—:]\s*/i, label: 'Notice of Amendment', kind: 'amendment' },
  { pattern: /^Notice of Proposal to Pass a By-law\b.*?\s[-–—:]\s*/i, label: 'Notice of Proposal', kind: 'proposal' },
  { pattern: /^Notice of Decision\s*[-–—:]\s*/i, label: 'Notice of Decision', kind: 'decision' },
  { pattern: /^Declaration of Surplus Property\s*[-–—:]\s*/i, label: 'Declaration of Surplus Property', kind: 'surplus' },
  { pattern: /^(?:City of Toronto Act, 2006\s+)?Public Notice\s*[-–—:]\s*/i, label: 'Public Notice', kind: 'public' },
]

export function getProposalPresentation(proposal: Pick<Proposal, 'title' | 'status'>) {
  let title = proposal.title
  let notice: typeof noticeHeadings[number] | undefined
  let heading = noticeHeadings.find(heading => heading.pattern.test(title))

  while (heading) {
    const remainingTitle = title.replace(heading.pattern, '').trim()
    if (!remainingTitle) break
    notice ??= heading
    title = remainingTitle
    heading = noticeHeadings.find(heading => heading.pattern.test(title))
  }

  const statusClass = proposal.status === 'Open for feedback' ? 'open'
    : proposal.status === 'Updated proposal' ? 'updated' : 'review'

  return {
    title,
    badgeLabel: notice?.label ?? proposal.status,
    badgeClass: notice ? `notice-${notice.kind}` : statusClass,
  }
}
