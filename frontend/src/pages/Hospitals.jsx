import React, { useState, useEffect, useRef } from "react"
import { useSearchParams, Link } from "react-router-dom"
import { api } from "../services/api"
import { Search, MapPin, Building, Eye, Loader, CheckCircle, Navigation, Compass } from "lucide-react"

// Default fallback location (Lucknow, Uttar Pradesh coordinates)
const DEFAULT_LAT = 26.8467
const DEFAULT_LNG = 80.9462

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
  const [errorMsg, setErrorMsg] = useState("")

  // Dynamic user location state (Defaults to UP)
  const [userCoords, setUserCoords] = useState({ lat: DEFAULT_LAT, lng: DEFAULT_LNG })

  // Filter states
  const [city, setCity] = useState(searchParams.get("city") || "")
  const [state, setState] = useState(searchParams.get("state") || "")
  const [type, setType] = useState(searchParams.get("type") || "")

  // Interactive Map states
  const [hoveredHospitalId, setHoveredHospitalId] = useState(null)
  const [selectedHospitalId, setSelectedHospitalId] = useState(null)
  const cardRefs = useRef({})

  // Request browser geolocation on load
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserCoords({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          })
        },
        (error) => {
          console.log("Geolocation access denied or failed, using UP fallback coordinates.")
        }
      )
    }
  }, [])

  const fetchHospitals = async () => {
    setLoading(true)
    setErrorMsg("")
    try {
      const params = new URLSearchParams()
      if (city) params.append("city", city)
      if (state) params.append("state", state)
      if (type) params.append("hospital_type", type)

      const response = await api.get(`/api/v1/hospital/?${params.toString()}`)
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || "Failed to load hospital records from server.")
      }

      const data = await response.json()
      
      // Enrich data with coordinates fallback if not present in DB
      const enriched = data.map((hosp, idx) => {
        let lat = hosp.latitude
        let lng = hosp.longitude
        if (!lat || !lng) {
          // Assign coordinate offsets near user reference for visual plotting
          lat = userCoords.lat + 0.015 * Math.sin(idx * 1.5)
          lng = userCoords.lng + 0.015 * Math.cos(idx * 1.5)
        }
        const dist = getDistance(userCoords.lat, userCoords.lng, lat, lng)
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
    } catch (error) {
      console.error("Failed to load hospitals:", error)
      setErrorMsg(error.message || "Failed to contact search service.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHospitals()
  }, [searchParams, userCoords])

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

  const mapRef = useRef(null)
  const leafletMapInstance = useRef(null)
  const markersRef = useRef([])

  useEffect(() => {
    // 1. Initialize Leaflet map if it hasn't been initialized yet
    if (mapRef.current && window.L) {
      if (!leafletMapInstance.current) {
        leafletMapInstance.current = window.L.map(mapRef.current).setView([userCoords.lat, userCoords.lng], 12)
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(leafletMapInstance.current)
      } else {
        leafletMapInstance.current.setView([userCoords.lat, userCoords.lng])
      }
    }

    // 2. Clear old markers
    if (window.L && leafletMapInstance.current) {
      markersRef.current.forEach(marker => marker.remove())
      markersRef.current = []

      // 3. Add new markers for hospitals
      const points = []
      
      // Add user location circle marker
      const userMarker = window.L.circleMarker([userCoords.lat, userCoords.lng], {
        radius: 8,
        fillColor: "#6366f1",
        color: "#ffffff",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
      })
      .addTo(leafletMapInstance.current)
      .bindPopup("<b>Your Location</b>")
      
      markersRef.current.push(userMarker)
      points.push([userCoords.lat, userCoords.lng])

      hospitals.forEach(h => {
        if (h.latitude && h.longitude) {
          const marker = window.L.marker([h.latitude, h.longitude])
            .addTo(leafletMapInstance.current)
            .bindPopup(`<b>${h.name}</b><br/>${h.hospital_type} Facility<br/><a href="/hospitals/${h.id}" style="color: #4f46e5; font-weight: bold; text-decoration: underline;">View Beds</a>`)
          
          markersRef.current.push(marker)
          points.push([h.latitude, h.longitude])
        }
      })

      // 4. Adjust map view to fit all markers dynamically
      if (points.length > 1) {
        leafletMapInstance.current.fitBounds(points, { padding: [50, 50] })
      } else {
        leafletMapInstance.current.setView([userCoords.lat, userCoords.lng], 12)
      }
    }
  }, [hospitals, userCoords])

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
            <option value="GOVERNMENT">Government (Public)</option>
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
      ) : errorMsg ? (
        <div className="text-center py-20 glass-panel rounded-3xl border border-rose-100 bg-rose-50/10">
          <ShieldAlert className="h-10 w-10 text-rose-500 mx-auto mb-4" />
          <p className="text-rose-600 font-medium">{errorMsg}</p>
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

          {/* Stylized Interactive Map */}
          <div className="glass-panel p-6 rounded-3xl shadow-sm border border-slate-100 sticky top-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-slate-800 flex items-center gap-1.5">
                <Compass className="h-5 w-5 text-brand-500" />
                <span>Interactive Coverage Map</span>
              </h3>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Live OpenStreetMap
              </span>
            </div>

            {/* Leaflet Map DOM Target */}
            <div 
              ref={mapRef} 
              className="w-full aspect-square rounded-2xl border border-slate-200/60 overflow-hidden shadow-md z-10" 
              style={{ minHeight: "350px" }}
            />
            
            <p className="text-[10px] text-slate-400 font-light mt-3 text-center">
              * Drag the map to navigate, click markers to view facility details and bed availability links.
            </p>
          </div>

        </div>
      )}
    </div>
  )
}
export default Hospitals
