import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Proposal, Topic } from './data/proposals'
import { fetchProposals } from './api/proposalsApi'
import { hasMapCoordinates } from './api/catalogue'
import { getProposalPresentation } from './data/proposalPresentation'
import { Icon, icon } from './components/Icon'
import { Sidebar } from './components/Sidebar'
import { AuthBar } from './components/AuthBar'
import { Notifications } from './components/Notifications'
import { fetchFollowing, setProposalFollow, type ProposalNotification } from './api/notificationsApi'
import { fetchCurrentUser, getStoredUser, logout, type AuthUser } from './data/auth'
import { ProposalUpdatesProvider } from './data/ProposalUpdatesContext'
import { LABATT_DEMO_HASH, LABATT_PROPOSAL_ID } from './data/labattDemo'

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

// Approximate bounds covering Toronto, including Etobicoke and Scarborough.
const TORONTO_BOUNDS: L.LatLngBoundsExpression = [[43.58, -79.64], [43.86, -79.11]]

export default function App() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [catalogueState, setCatalogueState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [catalogueError, setCatalogueError] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [fullDemo, setFullDemo] = useState(() => window.location.hash === LABATT_DEMO_HASH)
  const [selectedId, setSelectedId] = useState<string | null>(() => fullDemo ? LABATT_PROPOSAL_ID : null)
  const [activeTab, setActiveTab] = useState<'explore' | 'saved'>('explore')
  const [topic, setTopic] = useState<string>('All topics')
  const [query, setQuery] = useState<string>('')
  const [status, setStatus] = useState<string>('all')
  const [mobileShowMap, setMobileShowMap] = useState<boolean>(false)
  const [mapError, setMapError] = useState<boolean>(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [notificationTarget, setNotificationTarget] = useState<{ proposalId: string; diffId: string; request: number } | null>(null)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getStoredUser())

  const [saved, setSaved] = useState<string[]>([])
  const [followingReady, setFollowingReady] = useState(false)
  const followingRequests = useRef(new Set<string>())
  const signedInUsername = useRef(currentUser?.username)
  signedInUsername.current = currentUser?.username

  useEffect(() => {
    const controller = new AbortController()
    setSaved([])
    setFollowingReady(false)
    if (currentUser) {
      fetchFollowing(controller.signal).then(ids => {
        if (!controller.signal.aborted) { setSaved(ids); setFollowingReady(true) }
      }).catch(() => {
        if (!controller.signal.aborted) setToastMessage('Following couldn’t load. Refresh to try again.')
      })
    }
    return () => controller.abort()
  }, [currentUser?.username])

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerLayerRef = useRef<L.LayerGroup | null>(null)
  const projectLayerRef = useRef<L.LayerGroup | null>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resizeRafRef = useRef<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setCatalogueState('loading')
    setCatalogueError('')
    fetchProposals(controller.signal)
      .then(items => {
        if (!active) return
        setProposals(items)
        setCatalogueState('ready')
      })
      .catch(() => {
        if (!active) return
        setCatalogueError('We couldn’t load proposals. Check your connection and try again.')
        setCatalogueState('error')
      })
    return () => { active = false; controller.abort() }
  }, [loadAttempt])

  const topics = useMemo(() => ['All topics', ...new Set(proposals.map(p => p.topic))], [proposals])
  const statuses = useMemo(() => [...new Set(proposals.map(p => p.status))], [proposals])

  const filteredProposals = useMemo(() => {
    const term = query.trim().toLocaleLowerCase()
    return proposals.filter(p =>
      (activeTab !== 'saved' || saved.includes(p.id)) &&
      (topic === 'All topics' || p.topic === topic) &&
      (status === 'all' || p.status === status) &&
      `${p.title} ${p.neighbourhood} ${p.topic}`.toLocaleLowerCase().includes(term)
    )
  }, [proposals, query, activeTab, saved, topic, status])

  const citywideResults = filteredProposals.length > 0 &&
    filteredProposals.every(p => p.neighbourhood === 'Toronto-wide')

  const selectedProposal = useMemo(() => {
    return proposals.find(p => p.id === selectedId) || null
  }, [proposals, selectedId])

  const showToast = useCallback((message: string) => {
    setToastMessage(message)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null)
    }, 4500)
  }, [])

  // Validate any stored token against the server once on load. If it is
  // missing or expired the user is quietly treated as logged out.
  useEffect(() => {
    let active = true
    fetchCurrentUser().then(user => {
      if (active) setCurrentUser(user)
    })
    return () => { active = false }
  }, [])

  const handleAuthenticated = useCallback((user: AuthUser) => {
    setCurrentUser(user)
    showToast(`Signed in as ${user.username}. You can now submit feedback.`)
  }, [showToast])

  const handleLogout = useCallback(() => {
    logout()
    setCurrentUser(null)
    showToast('Logged out. You can still browse all proposals and feedback.')
  }, [showToast])

  const toggleFollow = useCallback(async (id: string) => {
    if (!currentUser) {
      showToast('Please sign in to follow proposals and receive updates.')
      return
    }
    if (!followingReady) { showToast('Following is still loading. Please try again shortly.'); return }
    if (followingRequests.current.has(id)) return
    followingRequests.current.add(id)
    const following = !saved.includes(id)
    const username = currentUser.username
    try {
      await setProposalFollow(id, following)
      if (signedInUsername.current !== username) return
      setSaved(previous => following ? [...new Set([...previous, id])] : previous.filter(item => item !== id))
      showToast(following ? 'Following this proposal. You’ll receive updates here.' : 'Removed from Following.')
    } catch (error) {
      if (signedInUsername.current === username) showToast(error instanceof Error ? error.message : 'Following couldn’t be updated.')
    } finally {
      followingRequests.current.delete(id)
    }
  }, [currentUser, saved, followingReady, showToast])

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
    if (citywideResults) {
      map.fitBounds(TORONTO_BOUNDS, { padding: [30, 30] })
      return
    }
    const mapped = filteredProposals.filter(hasMapCoordinates)
    if (mapped.length) {
      map.fitBounds(L.latLngBounds(mapped.map(p => p.coordinates)), {
        padding: [70, 95],
        maxZoom: 14,
      })
    }
  }, [filteredProposals, citywideResults])

  const showDemoRoute = useCallback((show: boolean) => {
    setFullDemo(show)
    if (show || window.location.hash === LABATT_DEMO_HASH) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search + (show ? LABATT_DEMO_HASH : ''))
    }
  }, [])

  const openProposal = useCallback((id: string, showReference = false) => {
    const p = proposals.find(item => item.id === id)
    if (!p) return
    setNotificationTarget(null)
    showDemoRoute(id === LABATT_PROPOSAL_ID && !showReference)
    const wasOpen = selectedId !== null
    setSelectedId(id)
    setMobileShowMap(false)

    if (sidebarRef.current) sidebarRef.current.scrollTop = 0

    const map = mapRef.current
    if (map && hasMapCoordinates(p)) {
      const targetZoom = window.innerWidth < 1200 ? 14 : 15
      if (!wasOpen) {
        animateMapResize(() => {
          map.flyTo(p.coordinates, targetZoom, { duration: 0.25 })
        }, p.coordinates)
      } else {
        map.flyTo(p.coordinates, targetZoom, { duration: 0.5 })
      }
    } else if (map && !wasOpen) {
      animateMapResize()
    }
  }, [proposals, selectedId, animateMapResize, showDemoRoute])

  const showExplorer = useCallback(() => {
    const wasOpen = selectedId !== null
    showDemoRoute(false)
    setSelectedId(null)
    if (sidebarRef.current) sidebarRef.current.scrollTop = 0
    if (wasOpen) {
      animateMapResize(() => {
        fitResults()
      })
    } else {
      fitResults()
    }
  }, [selectedId, animateMapResize, fitResults, showDemoRoute])

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
      minZoom: 8,
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

    return () => {
      resizeObserver.disconnect()
      map.remove()
      mapRef.current = null
      markerLayerRef.current = null
      projectLayerRef.current = null
      if (resizeRafRef.current) cancelAnimationFrame(resizeRafRef.current)
    }
  }, [])

  // Fit the current results after React has applied a filter change.
  useEffect(() => {
    fitResults()
  }, [fitResults])

  // Sync map markers
  useEffect(() => {
    const markerLayer = markerLayerRef.current
    if (!markerLayer) return
    markerLayer.clearLayers()

    filteredProposals.filter(hasMapCoordinates).forEach(p => {
      const { title, badgeLabel } = getProposalPresentation(p)
      const marker = L.marker(p.coordinates, {
        icon: L.divIcon({
          className: 'proposal-marker-wrap',
          html: `<span class="proposal-marker ${statusClass(p.status)} ${selectedId === p.id ? 'selected' : ''}">${icon(topicIcons[p.topic] || 'pin')}</span>`,
          iconSize: [46, 54],
          iconAnchor: [23, 50],
        }),
        title,
        alt: `${title}, ${badgeLabel}, ${p.status}`,
        keyboard: true,
      }).addTo(markerLayer)

      const tooltip = document.createElement('span')
      tooltip.textContent = title
      marker.bindTooltip(tooltip, { direction: 'top', offset: [0, -44], className: 'proposal-tooltip' })
      marker.on('click', () => openProposal(p.id))
    })
  }, [filteredProposals, selectedId, openProposal])

  // Sync route polyline
  useEffect(() => {
    const projectLayer = projectLayerRef.current
    if (!projectLayer) return
    projectLayer.clearLayers()
    if (selectedProposal && selectedProposal.shape.length >= 2) {
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

  const openNotification = (notification: ProposalNotification) => {
    if (!proposals.some(proposal => proposal.id === notification.proposal_id)) {
      showToast('This proposal is not in the current catalogue. Try refreshing the catalogue.')
      return
    }
    openProposal(notification.proposal_id, true)
    setNotificationTarget({ proposalId: notification.proposal_id, diffId: notification.diff_id, request: Date.now() })
  }

  return (
    <ProposalUpdatesProvider proposals={proposals}>
    <div id="app">
      {/* Top Bar / App Header */}
      <header className="app-header">
        <a
          className="brand"
          href="#"
          aria-label="proviso home"
          onClick={e => {
            e.preventDefault()
            setActiveTab('explore')
            showExplorer()
            clearFilters()
          }}
        >
          <img className="brand-mark" src={`${import.meta.env.BASE_URL}proviso-logo.png`} alt="" width="32" height="32" />
          proviso<span className="brand-dot">.</span>
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
            <span className="nav-explore-desktop">Explore proposals</span><span className="nav-explore-mobile">Explore</span>
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

        <Notifications key={currentUser?.username ?? 'signed-out'} user={currentUser} proposals={proposals} onSelect={openNotification} />

        <AuthBar
          currentUser={currentUser}
          onAuthenticated={handleAuthenticated}
          onLogout={handleLogout}
        />
      </header>

      {/* Main Workspace Layout */}
      <main className={`workspace ${selectedId ? 'detail-open' : ''} ${mobileShowMap ? 'mobile-map' : ''}`}>
        {/* Sidebar Component */}
        <Sidebar
          sidebarRef={sidebarRef}
          selectedProposal={selectedProposal}
          fullDemo={fullDemo && selectedProposal?.id === LABATT_PROPOSAL_ID}
          demoAvailable={proposals.some(proposal => proposal.id === LABATT_PROPOSAL_ID)}
          onViewVersions={() => openProposal(LABATT_PROPOSAL_ID)}
          onViewReference={() => openProposal(LABATT_PROPOSAL_ID, true)}
          filteredProposals={filteredProposals}
          topics={topics}
          statuses={statuses}
          catalogueCount={proposals.length}
          catalogueState={catalogueState}
          catalogueError={catalogueError}
          onRetryCatalogue={() => setLoadAttempt(attempt => attempt + 1)}
          activeTab={activeTab}
          saved={saved}
          topic={topic}
          setTopic={setTopic}
          query={query}
          setQuery={setQuery}
          status={status}
          setStatus={setStatus}
          onSelectProposal={openProposal}
          onBackToExplorer={showExplorer}
          onClearFilters={clearFilters}
          onToggleFollow={toggleFollow}
          currentUser={currentUser}
          notificationTarget={notificationTarget}
        />

        {/* Map Shell & Outer Map Controls */}
        <section className="map-shell" aria-label="Toronto proposal map">
          <div id="map" ref={mapContainerRef} aria-label="Interactive map showing proposal locations" />
          {citywideResults && (
            <div className="map-citywide-banner" role="status">City wide</div>
          )}
          
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
            </div>

          </div>

          {mapError && (
            <div id="map-error" className="map-error" role="status">
              Map tiles couldn’t load. You can still explore proposals in the list.
            </div>
          )}
        </section>

        {/* Mobile View Toggle */}
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

      {/* Floating Notification Toast */}
      <div id="toast" role="status" className="toast" hidden={!toastMessage}>
        {toastMessage}
      </div>
    </div>
    </ProposalUpdatesProvider>
  )
}
