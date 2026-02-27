import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Status colors matching Dashboard Projects In Progress cards
const STATUS_COLORS = {
  proposal_sent: '#3b82f6',    // blue-500
  proposal_signed: '#06b6d4',  // cyan-500
  contract_sent: '#f59e0b',    // amber-500
  sold: '#10b981',             // emerald-500
}

const IN_PROGRESS_STATUSES = ['contract_sent', 'proposal_sent', 'proposal_signed', 'sold']

const STATUS_LABELS = {
  proposal_sent: 'Proposal Sent',
  proposal_signed: 'Proposal Signed',
  contract_sent: 'Contract Sent',
  sold: 'Sold',
}

function createColoredIcon(color) {
  return L.divIcon({
    className: 'projects-map-marker',
    html: `<div style="
      width: 24px;
      height: 24px;
      background-color: ${color};
      border: 2px solid white;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
  })
}

const LOS_ANGELES = [34.0522, -118.2437]

// Fit map bounds to markers and company center when they load
function FitBounds({ markers, companyCenter }) {
  const map = useMap()

  useEffect(() => {
    const validMarkers = markers.filter((m) => m.lat != null && m.lng != null)
    const points = [...validMarkers.map((m) => [m.lat, m.lng])]
    if (companyCenter) points.push(companyCenter)
    if (points.length === 0) return

    if (points.length === 1) {
      map.setView(points[0], 12)
    } else {
      const bounds = L.latLngBounds(points)
      map.fitBounds(bounds, { padding: [30, 30] })
    }
  }, [map, markers, companyCenter])

  return null
}

async function geocodeAddress(address, retries = 2) {
  if (!address || !address.trim()) return null
  const query = address.trim()
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const params = new URLSearchParams({ query })
      const res = await fetch(`/api/geocode/forward?${params}`)
      if (!res.ok) {
        if (attempt < retries - 1) await new Promise((r) => setTimeout(r, 1000))
        continue
      }
      const data = await res.json()
      if (data.latitude != null && data.longitude != null) {
        return { lat: data.latitude, lng: data.longitude }
      }
    } catch {
      if (attempt < retries - 1) await new Promise((r) => setTimeout(r, 1000))
    }
  }
  return null
}

async function geocodeAllWithThrottle(addresses, delayMs = 200) {
  const results = new Map()
  for (const addr of addresses) {
    const coords = await geocodeAddress(addr)
    results.set(addr, coords)
    await new Promise((r) => setTimeout(r, delayMs))
  }
  return results
}

function ProjectsMap({ projects, companyAddress = '' }) {
  const [markers, setMarkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [geocodeError, setGeocodeError] = useState(false)
  const [companyCenter, setCompanyCenter] = useState(null)

  const inProgressProjects = (projects || []).filter((p) =>
    IN_PROGRESS_STATUSES.includes(p.status)
  )
  const projectsWithAddress = inProgressProjects.filter((p) => p.address?.trim())

  // Geocode company address for map center
  useEffect(() => {
    if (!companyAddress?.trim()) {
      setCompanyCenter(null)
      return
    }
    let cancelled = false
    geocodeAddress(companyAddress).then((coords) => {
      if (!cancelled && coords) {
        setCompanyCenter([coords.lat, coords.lng])
      } else {
        setCompanyCenter(null)
      }
    }).catch(() => setCompanyCenter(null))
    return () => { cancelled = true }
  }, [companyAddress])

  useEffect(() => {
    if (projectsWithAddress.length === 0) {
      setMarkers([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setGeocodeError(false)

    const run = async () => {
      const uniqueAddresses = [...new Set(projectsWithAddress.map((p) => p.address.trim()))]
      const coordsByAddress = await geocodeAllWithThrottle(uniqueAddresses)
      if (cancelled) return

      const valid = projectsWithAddress
        .map((project) => {
          const coords = coordsByAddress.get(project.address.trim())
          if (!coords) return null
          return {
            ...project,
            lat: coords.lat,
            lng: coords.lng,
            color: STATUS_COLORS[project.status] || '#6b7280',
          }
        })
        .filter(Boolean)

      if (!cancelled) {
        setMarkers(valid)
        if (projectsWithAddress.length > 0 && valid.length === 0) setGeocodeError(true)
      }
    }

    run()
      .catch(() => {
        if (!cancelled) setGeocodeError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [JSON.stringify(projectsWithAddress.map((p) => ({ id: p.id, address: p.address })))])

  if (inProgressProjects.length === 0) {
    return (
      <div className="h-96 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
        No projects in progress to display on map
      </div>
    )
  }

  if (geocodeError && markers.length === 0) {
    return (
      <div className="h-96 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
        Unable to load map. Geocoding may not be configured.
      </div>
    )
  }

  if (loading && markers.length === 0) {
    return (
      <div className="h-96 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pool-blue"></div>
      </div>
    )
  }

  if (markers.length === 0) {
    return (
      <div className="h-96 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
        No address coordinates found for projects in progress
      </div>
    )
  }

  // Center: company address (geocoded), or Los Angeles fallback
  const center = companyCenter || LOS_ANGELES

  // Group markers by coordinates (same address = same lat,lng)
  const groupedByLocation = markers.reduce((acc, m) => {
    const key = `${m.lat},${m.lng}`
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})
  const locationGroups = Object.entries(groupedByLocation).map(([key, projects]) => {
    const [lat, lng] = key.split(',').map(Number)
    return { lat, lng, projects }
  })

  const ProjectPopupContent = ({ projectsAtLocation }) => {
    const address = projectsAtLocation[0]?.address
    return (
      <div className="projects-map-popup-content">
        {projectsAtLocation.map((m, idx) => (
          <div key={m.id} className={idx > 0 ? 'mt-3 pt-3 border-t border-gray-200 dark:border-gray-600' : ''}>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Project</p>
            <p className="font-black text-black dark:text-black text-base leading-tight">
              {m.project_name || 'Unnamed Project'}
            </p>
            <span
              className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium text-white"
              style={{ backgroundColor: m.color }}
            >
              {STATUS_LABELS[m.status] || m.status}
            </span>
          </div>
        ))}
        {address && (
          <>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-2 leading-snug">
              {address}
            </p>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-pool-blue hover:text-pool-dark font-medium text-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Open in Google Maps
            </a>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="h-96 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
      <MapContainer
        center={center}
        zoom={10}
        className="h-full w-full"
        style={{ minHeight: 384 }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds markers={markers} companyCenter={companyCenter} />
        {locationGroups.map(({ lat, lng, projects }) => (
          <Marker
            key={`${lat},${lng}`}
            position={[lat, lng]}
            icon={createColoredIcon(projects[0].color)}
          >
            <Popup className="projects-map-popup">
              <ProjectPopupContent projectsAtLocation={projects} />
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-3 py-2 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-600 text-xs">
        {IN_PROGRESS_STATUSES.map((status) => {
          const count = inProgressProjects.filter((p) => p.status === status).length
          if (count === 0) return null
          return (
            <div key={status} className="flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: STATUS_COLORS[status] }}
              />
              <span className="text-gray-600 dark:text-gray-400">
                {STATUS_LABELS[status]}: {count}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ProjectsMap
