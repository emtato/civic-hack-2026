import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { proposals } from './data/proposals'
import type { Proposal, Topic } from './data/proposals'
import { Icon, icon } from './components/Icon'

const topicIcons: Record<Topic, string> = {
  'Public space': 'leaf',
  'Streets & transit': 'bus',
  Accessibility: 'access',
}

const statusClass = (status: string) =>
  status === 'Open for feedback' ? 'open' : status === 'Updated proposal' ? 'updated' : 'review'

const colors: Record<string, string> = {
  open: '#397360',
  updated: '#be6739',
  review: '#79828b',
}

const TOPICS = ['All topics', 'Public space', 'Streets & transit', 'Accessibility'] as const

interface DialogData {
  eyebrow?: string
  title: string
  children: React.ReactNode
}

export default function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'explore' | 'saved'>('explore')
  const [topic, setTopic] = useState<string>('All topics')
  const [query, setQuery] = useState<string>('')
  const [status, setStatus] = useState<string>('all')
  const [detailTab, setDetailTab] = useState<'overview' | 'feedback' | 'updates'>('overview')
  const [mobileShowMap, setMobileShowMap] = useState<boolean>(false)
  const [mapError, setMapError] = useState<boolean>(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [dialogData, setDialogData] = useState<DialogData | null>(null)

  const [saved, setSaved] = useState<string[]>(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem('civic-saved') ?? '[]')
      if (Array.isArray(stored)) {
        return stored.filter((id): id is string => typeof id === 'string' && proposals.some(p => p.id === id))
      }
    } catch {
      /* Browser storage fallback */
    }
    return []
  })

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerLayerRef = useRef<L.LayerGroup | null>(null)
  const projectLayerRef = useRef<L.LayerGroup | null>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const detailTitleRef = useRef<HTMLHeadingElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resizeRafRef = useRef<number | null>(null)

  const filteredProposals = useMemo(() => {
    const term = query.trim().toLocaleLowerCase()
    return proposals.filter(p =>
      (activeTab !== 'saved' || saved.includes(p.id)) &&
      (topic === 'All topics' || p.topic === topic) &&
      (status === 'all' || p.status === status) &&
      `${p.title} ${p.neighbourhood} ${p.topic}`.toLocaleLowerCase().includes(term)
    )
  }, [query, activeTab, saved, topic, status])

  const selectedProposal = useMemo(() => {
    return proposals.find(p => p.id === selectedId) || null
  }, [selectedId])

  const showToast = useCallback((message: string) => {
    setToastMessage(message)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null)
    }, 4500)
  }, [])

  const toggleFollow = useCallback((id: string) => {
    setSaved(prev => {
      const next = prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
      let persisted = true
      try {
        localStorage.setItem('civic-saved', JSON.stringify(next))
      } catch {
        persisted = false
      }
      showToast(
        persisted
          ? next.includes(id)
            ? 'Added to Following on this device. No notifications are sent.'
            : 'Removed from Following.'
          : 'Updated for this visit. Browser storage is unavailable.'
      )
      return next
    })
  }, [showToast])

  const animateMapResize = useCallback((onComplete?: () => void, targetCoords?: [number, number]) => {
    const map = mapRef.current
    if (!map) return
    if (resizeRafRef.current) cancelAnimationFrame(resizeRafRef.current)
    const startTime = performance.now()
    const duration = 340
    const zoom = targetCoords ? (window.innerWidth < 1200 ? 14 : 15) : map.getZoom()

    function step(now: number) {
      const elapsed = now - startTime
      map?.invalidateSize({ pan: false })
      if (targetCoords && map) {
        map.setView(targetCoords, zoom, { animate: false })
      }
      if (elapsed < duration) {
        resizeRafRef.current = requestAnimationFrame(step)
      } else {
        resizeRafRef.current = null
        map?.invalidateSize()
        onComplete?.()
      }
    }
    resizeRafRef.current = requestAnimationFrame(step)
  }, [])

  const fitResults = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    if (filteredProposals.length) {
      map.fitBounds(L.latLngBounds(filteredProposals.map(p => p.coordinates)), {
        padding: [70, 95],
        maxZoom: 14,
      })
    }
  }, [filteredProposals])

  const openProposal = useCallback((id: string) => {
    const p = proposals.find(item => item.id === id)
    if (!p) return
    const wasOpen = selectedId !== null
    setSelectedId(id)
    setDetailTab('overview')
    setMobileShowMap(false)

    if (sidebarRef.current) sidebarRef.current.scrollTop = 0

    const map = mapRef.current
    if (map) {
      const targetZoom = window.innerWidth < 1200 ? 14 : 15
      if (!wasOpen) {
        animateMapResize(() => {
          map.flyTo(p.coordinates, targetZoom, { duration: 0.25 })
        }, p.coordinates)
      } else {
        map.flyTo(p.coordinates, targetZoom, { duration: 0.5 })
      }
    }

    setTimeout(() => {
      detailTitleRef.current?.focus({ preventScroll: true })
    }, 50)
  }, [selectedId, animateMapResize])

  const showExplorer = useCallback(() => {
    const wasOpen = selectedId !== null
    setSelectedId(null)
    if (sidebarRef.current) sidebarRef.current.scrollTop = 0
    if (wasOpen) {
      animateMapResize(() => {
        fitResults()
      })
    } else {
      fitResults()
    }
  }, [selectedId, animateMapResize, fitResults])

  const clearFilters = useCallback(() => {
    setQuery('')
    setTopic('All topics')
    setStatus('all')
    fitResults()
  }, [fitResults])

  // Map initialization
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return
    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      scrollWheelZoom: true,
      minZoom: 10,
      maxZoom: 18,
    }).setView([43.658, -79.398], 13)

    map.attributionControl?.setPosition('bottomleft')

    const tiles = L.tileLayer(
      import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution:
          import.meta.env.VITE_MAP_ATTRIBUTION ||
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }
    ).addTo(map)

    tiles.on('tileerror', () => setMapError(true))
    tiles.on('tileload', () => setMapError(false))

    const markerLayer = L.layerGroup().addTo(map)
    const projectLayer = L.layerGroup().addTo(map)

    mapRef.current = map
    markerLayerRef.current = markerLayer
    projectLayerRef.current = projectLayer

    const resizeObserver = new ResizeObserver(() => map.invalidateSize())
    resizeObserver.observe(mapContainerRef.current)

    // Initial fit
    if (proposals.length) {
      map.fitBounds(L.latLngBounds(proposals.map(p => p.coordinates)), {
        padding: [70, 95],
        maxZoom: 14,
      })
    }

    return () => {
      resizeObserver.disconnect()
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Sync markers
  useEffect(() => {
    const markerLayer = markerLayerRef.current
    if (!markerLayer) return
    markerLayer.clearLayers()

    filteredProposals.forEach(p => {
      const marker = L.marker(p.coordinates, {
        icon: L.divIcon({
          className: 'proposal-marker-wrap',
          html: `<span class="proposal-marker ${statusClass(p.status)} ${selectedId === p.id ? 'selected' : ''}">${icon(topicIcons[p.topic])}</span>`,
          iconSize: [46, 54],
          iconAnchor: [23, 50],
        }),
        title: p.title,
        alt: `${p.title}, ${p.status}`,
        keyboard: true,
      }).addTo(markerLayer)

      marker.bindTooltip(p.title, { direction: 'top', offset: [0, -44], className: 'proposal-tooltip' })
      marker.on('click', () => openProposal(p.id))
    })
  }, [filteredProposals, selectedId, openProposal])

  // Sync project route/shape
  useEffect(() => {
    const projectLayer = projectLayerRef.current
    if (!projectLayer) return
    projectLayer.clearLayers()
    if (selectedProposal) {
      const sClass = statusClass(selectedProposal.status)
      const strokeColor = colors[sClass] || colors.review
      L.polyline(selectedProposal.shape, {
        color: strokeColor,
        weight: 20,
        opacity: 0.13,
        lineCap: 'round',
      }).addTo(projectLayer)
      L.polyline(selectedProposal.shape, {
        color: strokeColor,
        weight: 4,
        opacity: 0.85,
        dashArray: '7 7',
      }).addTo(projectLayer)
    }
  }, [selectedProposal])

  // Sync dialog modal state
  useEffect(() => {
    if (dialogData) {
      dialogRef.current?.showModal()
    } else {
      dialogRef.current?.close()
    }
  }, [dialogData])

  const handleOpenAbout = () => {
    setDialogData({
      eyebrow: 'BUILT FOR CIVIC HACK 2026',
      title: 'The city is a shared project.',
      children: (
        <>
          <p>Civic explores a simple idea: people should be able to explain what would make a municipal proposal work for them, and follow what changes next.</p>
          <p>This prototype demonstrates discovery and navigation using three real Toronto project references. Descriptions, marker locations, highlighted routes and statuses are illustrative.</p>
          <div className="preview-example">
            <strong>Your browser, your shortlist.</strong>
            <p>Following is saved only on this device. No accounts, submissions or notifications are connected.</p>
          </div>
        </>
      ),
    })
  }

  const handleOpenFeedbackPreview = (proposalTitle: string) => {
    setDialogData({
      eyebrow: 'INTERACTION PREVIEW',
      title: 'A voice in what comes next.',
      children: (
        <>
          <p>This is where you’ll share your position on “{proposalTitle}” and explain what would make it work for you.</p>
          <div className="preview-example">
            <strong>For example</strong>
            <p>“I’d support this if accessible pickup stays near the entrance in the evening.”</p>
          </div>
          <p className="dialog-footnote">The feedback form is the next stage. Nothing is collected or submitted in this preview.</p>
        </>
      ),
    })
  }

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
    <div id="app">
      <header className="app-header">
        <a
          className="brand"
          href="#"
          aria-label="Civic home"
          onClick={e => {
            e.preventDefault()
            setActiveTab('explore')
            showExplorer()
            clearFilters()
          }}
        >
          <span className="brand-mark"><Icon name="layers" /></span>
          civic<span className="brand-dot">.</span>
        </a>

        <nav className="main-nav" aria-label="Main navigation">
          <button
            className={`nav-item ${activeTab === 'explore' ? 'active' : ''}`}
            data-nav="explore"
            onClick={() => {
              setActiveTab('explore')
              showExplorer()
              setMobileShowMap(false)
            }}
          >
            Explore proposals
          </button>
          <button
            className={`nav-item ${activeTab === 'saved' ? 'active' : ''}`}
            data-nav="saved"
            onClick={() => {
              setActiveTab('saved')
              showExplorer()
              setMobileShowMap(false)
            }}
          >
            <Icon name="bookmark" />
            <span>Following</span>
            <span id="saved-count">{saved.length}</span>
          </button>
        </nav>

        <span className="header-location">
          <Icon name="pin" /> Toronto, Ontario
        </span>

        <button className="about-button" id="about-button" onClick={handleOpenAbout}>
          About this project <Icon name="external" />
        </button>
      </header>

      <main className={`workspace ${selectedId ? 'detail-open' : ''} ${mobileShowMap ? 'mobile-map' : ''}`}>
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
                      setTimeout(fitResults, 50)
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
                      setTimeout(fitResults, 50)
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
                      onClick={() => openProposal(p.id)}
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
                    <button id="clear-filters" className="text-button" onClick={clearFilters}>
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
              <button className="back-button" id="back-to-list" onClick={showExplorer}>
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
                onClick={() => toggleFollow(selectedProposal.id)}
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
                        onClick={() => handleOpenFeedbackPreview(selectedProposal.title)}
                      >
                        Preview giving feedback <Icon name="arrow" />
                      </button>
                    </div>
                  </>
                )}

                {detailTab === 'feedback' && (
                  <div className="placeholder-content">
                    <Icon name="message" />
                    <h2>Every perspective adds something.</h2>
                    <p>This space will bring together participants’ concerns and conditions. Community feedback isn’t connected in this prototype.</p>
                    <button
                      className="primary-button"
                      id="preview-feedback"
                      onClick={() => handleOpenFeedbackPreview(selectedProposal.title)}
                    >
                      Preview giving feedback <Icon name="arrow" />
                    </button>
                  </div>
                )}

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

        <section className="map-shell" aria-label="Toronto proposal map">
          <div id="map" ref={mapContainerRef} aria-label="Interactive map showing proposal locations" />
          <div className="map-controls-stack">
            <div className="map-tools" role="toolbar" aria-label="Map controls">
              <button
                id="zoom-in"
                aria-label="Zoom in"
                title="Zoom in"
                onClick={() => mapRef.current?.zoomIn()}
              >
                <Icon name="plus" />
              </button>
              <span className="tool-divider" aria-hidden="true" />
              <button
                id="zoom-out"
                aria-label="Zoom out"
                title="Zoom out"
                onClick={() => mapRef.current?.zoomOut()}
              >
                <Icon name="minus" />
              </button>
              <span className="tool-divider" aria-hidden="true" />
              <button
                id="reset-map"
                aria-label="Show all matching proposals"
                title="Show all matching proposals"
                onClick={() => {
                  showExplorer()
                  fitResults()
                }}
              >
                <Icon name="target" />
              </button>
            </div>

            <div className="map-legend" aria-label="Proposal status legend">
              <span className="legend-title">PROPOSAL STATUS</span>
              <span><i className="legend-dot open" />Open for feedback</span>
              <span><i className="legend-dot updated" />Updated proposal</span>
              <span><i className="legend-dot review" />Under review</span>
            </div>
          </div>

          {mapError && (
            <div id="map-error" className="map-error" role="status">
              Map tiles couldn’t load. You can still explore proposals in the list.
            </div>
          )}
        </section>

        <button
          id="mobile-toggle"
          className="mobile-toggle"
          onClick={() => {
            setMobileShowMap(prev => {
              const next = !prev
              requestAnimationFrame(() => mapRef.current?.invalidateSize())
              return next
            })
          }}
        >
          <Icon name={mobileShowMap ? 'list' : 'pin'} /> {mobileShowMap ? 'Show proposals' : 'Show map'}
        </button>
      </main>

      <dialog
        id="info-dialog"
        ref={dialogRef}
        aria-labelledby="dialog-title"
        onClick={e => {
          if (e.target === dialogRef.current) {
            const rect = dialogRef.current.getBoundingClientRect()
            if (
              e.clientX < rect.left ||
              e.clientX > rect.right ||
              e.clientY < rect.top ||
              e.clientY > rect.bottom
            ) {
              setDialogData(null)
            }
          }
        }}
      >
        <div id="dialog-content">
          {dialogData && (
            <>
              {dialogData.eyebrow && <span className="eyebrow">{dialogData.eyebrow}</span>}
              <h2 id="dialog-title">{dialogData.title}</h2>
              {dialogData.children}
            </>
          )}
        </div>
        <button
          className="dialog-close icon-button"
          aria-label="Close dialog"
          onClick={() => setDialogData(null)}
        >
          <Icon name="close" />
        </button>
      </dialog>

      <div id="toast" role="status" className="toast" hidden={!toastMessage}>
        {toastMessage}
      </div>
    </div>
  )
}
