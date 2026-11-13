import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './style.css'
import { proposals } from './proposals'
import type { Proposal, Topic } from './proposals'
import { icon } from './icons'

const app = document.querySelector<HTMLDivElement>('#app')!
const topicIcons: Record<Topic, string> = { 'Public space': 'leaf', 'Streets & transit': 'bus', Accessibility: 'access' }
const statusClass = (status: string) => status === 'Open for feedback' ? 'open' : status === 'Updated proposal' ? 'updated' : 'review'
let selectedId: string | null = null
let activeTab = 'explore'
let topic = 'All topics'
let query = ''
let status = 'all'
let saved: string[] = []
try {
  const stored: unknown = JSON.parse(localStorage.getItem('civic-saved') ?? '[]')
  if (Array.isArray(stored)) saved = stored.filter((id): id is string => typeof id === 'string' && proposals.some(p => p.id === id))
} catch { /* The map works even when browser storage is unavailable. */ }

app.innerHTML = `
  <header class="app-header">
    <a class="brand" href="#" aria-label="Civic home"><span class="brand-mark">${icon('layers')}</span>civic<span class="brand-dot">.</span></a>
    <nav class="main-nav" aria-label="Main navigation">
      <button class="nav-item active" data-nav="explore">Explore proposals</button>
      <button class="nav-item" data-nav="saved">${icon('bookmark')}<span>Following</span><span id="saved-count">${saved.length}</span></button>
    </nav>
    <span class="header-location">${icon('pin')} Toronto, Ontario</span>
    <button class="about-button" id="about-button">About this project ${icon('external')}</button>
  </header>
  <main class="workspace">
    <aside class="sidebar" aria-label="Proposal explorer">
      <div id="explorer">
        <div class="sidebar-heading"><span class="eyebrow">YOUR NEIGHBOURHOOD. YOUR VOICE.</span><h1>Change starts <br>close to home.</h1><p>Discover what’s proposed. Share what matters to you.</p></div>
        <div class="search-wrap">${icon('search')}<input id="search" type="search" placeholder="Search proposals or neighbourhoods" aria-label="Search proposals or neighbourhoods" autocomplete="off"></div>
        <div class="topic-filters" aria-label="Filter by topic">${['All topics', 'Public space', 'Streets & transit', 'Accessibility'].map(t => `<button class="topic-chip ${t === topic ? 'active' : ''}" data-topic="${t}" aria-pressed="${t === topic}">${t}</button>`).join('')}</div>
        <div class="results-toolbar"><span id="result-count" aria-live="polite"></span><label class="status-filter"><span class="sr-only">Filter by status</span><select id="status"><option value="all">All statuses</option><option>Open for feedback</option><option>Updated proposal</option><option>Under review</option></select></label></div>
        <div id="proposal-list" class="proposal-list"></div>
        <div class="demo-note">${icon('info')}<p>A preview of local participation. Project references are real; statuses, locations and interactions are illustrative.</p></div>
      </div>
      <div id="proposal-detail" hidden></div>
      <footer class="sidebar-footer"><span>Small contributions. Shared possibilities.</span><span class="footer-flower">✳</span></footer>
    </aside>
    <section class="map-shell" aria-label="Toronto proposal map">
      <div id="map" aria-label="Interactive map showing proposal locations"></div>
      <div class="map-controls-stack">
        <div class="map-tools" role="toolbar" aria-label="Map controls">
          <button id="zoom-in" aria-label="Zoom in" title="Zoom in">${icon('plus')}</button>
          <span class="tool-divider" aria-hidden="true"></span>
          <button id="zoom-out" aria-label="Zoom out" title="Zoom out">${icon('minus')}</button>
          <span class="tool-divider" aria-hidden="true"></span>
          <button id="reset-map" aria-label="Show all matching proposals" title="Show all matching proposals">${icon('target')}</button>
        </div>
        <div class="map-legend" aria-label="Proposal status legend">
          <span class="legend-title">PROPOSAL STATUS</span>
          <span><i class="legend-dot open"></i>Open for feedback</span>
          <span><i class="legend-dot updated"></i>Updated proposal</span>
          <span><i class="legend-dot review"></i>Under review</span>
        </div>
      </div>
      <div id="map-error" class="map-error" role="status" hidden>Map tiles couldn’t load. You can still explore proposals in the list.</div>
    </section>
    <button id="mobile-toggle" class="mobile-toggle">${icon('pin')} Show map</button>
  </main>
  <dialog id="info-dialog" aria-labelledby="dialog-title"><div id="dialog-content"></div><button class="dialog-close icon-button" aria-label="Close dialog">${icon('close')}</button></dialog>
  <div id="toast" role="status" class="toast" hidden></div>
`

const map = L.map('map', { zoomControl: false, scrollWheelZoom: true, minZoom: 10, maxZoom: 18 }).setView([43.658, -79.398], 13)
map.attributionControl?.setPosition('bottomleft')
const tiles = L.tileLayer(import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: import.meta.env.VITE_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
}).addTo(map)
tiles.on('tileerror', () => { document.querySelector<HTMLElement>('#map-error')!.hidden = false })
tiles.on('tileload', () => { document.querySelector<HTMLElement>('#map-error')!.hidden = true })
const markerLayer = L.layerGroup().addTo(map)
const projectLayer = L.layerGroup().addTo(map)
const colors = { open: '#397360', updated: '#be6739', review: '#79828b' }

function filteredProposals(): Proposal[] {
  const term = query.trim().toLocaleLowerCase()
  return proposals.filter(p =>
    (activeTab !== 'saved' || saved.includes(p.id)) &&
    (topic === 'All topics' || p.topic === topic) &&
    (status === 'all' || p.status === status) &&
    `${p.title} ${p.neighbourhood} ${p.topic}`.toLocaleLowerCase().includes(term))
}

function renderMarkers() {
  markerLayer.clearLayers()
  filteredProposals().forEach(p => {
    const marker = L.marker(p.coordinates, {
      icon: L.divIcon({ className: 'proposal-marker-wrap', html: `<span class="proposal-marker ${statusClass(p.status)} ${selectedId === p.id ? 'selected' : ''}">${icon(topicIcons[p.topic])}</span>`, iconSize: [46, 54], iconAnchor: [23, 50] }),
      title: p.title, alt: `${p.title}, ${p.status}`, keyboard: true,
    }).addTo(markerLayer)
    marker.bindTooltip(p.title, { direction: 'top', offset: [0, -44], className: 'proposal-tooltip' })
    marker.on('click', () => openProposal(p.id))
  })
}

function renderList() {
  const matching = filteredProposals()
  document.querySelector('#result-count')!.textContent = `${matching.length} ${activeTab === 'saved' ? 'followed ' : ''}proposal${matching.length === 1 ? '' : 's'}`
  document.querySelector('#proposal-list')!.innerHTML = matching.length ? matching.map(p => `
    <button class="proposal-card" data-proposal="${p.id}">
      <div class="card-top"><span class="status-badge ${statusClass(p.status)}"><i></i>${p.status}</span><span class="card-category">${icon(topicIcons[p.topic])}</span></div>
      <h2>${p.title}</h2><p class="card-neighbourhood">${icon('pin')}${p.neighbourhood}</p>
      <p class="card-summary">${p.summary}</p>
      <div class="card-footer"><span>${p.topic}</span><span class="card-cta">Explore proposal ${icon('arrow')}</span></div>
    </button>`).join('') : `<div class="empty-state">${icon(activeTab === 'saved' ? 'bookmark' : 'search')}<h2>${activeTab === 'saved' && !saved.length ? 'Keep a place in mind.' : 'No matching proposals'}</h2><p>${activeTab === 'saved' && !saved.length ? 'Open a proposal and follow it to find it here.' : 'Try another search or clear your filters.'}</p><button id="clear-filters" class="text-button">Clear filters</button></div>`
  document.querySelectorAll<HTMLButtonElement>('[data-proposal]').forEach(button => button.addEventListener('click', () => openProposal(button.dataset.proposal!)))
  document.querySelector('#clear-filters')?.addEventListener('click', clearFilters)
  renderMarkers()
}

let resizeRaf: number | null = null
function animateMapResize(onComplete?: () => void, targetCoords?: [number, number]) {
  if (resizeRaf) cancelAnimationFrame(resizeRaf)
  const startTime = performance.now()
  const duration = 340
  const zoom = targetCoords ? (window.innerWidth < 1200 ? 14 : 15) : map.getZoom()

  function step(now: number) {
    const elapsed = now - startTime
    map.invalidateSize({ pan: false })
    if (targetCoords) {
      map.setView(targetCoords, zoom, { animate: false })
    }
    if (elapsed < duration) {
      resizeRaf = requestAnimationFrame(step)
    } else {
      resizeRaf = null
      map.invalidateSize()
      onComplete?.()
    }
  }
  resizeRaf = requestAnimationFrame(step)
}

function showExplorer() {
  selectedId = null
  const workspace = document.querySelector('.workspace')!
  const wasOpen = workspace.classList.contains('detail-open')
  workspace.classList.remove('detail-open')
  document.querySelector<HTMLElement>('#explorer')!.hidden = false
  document.querySelector<HTMLElement>('#proposal-detail')!.hidden = true
  projectLayer.clearLayers()
  renderList()
  document.querySelector('.sidebar')!.scrollTop = 0
  if (wasOpen) {
    animateMapResize(() => {
      fitResults()
    })
  } else {
    fitResults()
  }
}

function openProposal(id: string) {
  const p = proposals.find(p => p.id === id)
  if (!p) return
  selectedId = id
  document.querySelector<HTMLElement>('#explorer')!.hidden = true
  const detail = document.querySelector<HTMLElement>('#proposal-detail')!
  detail.hidden = false
  detail.innerHTML = `
    <button class="back-button" id="back-to-list">${icon('back')} Back to proposals</button>
    <div class="detail-kicker"><span class="status-badge ${statusClass(p.status)}"><i></i>${p.status}</span><span class="demo-tag">DEMO STATUS</span></div>
    <div class="detail-topic">${icon(topicIcons[p.topic])}${p.topic}</div>
    <h1 tabindex="-1" id="detail-title">${p.title}</h1><p class="card-neighbourhood">${icon('pin')}${p.neighbourhood}</p>
    <p class="detail-summary">${p.summary}</p>
    <button class="follow-button ${saved.includes(id) ? 'following' : ''}" id="follow-button" aria-pressed="${saved.includes(id)}">${icon(saved.includes(id) ? 'check' : 'bookmark')}${saved.includes(id) ? 'Following this proposal' : 'Follow this proposal'}</button>
    <div class="detail-tabs" role="tablist" aria-label="Proposal information"><button id="tab-overview" role="tab" aria-selected="true" aria-controls="detail-content" tabindex="0" data-detail-tab="overview">Overview</button><button id="tab-feedback" role="tab" aria-selected="false" aria-controls="detail-content" tabindex="-1" data-detail-tab="feedback">Community</button><button id="tab-updates" role="tab" aria-selected="false" aria-controls="detail-content" tabindex="-1" data-detail-tab="updates">Updates</button></div>
    <div id="detail-content" role="tabpanel" aria-labelledby="tab-overview"></div>
    <div class="detail-disclaimer">${icon('info')}<p>Prototype preview. Summary and highlighted route are illustrative. Check the official project page for boundaries, current plans and participation dates.</p></div>
    <a class="source-link" href="${p.source}" target="_blank" rel="noopener noreferrer">View official project page ${icon('external')}</a>
  `
  document.querySelector('#back-to-list')!.addEventListener('click', showExplorer)
  document.querySelector('#follow-button')!.addEventListener('click', () => {
    saved = saved.includes(id) ? saved.filter(item => item !== id) : [...saved, id]
    let persisted = true
    try { localStorage.setItem('civic-saved', JSON.stringify(saved)) } catch { persisted = false }
    document.querySelector('#saved-count')!.textContent = String(saved.length)
    const button = document.querySelector<HTMLButtonElement>('#follow-button')!
    button.innerHTML = `${icon(saved.includes(id) ? 'check' : 'bookmark')}${saved.includes(id) ? 'Following this proposal' : 'Follow this proposal'}`
    button.classList.toggle('following', saved.includes(id))
    button.setAttribute('aria-pressed', String(saved.includes(id)))
    toast(persisted ? (saved.includes(id) ? 'Added to Following on this device. No notifications are sent.' : 'Removed from Following.') : 'Updated for this visit. Browser storage is unavailable.')
  })
  const tabs = [...document.querySelectorAll<HTMLButtonElement>('[data-detail-tab]')]
  function selectDetailTab(button: HTMLButtonElement) {
    tabs.forEach(tab => { tab.setAttribute('aria-selected', String(tab === button)); tab.tabIndex = tab === button ? 0 : -1 })
    document.querySelector('#detail-content')!.setAttribute('aria-labelledby', button.id)
    renderDetailContent(p!, button.dataset.detailTab!)
  }
  tabs.forEach((button, index) => {
    button.addEventListener('click', () => selectDetailTab(button))
    button.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      const next = event.key === 'Home' ? tabs[0]! : event.key === 'End' ? tabs[tabs.length - 1]! : tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]!
      next.focus(); selectDetailTab(next)
    })
  })
  renderDetailContent(p, 'overview')
  projectLayer.clearLayers()
  L.polyline(p.shape, { color: colors[statusClass(p.status)], weight: 20, opacity: 0.13, lineCap: 'round' }).addTo(projectLayer)
  L.polyline(p.shape, { color: colors[statusClass(p.status)], weight: 4, opacity: 0.85, dashArray: '7 7' }).addTo(projectLayer)
  renderMarkers()

  const workspace = document.querySelector('.workspace')!
  const wasOpen = workspace.classList.contains('detail-open')
  workspace.classList.add('detail-open')

  const targetZoom = window.innerWidth < 1200 ? 14 : 15
  if (!wasOpen) {
    animateMapResize(() => {
      map.flyTo(p.coordinates, targetZoom, { duration: 0.25 })
    }, p.coordinates)
  } else {
    map.flyTo(p.coordinates, targetZoom, { duration: 0.5 })
  }

  // On a phone, a map selection opens the readable proposal panel.
  setMobileView(false)
  document.querySelector('.sidebar')!.scrollTop = 0
  document.querySelector<HTMLElement>('#detail-title')!.focus({ preventScroll: true })
}

function renderDetailContent(p: Proposal, tab: string) {
  const content = document.querySelector('#detail-content')!
  if (tab === 'overview') content.innerHTML = `<h2>What’s being considered</h2><ul class="changes-list">${p.changes.map(change => `<li>${icon('check')}<span>${change}</span></li>`).join('')}</ul><div class="participation-card"><span class="eyebrow">MAKE IT WORK FOR YOU</span><h3>What would make a difference?</h3><p>Your everyday experience is part of the bigger picture.</p><button class="primary-button" id="preview-feedback">Preview giving feedback ${icon('arrow')}</button></div>`
  else if (tab === 'feedback') content.innerHTML = `<div class="placeholder-content">${icon('message')}<h2>Every perspective adds something.</h2><p>This space will bring together participants’ concerns and conditions. Community feedback isn’t connected in this prototype.</p><button class="primary-button" id="preview-feedback">Preview giving feedback ${icon('arrow')}</button></div>`
  else content.innerHTML = `<div class="placeholder-content">${icon('layers')}<h2>Follow the next chapter.</h2><p>Proposal revisions and changes will appear here. No revision history or notifications are connected yet.</p></div>`
  document.querySelector('#preview-feedback')?.addEventListener('click', () => openDialog(`<span class="eyebrow">INTERACTION PREVIEW</span><h2 id="dialog-title">A voice in what comes next.</h2><p>This is where you’ll share your position on “${p.title}” and explain what would make it work for you.</p><div class="preview-example"><strong>For example</strong><p>“I’d support this if accessible pickup stays near the entrance in the evening.”</p></div><p class="dialog-footnote">The feedback form is the next stage. Nothing is collected or submitted in this preview.</p>`))
}

function clearFilters() {
  query = ''; topic = 'All topics'; status = 'all'
  document.querySelector<HTMLInputElement>('#search')!.value = ''
  document.querySelector<HTMLSelectElement>('#status')!.value = 'all'
  updateTopicButtons(); renderList(); fitResults()
}
function updateTopicButtons() {
  document.querySelectorAll<HTMLButtonElement>('[data-topic]').forEach(button => {
    const active = button.dataset.topic === topic
    button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active))
  })
}
function fitResults() {
  const matching = filteredProposals()
  if (matching.length) map.fitBounds(L.latLngBounds(matching.map(p => p.coordinates)), { padding: [70, 95], maxZoom: 14 })
}
const dialog = document.querySelector<HTMLDialogElement>('#info-dialog')!
function openDialog(content: string) {
  document.querySelector('#dialog-content')!.innerHTML = content
  dialog.showModal()
}
let toastTimer: ReturnType<typeof setTimeout>
function toast(message: string) {
  const el = document.querySelector<HTMLElement>('#toast')!
  el.textContent = message; el.hidden = false
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { el.hidden = true }, 4500)
}
function setMobileView(showMap: boolean) {
  document.querySelector('.workspace')!.classList.toggle('mobile-map', showMap)
  document.querySelector('#mobile-toggle')!.innerHTML = `${icon(showMap ? 'list' : 'pin')} ${showMap ? 'Show proposals' : 'Show map'}`
  requestAnimationFrame(() => map.invalidateSize())
}
document.querySelector('#mobile-toggle')!.addEventListener('click', () => setMobileView(!document.querySelector('.workspace')!.classList.contains('mobile-map')))
document.querySelector('#search')!.addEventListener('input', event => { query = (event.target as HTMLInputElement).value; renderList() })
document.querySelector('#status')!.addEventListener('change', event => { status = (event.target as HTMLSelectElement).value; renderList(); fitResults() })
document.querySelectorAll<HTMLButtonElement>('[data-topic]').forEach(button => button.addEventListener('click', () => { topic = button.dataset.topic!; updateTopicButtons(); renderList(); fitResults() }))
document.querySelectorAll<HTMLButtonElement>('[data-nav]').forEach(button => button.addEventListener('click', () => {
  activeTab = button.dataset.nav!
  document.querySelectorAll('[data-nav]').forEach(item => item.classList.toggle('active', item === button))
  showExplorer(); fitResults(); setMobileView(false)
}))
document.querySelector('.brand')!.addEventListener('click', event => { event.preventDefault(); document.querySelector<HTMLButtonElement>('[data-nav="explore"]')!.click(); clearFilters() })
document.querySelector('#zoom-in')!.addEventListener('click', () => map.zoomIn())
document.querySelector('#zoom-out')!.addEventListener('click', () => map.zoomOut())
document.querySelector('#reset-map')!.addEventListener('click', () => { showExplorer(); fitResults() })
document.querySelector('#about-button')!.addEventListener('click', () => openDialog(`<span class="eyebrow">BUILT FOR CIVIC HACK 2026</span><h2 id="dialog-title">The city is a shared project.</h2><p>Civic explores a simple idea: people should be able to explain what would make a municipal proposal work for them, and follow what changes next.</p><p>This prototype demonstrates discovery and navigation using three real Toronto project references. Descriptions, marker locations, highlighted routes and statuses are illustrative.</p><div class="preview-example"><strong>Your browser, your shortlist.</strong><p>Following is saved only on this device. No accounts, submissions or notifications are connected.</p></div>`))
document.querySelector('.dialog-close')!.addEventListener('click', () => dialog.close())
dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close() } })
const resizeObserver = new ResizeObserver(() => map.invalidateSize())
resizeObserver.observe(document.querySelector('#map')!)
renderList()
fitResults()
