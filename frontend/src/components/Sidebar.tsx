import React, { useEffect, useRef, useState } from 'react'
import type { Proposal, Topic } from '../data/proposals'
import { Icon } from './Icon'
import { ProposalFeedback } from './ProposalFeedback'

const topicIcons: Record<Topic, string> = {
  'Public space': 'leaf',
  'Streets & transit': 'bus',
  Accessibility: 'access',
}

const statusClass = (status: string) =>
  status === 'Open for feedback' ? 'open' : status === 'Updated proposal' ? 'updated' : 'review'

const TOPICS = ['All topics', 'Public space', 'Streets & transit', 'Accessibility'] as const

export interface SidebarProps {
  selectedProposal: Proposal | null
  filteredProposals: Proposal[]
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
}

export const Sidebar: React.FC<SidebarProps> = ({
  selectedProposal,
  filteredProposals,
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
}) => {
  const [detailTab, setDetailTab] = useState<'overview' | 'feedback' | 'updates'>('overview')
  const [feedbackOpen, setFeedbackOpen] = useState(false)
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
            <span className="eyebrow">YOUR NEIGHBOURHOOD. YOUR VOICE.</span>
            <h1>Change starts <br />close to home.</h1>
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
            {TOPICS.map(t => (
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
              {filteredProposals.length} {activeTab === 'saved' ? 'followed ' : ''}proposal
              {filteredProposals.length === 1 ? '' : 's'}
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
                <option>Open for feedback</option>
                <option>Updated proposal</option>
                <option>Under review</option>
              </select>
            </label>
          </div>

          <div id="proposal-list" className="proposal-list">
            {filteredProposals.length > 0 ? (
              filteredProposals.map(p => (
                <button
                  key={p.id}
                  className="proposal-card"
                  data-proposal={p.id}
                  onClick={() => onSelectProposal(p.id)}
                >
                  <div className="card-top">
                    <span className={`status-badge ${statusClass(p.status)}`}>
                      <i />
                      {p.status}
                    </span>
                    <span className="card-category">
                      <Icon name={topicIcons[p.topic]} />
                    </span>
                  </div>
                  <h2>{p.title}</h2>
                  <p className="card-neighbourhood">
                    <Icon name="pin" />
                    {p.neighbourhood}
                  </p>
                  <p className="card-summary">{p.summary}</p>
                  <div className="card-footer">
                    <span>{p.topic}</span>
                    <span className="card-cta">
                      Explore proposal <Icon name="arrow" />
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <div className="empty-state">
                <Icon name={activeTab === 'saved' ? 'bookmark' : 'search'} />
                <h2>
                  {activeTab === 'saved' && !saved.length
                    ? 'Keep a place in mind.'
                    : 'No matching proposals'}
                </h2>
                <p>
                  {activeTab === 'saved' && !saved.length
                    ? 'Open a proposal and follow it to find it here.'
                    : 'Try another search or clear your filters.'}
                </p>
                <button id="clear-filters" className="text-button" onClick={onClearFilters}>
                  Clear filters
                </button>
              </div>
            )}
          </div>

          <div className="demo-note">
            <Icon name="info" />
            <p>A preview of local participation. Project references are real; statuses, locations and interactions are illustrative.</p>
          </div>
        </div>
      ) : (
        <div id="proposal-detail">
          <button className="back-button" id="back-to-list" onClick={onBackToExplorer}>
            <Icon name="back" /> Back to proposals
          </button>
          <div className="detail-kicker">
            <span className={`status-badge ${statusClass(selectedProposal.status)}`}>
              <i />
              {selectedProposal.status}
            </span>
            <span className="demo-tag">DEMO STATUS</span>
          </div>
          <div className="detail-topic">
            <Icon name={topicIcons[selectedProposal.topic]} />
            {selectedProposal.topic}
          </div>
          <h1 tabIndex={-1} id="detail-title" ref={detailTitleRef}>
            {selectedProposal.title}
          </h1>
          <p className="card-neighbourhood">
            <Icon name="pin" />
            {selectedProposal.neighbourhood}
          </p>
          <p className="detail-summary">{selectedProposal.summary}</p>

          <button
            className={`follow-button ${saved.includes(selectedProposal.id) ? 'following' : ''}`}
            id="follow-button"
            aria-pressed={saved.includes(selectedProposal.id)}
            onClick={() => onToggleFollow(selectedProposal.id)}
          >
            <Icon name={saved.includes(selectedProposal.id) ? 'check' : 'bookmark'} />
            {saved.includes(selectedProposal.id) ? 'Following this proposal' : 'Follow this proposal'}
          </button>

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

          <div id="detail-content" role="tabpanel" aria-labelledby={`tab-${detailTab}`}>
            {detailTab === 'overview' && (
              <>
                <h2>What’s being considered</h2>
                <ul className="changes-list">
                  {selectedProposal.changes.map((change, idx) => (
                    <li key={idx}>
                      <Icon name="check" />
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
                <div className="participation-card">
                  <span className="eyebrow">MAKE IT WORK FOR YOU</span>
                  <h3>What would make a difference?</h3>
                  <p>Your everyday experience is part of the bigger picture.</p>
                  <button
                    className="primary-button"
                    id="preview-feedback"
                    onClick={() => { setDetailTab('feedback'); setFeedbackOpen(true) }}
                  >
                    Share your perspective <Icon name="arrow" />
                  </button>
                </div>
              </>
            )}

            <div hidden={detailTab !== 'feedback'}>
              <ProposalFeedback key={selectedProposal.id} proposal={selectedProposal}
                isResponding={feedbackOpen && detailTab === 'feedback'} onRespondingChange={setFeedbackOpen} />
            </div>

            {detailTab === 'updates' && (
              <div className="placeholder-content">
                <Icon name="layers" />
                <h2>Follow the next chapter.</h2>
                <p>Proposal revisions and changes will appear here. No revision history or notifications are connected yet.</p>
              </div>
            )}
          </div>

          <div className="detail-disclaimer">
            <Icon name="info" />
            <p>Prototype preview. Summary and highlighted route are illustrative. Check the official project page for boundaries, current plans and participation dates.</p>
          </div>

          <a
            className="source-link"
            href={selectedProposal.source}
            target="_blank"
            rel="noopener noreferrer"
          >
            View official project page <Icon name="external" />
          </a>
        </div>
      )}

      <footer className="sidebar-footer">
        <span>Small contributions. Shared possibilities.</span>
        <span className="footer-flower">✳</span>
      </footer>
    </aside>
  )
}

export default Sidebar
