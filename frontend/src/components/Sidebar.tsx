import React, { useEffect, useRef, useState } from 'react'
import type { Proposal, Topic } from '../data/proposals'
import type { AuthUser } from '../data/auth'
import { getProposalPresentation } from '../data/proposalPresentation'
import { Icon } from './Icon'
import { DistributionChart, ProposalFeedback } from './ProposalFeedback'
import type { CommunitySnapshot } from './ProposalFeedback'
import { ProposalComments } from './ProposalComments'

const topicIcons: Record<Topic, string> = {
  'Public space': 'leaf',
  'Streets & transit': 'bus',
  Accessibility: 'access',
}

export interface SidebarProps {
  selectedProposal: Proposal | null
  filteredProposals: Proposal[]
  topics: string[]
  statuses: string[]
  catalogueCount: number
  catalogueState: 'loading' | 'ready' | 'error'
  catalogueError: string
  onRetryCatalogue: () => void
  activeTab: 'explore' | 'saved'
  saved: string[]
  topic: string
  setTopic: (topic: string) => void
  query: string
  setQuery: (query: string) => void
  status: string
  setStatus: (status: string) => void
  onSelectProposal: (id: string) => void
  onBackToExplorer: () => void
  onClearFilters: () => void
  onToggleFollow: (id: string) => void
  onFitResults: () => void
  sidebarRef?: React.RefObject<HTMLElement | null>
  currentUser: AuthUser | null
}

export const Sidebar: React.FC<SidebarProps> = ({
  selectedProposal,
  filteredProposals,
  topics,
  statuses,
  catalogueCount,
  catalogueState,
  catalogueError,
  onRetryCatalogue,
  activeTab,
  saved,
  topic,
  setTopic,
  query,
  setQuery,
  status,
  setStatus,
  onSelectProposal,
  onBackToExplorer,
  onClearFilters,
  onToggleFollow,
  onFitResults,
  sidebarRef,
  currentUser,
}) => {
  const [detailTab, setDetailTab] = useState<'overview' | 'feedback' | 'updates'>('overview')
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [communitySnapshot, setCommunitySnapshot] = useState<CommunitySnapshot | null>(null)
  const community = communitySnapshot?.proposalId === selectedProposal?.id ? communitySnapshot : null
  const selectedPresentation = selectedProposal ? getProposalPresentation(selectedProposal) : null
  const detailTitleRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (selectedProposal) {
      setDetailTab('overview')
      setFeedbackOpen(false)
      setTimeout(() => {
        detailTitleRef.current?.focus({ preventScroll: true })
      }, 50)
    }
  }, [selectedProposal?.id])

  const handleDetailTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    const tabs: Array<'overview' | 'feedback' | 'updates'> = ['overview', 'feedback', 'updates']
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
    e.preventDefault()
    let nextIndex = index
    if (e.key === 'Home') nextIndex = 0
    else if (e.key === 'End') nextIndex = tabs.length - 1
    else if (e.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length
    else if (e.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length

    setDetailTab(tabs[nextIndex])
    const nextButton = document.getElementById(`tab-${tabs[nextIndex]}`)
    nextButton?.focus()
  }

  return (
    <aside className="sidebar" ref={sidebarRef} aria-label="Proposal explorer">
      {!selectedProposal ? (
        <div id="explorer">
          <div className="sidebar-heading">
            <h1>Explore local proposals</h1>
            <p>Discover what’s proposed. Share what matters to you.</p>
          </div>

          <div className="search-wrap">
            <Icon name="search" />
            <input
              id="search"
              type="search"
              placeholder="Search proposals or neighbourhoods"
              aria-label="Search proposals or neighbourhoods"
              autoComplete="off"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>

          <div className="topic-filters" aria-label="Filter by topic">
            {topics.map(t => (
              <button
                key={t}
                className={`topic-chip ${t === topic ? 'active' : ''}`}
                data-topic={t}
                aria-pressed={t === topic}
                onClick={() => {
                  setTopic(t)
                  setTimeout(onFitResults, 50)
                }}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="results-toolbar">
            <span id="result-count" aria-live="polite">
              {catalogueState === 'loading' ? 'Loading proposals…' : catalogueState === 'error' ? 'Proposals unavailable' : (
                <>{filteredProposals.length} {activeTab === 'saved' ? 'followed ' : ''}proposal
                {filteredProposals.length === 1 ? '' : 's'}</>
              )}
            </span>
            <label className="status-filter">
              <span className="sr-only">Filter by status</span>
              <select
                id="status"
                value={status}
                onChange={e => {
                  setStatus(e.target.value)
                  setTimeout(onFitResults, 50)
                }}
              >
                <option value="all">All statuses</option>
                {statuses.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </div>

          <div id="proposal-list" className="proposal-list" aria-busy={catalogueState === 'loading'}>
            {catalogueState === 'loading' ? (
              <div className="empty-state" role="status"><Icon name="clock" /><h2>Loading proposals…</h2><p>Connecting to the proposal catalogue.</p></div>
            ) : catalogueState === 'error' ? (
              <div className="empty-state" role="alert"><Icon name="info" /><h2>Proposals couldn’t load</h2><p>{catalogueError}</p>
                <button className="text-button" onClick={onRetryCatalogue}>Try again</button>
              </div>
            ) : filteredProposals.length > 0 ? (
              filteredProposals.map(p => {
                const presentation = getProposalPresentation(p)
                return (
                  <button
                    key={p.id}
                    className="proposal-card"
                    data-proposal={p.id}
                    onClick={() => onSelectProposal(p.id)}
                  >
                    <div className="card-top">
                      <span className={`status-badge ${presentation.badgeClass}`} title={p.status}>
                        <i aria-hidden="true" />
                        {presentation.badgeLabel}
                      </span>
                      <span className="card-category">
                        <Icon name={topicIcons[p.topic] || 'pin'} />
                      </span>
                    </div>
                    <h2>{presentation.title}</h2>
                    <p className="card-neighbourhood">
                      <Icon name="pin" />
                      {p.neighbourhood}
                    </p>
                    <p className="card-summary">{p.summary}</p>
                    {!p.coordinates && <p className="card-neighbourhood">Location not mapped</p>}
                    <div className="card-footer">
                      <span>{p.topic}</span>
                      <span className="card-cta">
                        Explore proposal <Icon name="arrow" />
                      </span>
                    </div>
                  </button>
                )
              })
            ) : (
              <div className="empty-state">
                <Icon name={activeTab === 'saved' ? 'bookmark' : 'search'} />
                <h2>
                  {!catalogueCount ? 'No proposals published yet' : activeTab === 'saved' && !saved.length
                    ? 'Keep a place in mind.'
                    : 'No matching proposals'}
                </h2>
                <p>
                  {!catalogueCount ? 'Published proposals will appear here when available.' : activeTab === 'saved' && !saved.length
                    ? 'Open a proposal and follow it to find it here.'
                    : 'Try another search or clear your filters.'}
                </p>
                {!!catalogueCount && <button id="clear-filters" className="text-button" onClick={onClearFilters}>
                  Clear filters
                </button>}
              </div>
            )}
          </div>

        </div>
      ) : (
        <div id="proposal-detail">
          <button className="back-button" id="back-to-list" onClick={onBackToExplorer}>
            <Icon name="back" /> Back to proposals
          </button>
          <div className="detail-kicker">
            <span className={`status-badge ${selectedPresentation?.badgeClass}`} title={selectedProposal.status}>
              <i aria-hidden="true" />
              {selectedPresentation?.badgeLabel}
            </span>
            <span className="detail-topic">
              <Icon name={topicIcons[selectedProposal.topic] || 'pin'} />
              {selectedProposal.topic}
            </span>
            <span className="card-neighbourhood">
              <Icon name="pin" />
              {selectedProposal.neighbourhood}
            </span>
          </div>
          <h1 tabIndex={-1} id="detail-title" ref={detailTitleRef}>
            {selectedPresentation?.title}
          </h1>

          <div className="detail-toolbar">
            <div className="detail-tabs" role="tablist" aria-label="Proposal information">
              <button
                id="tab-overview"
                role="tab"
                aria-selected={detailTab === 'overview'}
                aria-controls="detail-content"
                tabIndex={detailTab === 'overview' ? 0 : -1}
                data-detail-tab="overview"
                onClick={() => setDetailTab('overview')}
                onKeyDown={e => handleDetailTabKeyDown(e, 0)}
              >
                Overview
              </button>
              <button
                id="tab-feedback"
                role="tab"
                aria-selected={detailTab === 'feedback'}
                aria-controls="detail-content"
                tabIndex={detailTab === 'feedback' ? 0 : -1}
                data-detail-tab="feedback"
                onClick={() => setDetailTab('feedback')}
                onKeyDown={e => handleDetailTabKeyDown(e, 1)}
              >
                Community
              </button>
              <button
                id="tab-updates"
                role="tab"
                aria-selected={detailTab === 'updates'}
                aria-controls="detail-content"
                tabIndex={detailTab === 'updates' ? 0 : -1}
                data-detail-tab="updates"
                onClick={() => setDetailTab('updates')}
                onKeyDown={e => handleDetailTabKeyDown(e, 2)}
              >
                Updates
              </button>
            </div>

            <button
              className={`follow-button ${saved.includes(selectedProposal.id) ? 'following' : ''}`}
              id="follow-button"
              aria-pressed={saved.includes(selectedProposal.id)}
              onClick={() => onToggleFollow(selectedProposal.id)}
            >
              <Icon name={saved.includes(selectedProposal.id) ? 'check' : 'bookmark'} />
              {saved.includes(selectedProposal.id) ? 'Following this proposal' : 'Follow this proposal'}
            </button>
          </div>

          <div id="detail-content" role="tabpanel" aria-labelledby={`tab-${detailTab}`}>
            {detailTab === 'overview' && (
              <div className="proposal-overview">
                <div className="overview-main">
                  <section className="overview-card overview-brief" aria-labelledby="overview-brief-heading">
                    <h2 id="overview-brief-heading">At a glance</h2>
                    <p>{selectedProposal.summary}</p>
                    <ul className="overview-changes">
                      {selectedProposal.changes.map(change => (
                        <li key={change}><Icon name="check" /><span>{change}</span></li>
                      ))}
                    </ul>
                    {!selectedProposal.coordinates && <p>No map location is available for this proposal.</p>}
                    {selectedProposal.source && <a className="source-link" href={selectedProposal.source} target="_blank" rel="noopener noreferrer">
                      Read the official proposal <Icon name="external" />
                    </a>}
                  </section>

                  <section className="overview-card overview-sentiment" aria-labelledby="overview-sentiment-heading">
                    <div className="overview-card-heading">
                      <h2 id="overview-sentiment-heading">Community sentiment</h2>
                      {community && community.mode !== 'loading' && <span>{community.aggregate.total_participants} responses</span>}
                    </div>
                    {!community || community.mode === 'loading' ? (
                      <p role="status">Loading community sentiment…</p>
                    ) : (
                      <>
                        <p className="overview-caption">Not a representative vote.</p>
                        <DistributionChart counts={community.aggregate.position_distribution} total={community.aggregate.total_participants} />
                      </>
                    )}
                    <button className="overview-link" onClick={() => { setFeedbackOpen(false); setDetailTab('feedback'); document.getElementById('tab-feedback')?.focus() }}>
                      Explore community feedback <Icon name="arrow" />
                    </button>
                  </section>

                  <section className="overview-card overview-update" aria-labelledby="overview-update-heading">
                    <span className="overview-section-icon"><Icon name="clock" /></span>
                    <h2 id="overview-update-heading">Latest update</h2>
                    <h3>No updates posted yet</h3>
                    <p>Proposal revisions and project news will appear here when available.</p>
                    <button className="overview-link" onClick={() => { setDetailTab('updates'); document.getElementById('tab-updates')?.focus() }}>
                      View updates <Icon name="arrow" />
                    </button>
                  </section>
                </div>

                <div className="overview-side">
                  <section className="overview-card overview-participate" aria-labelledby="overview-participate-heading">
                    <span className="overview-section-icon"><Icon name="message" /></span>
                    <div>
                      <h2 id="overview-participate-heading">Your feedback & comments</h2>
                      <p>Share where you stand, leave a comment, or tell us what would make this proposal work for you.</p>
                    </div>
                    <button className="primary-button" id="preview-feedback"
                      onClick={() => { setDetailTab('feedback'); setFeedbackOpen(true) }}>
                      {community?.hasResponse ? 'Edit your feedback' : 'Submit feedback / comment'} <Icon name="arrow" />
                    </button>
                  </section>
                  <ProposalComments proposalId={selectedProposal.id} refreshKey={community?.aggregate.last_updated} />
                </div>
              </div>
            )}

            <div hidden={detailTab !== 'feedback'}>
              <ProposalFeedback key={selectedProposal.id} proposal={selectedProposal}
                isResponding={feedbackOpen && detailTab === 'feedback'} onRespondingChange={setFeedbackOpen}
                onCommunityChange={setCommunitySnapshot} currentUser={currentUser} />
            </div>

            {detailTab === 'updates' && (
              <div className="placeholder-content">
                <Icon name="layers" />
                <h2>Follow the next chapter.</h2>
                <p>Proposal revisions and changes will appear here. No revision history or notifications are connected yet.</p>
              </div>
            )}
          </div>


        </div>
      )}

    </aside>
  )
}

export default Sidebar
