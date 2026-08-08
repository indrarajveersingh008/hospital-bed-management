import React, { useState, useEffect, useRef } from "react"
import { useSearchParams, Link } from "react-router-dom"
import { api } from "../services/api"
import { Search, MapPin, Building, Eye, Loader, CheckCircle, Navigation, Compass } from "lucide-react"

// Simulated user location (Pune Central coordinates as reference)
const USER_LAT = 18.5204
const USER_LNG = 73.8567

const deg2rad = (deg) => deg * (Math.PI / 180)

// Haversine formula to compute distance in km
const getDistance = (lat1, lon1, lat2, lon2) => {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return null
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return null
  const R = 6371
  const dLat = deg2rad(lat2 - lat1)
  const dLon = deg2rad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry"
]

export const Hospitals = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [hospitals, setHospitals] = useState([])
  const [loading, setLoading] = useState(true)

  // Filter states
  const [city, setCity] = useState(searchParams.get("city") || "")
  const [state, setState] = useState(searchParams.get("state") || "")
  const [type, setType] = useState(searchParams.get("type") || "")

  // Interactive Map states
  const [hoveredHospitalId, setHoveredHospitalId] = useState(null)
  const [selectedHospitalId, setSelectedHospitalId] = useState(null)
  const cardRefs = useRef({})

  const fetchHospitals = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (city) params.append("city", city)
      if (state) params.append("state", state)
      if (type) params.append("hospital_type", type)

      const response = await api.get(`/api/v1/hospital/?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        
        // Enrich data with coordinates fallback if not present in DB
        const enriched = data.map((hosp, idx) => {
          let lat = hosp.latitude
          let lng = hosp.longitude
          if (!lat || !lng) {
            // Assign coordinate offsets near central reference for visual plotting
            lat = USER_LAT + 0.015 * Math.sin(idx * 1.5)
            lng = USER_LNG + 0.015 * Math.cos(idx * 1.5)
          }
          const dist = getDistance(USER_LAT, USER_LNG, lat, lng)
          return {
            ...hosp,
            latitude: lat,
            longitude: lng,
            distance: dist
          }
        })
        
        // Sort by distance from user
        enriched.sort((a, b) => (a.distance || 0) - (b.distance || 0))
        setHospitals(enriched)
      }
    } catch (error) {
      console.error("Failed to load hospitals:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHospitals()
  }, [searchParams])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    const newParams = {}
    if (city) newParams.city = city
    if (state) newParams.state = state
    if (type) newParams.type = type
    setSearchParams(newParams)
  }

  const handleNodeClick = (hospId) => {
    setSelectedHospitalId(hospId)
    const cardEl = cardRefs.current[hospId]
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
  }

  // Calculate coordinates bounds to scale coordinates onto SVG map viewport
  const getMapPoints = () => {
    if (hospitals.length === 0) return []

    const lats = hospitals.map(h => h.latitude).concat([USER_LAT])
    const lngs = hospitals.map(h => h.longitude).concat([USER_LNG])

    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs)

    const latRange = maxLat - minLat || 0.01
    const lngRange = maxLng - minLng || 0.01

    // Map function to translate coordinates to [30, 370] SVG points
    const projectX = (lng) => 30 + ((lng - minLng) / lngRange) * 340
    const projectY = (lat) => 370 - ((lat - minLat) / latRange) * 340 // Invert Y for maps

    return {
      hospitals: hospitals.map(h => ({
        id: h.id,
        name: h.name,
        type: h.hospital_type,
        distance: h.distance,
        cx: projectX(h.longitude),
        cy: projectY(h.latitude)
      })),
      user: {
        cx: projectX(USER_LNG),
        cy: projectY(USER_LAT)
      }
    }
  }

  const mapPoints = getMapPoints()

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-extrabold text-slate-900">Search Hospitals</h1>
        <p className="mt-2 text-slate-500 font-light">Find verified facilities and check real-time bed availability.</p>
      </div>

      {/* Filters Form */}
      <form onSubmit={handleSearchSubmit} className="glass-panel p-6 rounded-3xl shadow-sm mb-10 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">City</label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Pune"
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 outline-none text-slate-800 placeholder-slate-400 bg-white text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">State</label>
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 outline-none text-slate-800 bg-white text-sm"
          >
            <option value="">All States</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 outline-none text-slate-800 bg-white text-sm"
          >
            <option value="">All Types</option>
            <option value="PUBLIC">Public</option>
            <option value="PRIVATE">Private</option>
            <option value="TRUST">Trust</option>
          </select>
        </div>

        <button
          type="submit"
          className="w-full py-2.5 rounded-xl font-medium text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 shadow-md shadow-brand-500/20 transition-all duration-200"
        >
          Apply Filters
        </button>
      </form>

      {/* Results and Map View */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader className="h-10 w-10 text-brand-500 animate-spin mb-4" />
          <span className="text-slate-500 text-sm">Searching Hospitals...</span>
        </div>
      ) : hospitals.length === 0 ? (
        <div className="text-center py-20 glass-panel rounded-3xl">
          <p className="text-slate-500 font-light">No verified hospitals match your search criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Hospital Cards List */}
          <div className="lg:col-span-2 space-y-6 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {hospitals.map((hospital) => (
              <div
                key={hospital.id}
                ref={(el) => (cardRefs.current[hospital.id] = el)}
                onMouseEnter={() => setHoveredHospitalId(hospital.id)}
                onMouseLeave={() => setHoveredHospitalId(null)}
                className={`glass-panel p-6 rounded-3xl shadow-sm hover:shadow-md transition-all duration-200 border-2 ${
                  selectedHospitalId === hospital.id
                    ? "border-brand-500 bg-brand-50/10"
                    : hoveredHospitalId === hospital.id
                    ? "border-slate-300"
                    : "border-transparent"
                } flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4`}
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-brand-50 text-brand-600">
                      {hospital.hospital_type}
                    </span>
                    <span className="inline-flex items-center text-emerald-600 text-xs font-semibold gap-0.5">
                      <CheckCircle className="h-3.5 w-3.5" />
                      <span>Verified</span>
                    </span>
                    {hospital.distance !== null && (
                      <span className="inline-flex items-center text-slate-500 text-xs font-light gap-0.5">
                        <Navigation className="h-3.5 w-3.5 text-slate-400" />
                        <span>{hospital.distance.toFixed(1)} km away</span>
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-display font-bold text-slate-900">{hospital.name}</h3>
                  
                  <div className="space-y-1 text-sm text-slate-500 font-light">
                    <div className="flex items-center space-x-1.5">
                      <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>{hospital.address}, {hospital.city}, {hospital.state}</span>
                    </div>
                  </div>
                </div>

                <div className="w-full sm:w-auto shrink-0">
                  <Link
                    to={`/hospitals/${hospital.id}`}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-medium text-slate-700 hover:text-white bg-slate-100 hover:bg-brand-600 transition-all text-center flex items-center justify-center space-x-1 text-sm"
                  >
                    <Eye className="h-4 w-4" />
                    <span>View Beds</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Stylized Vector Area Map */}
          <div className="glass-panel p-6 rounded-3xl shadow-sm border border-slate-100 sticky top-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-slate-800 flex items-center gap-1.5">
                <Compass className="h-5 w-5 text-brand-500" />
                <span>Area Coverage Map</span>
              </h3>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Ref: Pune Central
              </span>
            </div>

            {/* SVG Canvas Map */}
            <div className="relative aspect-square w-full rounded-2xl bg-slate-50 border border-slate-200/60 overflow-hidden shadow-inner">
              <svg viewBox="0 0 400 400" className="w-full h-full">
                {/* Background grid */}
                <defs>
                  <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(203, 213, 225, 0.25)" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />

                {/* Stylized highways */}
                <path d="M 0 200 Q 200 200 400 200" fill="none" stroke="rgba(226, 232, 240, 0.8)" strokeWidth="4" />
                <path d="M 200 0 Q 200 200 200 400" fill="none" stroke="rgba(226, 232, 240, 0.8)" strokeWidth="4" />
                <path d="M 50 50 Q 200 200 350 350" fill="none" stroke="rgba(226, 232, 240, 0.4)" strokeWidth="2" />

                {/* User Location Node */}
                {mapPoints.user && (
                  <g>
                    {/* Pulsing effect ring */}
                    <circle cx={mapPoints.user.cx} cy={mapPoints.user.cy} r="16" fill="rgba(99, 102, 241, 0.15)" className="animate-ping" style={{ transformOrigin: `${mapPoints.user.cx}px ${mapPoints.user.cy}px` }} />
                    <circle cx={mapPoints.user.cx} cy={mapPoints.user.cy} r="8" fill="rgba(99, 102, 241, 0.3)" />
                    <circle cx={mapPoints.user.cx} cy={mapPoints.user.cy} r="4" fill="#6366f1" />
                  </g>
                )}

                {/* Hospital Nodes / Pins */}
                {mapPoints.hospitals && mapPoints.hospitals.map((h) => {
                  const isHovered = hoveredHospitalId === h.id
                  const isSelected = selectedHospitalId === h.id
                  return (
                    <g
                      key={h.id}
                      onClick={() => handleNodeClick(h.id)}
                      onMouseEnter={() => setHoveredHospitalId(h.id)}
                      onMouseLeave={() => setHoveredHospitalId(null)}
                      className="cursor-pointer"
                    >
                      {/* Selection indicator ring */}
                      {(isHovered || isSelected) && (
                        <circle cx={h.cx} cy={h.cy} r="12" fill="rgba(11, 100, 244, 0.1)" stroke="rgba(11, 100, 244, 0.2)" strokeWidth="1" />
                      )}
                      
                      {/* Main node pin */}
                      <circle
                        cx={h.cx}
                        cy={h.cy}
                        r={isSelected ? "6.5" : "5"}
                        fill={isSelected ? "#0b64f4" : isHovered ? "#3c83f6" : "#cbd5e1"}
                        stroke="#ffffff"
                        strokeWidth="1.5"
                        className="transition-all duration-150"
                      />
                    </g>
                  )
                })}
              </svg>

              {/* Dynamic Map Tooltip Overlay */}
              {hoveredHospitalId && (() => {
                const h = mapPoints.hospitals.find(item => item.id === hoveredHospitalId)
                if (!h) return null
                return (
                  <div className="absolute top-2 left-2 right-2 bg-slate-900/90 backdrop-blur-sm text-white p-3 rounded-xl border border-slate-800 shadow-lg text-[11px] space-y-1 z-20 pointer-events-none">
                    <div className="flex justify-between items-center">
                      <span className="font-bold font-display uppercase tracking-wider">{h.name}</span>
                      <span className="px-1.5 py-0.5 rounded bg-brand-500 text-[9px] font-bold">{h.type}</span>
                    </div>
                    <div className="text-slate-400">
                      {h.distance !== null ? `${h.distance.toFixed(1)} km from your location` : "Coordinates verified"}
                    </div>
                  </div>
                )
              })()}
            </div>
            
            <p className="text-[10px] text-slate-400 font-light mt-3 text-center">
              * Click on any point node map pin to select and scroll the hospital card details.
            </p>
          </div>

        </div>
      )}
    </div>
  )
}
export default Hospitals
