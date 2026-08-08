import React, { useState, useEffect, useRef } from "react"
import { useParams, Link } from "react-router-dom"
import { api } from "../services/api"
import { useAuth } from "../context/AuthContext"
import { MapPin, Phone, Mail, FileText, AlertTriangle, Loader, CheckCircle, RefreshCw } from "lucide-react"

export const HospitalDetails = () => {
  const { hospitalId } = useParams()
  const { user } = useAuth()
  
  const [hospital, setHospital] = useState(null)
  const [beds, setBeds] = useState([])
  const [loading, setLoading] = useState(true)
  const [wsConnected, setWsConnected] = useState(false)

  // Report Form Modal states
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportReason, setReportReason] = useState("INCORRECT_AVAILABILITY")
  const [reportDesc, setReportDesc] = useState("")
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [reportSuccess, setReportSuccess] = useState(false)
  const [reportError, setReportError] = useState("")

  const socketRef = useRef(null)

  const fetchDetails = async () => {
    try {
      const hospitalResponse = await api.get(`/api/v1/hospital/${hospitalId}`)
      if (hospitalResponse.ok) {
        const data = await hospitalResponse.json()
        setHospital(data)
      }

      const bedsResponse = await api.get(`/api/v1/hospital/${hospitalId}/beds`)
      if (bedsResponse.ok) {
        const data = await bedsResponse.json()
        setBeds(data)
      }
    } catch (err) {
      console.error("Error fetching hospital details:", err)
    } finally {
      setLoading(false)
    }
  }

  // Initialize data and WebSocket
  useEffect(() => {
    fetchDetails()

    // Setup real-time WebSocket connection
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const host = window.location.host
    const wsUrl = `${protocol}//${host}/ws/hospitals/${hospitalId}`

    const connectWebSocket = () => {
      const socket = new WebSocket(wsUrl)
      socketRef.current = socket

      socket.onopen = () => {
        console.log("WebSocket connected to", wsUrl)
        setWsConnected(true)
      }

      socket.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data)
          if (payload.event === "BED_AVAILABILITY_UPDATED") {
            const updatedData = payload.data
            // Update beds state with new numbers in real-time
            setBeds((prevBeds) =>
              prevBeds.map((bed) =>
                bed.id === updatedData.id ? { ...bed, ...updatedData } : bed
              )
            )
          }
        } catch (e) {
          console.error("Error reading WebSocket payload:", e)
        }
      }

      socket.onclose = () => {
        console.log("WebSocket closed")
        setWsConnected(false)
        // Auto-reconnect after 3 seconds
        setTimeout(() => {
          if (socketRef.current === socket) {
            connectWebSocket()
          }
        }, 3000)
      }

      socket.onerror = (err) => {
        console.error("WebSocket error:", err)
      }
    }

    connectWebSocket()

    return () => {
      if (socketRef.current) {
        socketRef.current.close()
      }
    }
  }, [hospitalId])

  const handleReportSubmit = async (e) => {
    e.preventDefault()
    setReportSubmitting(true)
    setReportError("")
    setReportSuccess(false)

    try {
      const response = await api.post("/api/v1/reports/", {
        hospital_id: parseInt(hospitalId),
        reason: reportReason,
        description: reportDesc || null,
      })

      if (response.ok) {
        setReportSuccess(true)
        setReportDesc("")
        setTimeout(() => {
          setShowReportModal(false)
          setReportSuccess(false)
        }, 2000)
      } else {
        const errData = await response.json()
        setReportError(errData.detail || "Submission failed.")
      }
    } catch (err) {
      setReportError("Network error. Please try again.")
    } finally {
      setReportSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)]">
        <Loader className="h-10 w-10 text-brand-500 animate-spin mb-4" />
        <span className="text-slate-500 text-sm">Loading Hospital Profile...</span>
      </div>
    )
  }

  if (!hospital) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold text-slate-800">Hospital profile not found.</h2>
        <p className="mt-2 text-slate-500 font-light">It might be inactive or awaiting verification.</p>
        <Link to="/hospitals" className="mt-6 inline-block text-brand-600 font-semibold">
          Back to Search
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header Profile card */}
      <div className="glass-panel p-8 rounded-3xl shadow-sm mb-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl"></div>
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center space-x-2.5 mb-3">
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-brand-50 text-brand-600">
                {hospital.hospital_type}
              </span>
              <div className="flex items-center space-x-1.5 text-xs text-slate-500">
                <span className={`h-2.5 w-2.5 rounded-full ${wsConnected ? "bg-emerald-500 animate-pulse" : "bg-red-400"}`}></span>
                <span>{wsConnected ? "Connected Real-time" : "Sync Offline"}</span>
              </div>
            </div>

            <h1 className="text-3xl font-display font-extrabold text-slate-900">{hospital.name}</h1>
            
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500 font-light">
              <span className="flex items-center space-x-1.5">
                <MapPin className="h-4 w-4 text-slate-400" />
                <span>{hospital.address}, {hospital.city}, {hospital.state} - {hospital.pincode}</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <Phone className="h-4 w-4 text-slate-400" />
                <span>{hospital.phone || "No Contact"}</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <Mail className="h-4 w-4 text-slate-400" />
                <span>{hospital.email}</span>
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            {user ? (
              <button
                onClick={() => setShowReportModal(true)}
                className="flex items-center justify-center space-x-1.5 px-5 py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50/50 text-sm font-medium transition-all"
              >
                <AlertTriangle className="h-4 w-4" />
                <span>Report Discrepancy</span>
              </button>
            ) : (
              <Link
                to="/login"
                className="flex items-center justify-center space-x-1.5 px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-all"
              >
                <AlertTriangle className="h-4 w-4" />
                <span>Login to Report Incorrect Info</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Beds Availability Matrix */}
      <div className="mb-12">
        <h2 className="text-2xl font-display font-bold text-slate-900 mb-6 flex items-center space-x-2">
          <span>Live Bed Availability Matrix</span>
          <RefreshCw className={`h-5 w-5 text-slate-400 ${wsConnected ? "animate-spin" : ""}`} style={{ animationDuration: "3s" }} />
        </h2>
        
        {beds.length === 0 ? (
          <div className="glass-panel text-center py-16 rounded-3xl">
            <p className="text-slate-500 font-light">No bed records configured for this hospital.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {beds.map((bed) => {
              const hasBeds = bed.available_beds > 0
              return (
                <div
                  key={bed.id}
                  className={`glass-panel p-6 rounded-3xl shadow-sm border-t-4 transition-all duration-300 ${
                    hasBeds ? "border-t-emerald-500 hover:shadow-emerald-100" : "border-t-red-500 hover:shadow-red-100"
                  }`}
                >
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-display font-bold text-slate-900">{bed.bed_type_name}</h3>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        hasBeds ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                      }`}
                    >
                      {hasBeds ? "Available" : "Full"}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center mt-6">
                    <div className="p-2.5 rounded-2xl bg-slate-50">
                      <div className={`text-2xl font-display font-extrabold ${hasBeds ? "text-emerald-600" : "text-red-500"}`}>
                        {bed.available_beds}
                      </div>
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Available</div>
                    </div>
                    <div className="p-2.5 rounded-2xl bg-slate-50">
                      <div className="text-2xl font-display font-extrabold text-slate-700">{bed.occupied_beds}</div>
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Occupied</div>
                    </div>
                    <div className="p-2.5 rounded-2xl bg-slate-50">
                      <div className="text-2xl font-display font-extrabold text-slate-700">{bed.total_beds}</div>
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Total</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Discrepancy Reporting Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel-dark max-w-md w-full p-8 rounded-3xl shadow-2xl relative text-white">
            <h3 className="text-2xl font-display font-bold mb-2">Report Discrepancy</h3>
            <p className="text-sm text-slate-300 font-light mb-6">
              Help us maintain correct details. Let us know what information is incorrect or suspicious.
            </p>

            {reportError && (
              <div className="mb-4 p-4 rounded-xl bg-red-500/20 text-red-200 flex items-start space-x-2 text-sm border border-red-500/30">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                <span>{reportError}</span>
              </div>
            )}

            {reportSuccess && (
              <div className="mb-4 p-4 rounded-xl bg-emerald-500/20 text-emerald-200 flex items-start space-x-2 text-sm border border-emerald-500/30">
                <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <span>Report submitted successfully. Thank you!</span>
              </div>
            )}

            <form onSubmit={handleReportSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Reason</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 outline-none text-white text-sm"
                >
                  <option value="INCORRECT_AVAILABILITY">Incorrect Bed Availability Count</option>
                  <option value="SUSPICIOUS_DETAILS">Suspicious Hospital Activity/Details</option>
                  <option value="CONTACT_UNREACHABLE">Contact Info Unreachable</option>
                  <option value="OTHER">Other Issues</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Details / Description</label>
                <textarea
                  required
                  rows={4}
                  value={reportDesc}
                  onChange={(e) => setReportDesc(e.target.value)}
                  placeholder="Provide details about the incorrect counts (e.g. ICU bed count says 20 but hospital confirmed 0)."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 outline-none text-white placeholder-slate-500 text-sm resize-none"
                ></textarea>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-slate-700 hover:bg-slate-800/50 transition-all text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reportSubmitting || reportSuccess}
                  className="flex-grow py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 disabled:from-slate-600 disabled:to-slate-600 shadow-md shadow-brand-500/20 transition-all flex items-center justify-center space-x-2"
                >
                  {reportSubmitting ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Submit Report</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
export default HospitalDetails
