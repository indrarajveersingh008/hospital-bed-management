import React, { useState, useEffect } from "react"
import { api } from "../services/api"
import { useAuth } from "../context/AuthContext"
import { Loader, AlertCircle, CheckCircle, RefreshCw, Plus, Trash2, Clock, ShieldAlert, ShieldCheck, FileText, Upload } from "lucide-react"

export const HospitalDashboard = () => {
  const { user, setUser } = useAuth()
  
  const [hospital, setHospital] = useState(null)
  const [beds, setBeds] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Active tab state
  const [activeTab, setActiveTab] = useState("overview")

  // Update Bed state
  const [updatingBedId, setUpdatingBedId] = useState(null)
  const [updateTotal, setUpdateTotal] = useState(0)
  const [updateOccupied, setUpdateOccupied] = useState(0)
  const [updateSuccess, setUpdateSuccess] = useState(false)
  const [updateError, setUpdateError] = useState("")

  // Bed history logs state
  const [historyBeds, setHistoryBeds] = useState([])
  const [viewingHistoryId, setViewingHistoryId] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  // Add staff state
  const [staffEmail, setStaffEmail] = useState("")
  const [staffPosition, setStaffPosition] = useState("Medical Dispatcher")
  const [staffSuccess, setStaffSuccess] = useState(false)
  const [staffError, setStaffError] = useState("")

  // MFA setup states
  const [mfaEnrolling, setMfaEnrolling] = useState(false)
  const [mfaSecret, setMfaSecret] = useState("")
  const [mfaProvisioningUri, setMfaProvisioningUri] = useState("")
  const [mfaRecoveryCodes, setMfaRecoveryCodes] = useState([])
  const [mfaCode, setMfaCode] = useState("")
  const [mfaSuccessMsg, setMfaSuccessMsg] = useState("")
  const [mfaErrorMsg, setMfaErrorMsg] = useState("")
  const [mfaLoading, setMfaLoading] = useState(false)

  // Document upload states
  const [documents, setDocuments] = useState([])
  const [uploadType, setUploadType] = useState("REGISTRATION")
  const [uploadFile, setUploadFile] = useState(null)
  const [docLoading, setDocLoading] = useState(false)
  const [docSuccess, setDocSuccess] = useState(false)
  const [docError, setDocError] = useState("")

  // Enroll handler
  const handleEnrollMfa = async () => {
    setMfaErrorMsg("")
    setMfaSuccessMsg("")
    setMfaLoading(true)
    try {
      const response = await api.post("/api/v1/auth/mfa/enroll")
      if (response.ok) {
        const data = await response.json()
        setMfaSecret(data.secret)
        setMfaProvisioningUri(data.provisioning_uri)
        setMfaRecoveryCodes(data.recovery_codes)
        setMfaEnrolling(true)
      } else {
        const err = await response.json()
        setMfaErrorMsg(err.detail || "Failed to initiate MFA enrollment.")
      }
    } catch (err) {
      setMfaErrorMsg("Network error. Please try again.")
    } finally {
      setMfaLoading(false)
    }
  }

  // Verify activation handler
  const handleVerifyMfa = async (e) => {
    e.preventDefault()
    setMfaErrorMsg("")
    setMfaSuccessMsg("")
    setMfaLoading(true)
    try {
      const response = await api.post("/api/v1/auth/mfa/verify", { code: mfaCode })
      if (response.ok) {
        setMfaSuccessMsg("MFA has been successfully activated on your account.")
        setMfaEnrolling(false)
        setMfaCode("")
        setUser({ ...user, mfa_enabled: true })
      } else {
        const err = await response.json()
        setMfaErrorMsg(err.detail || "MFA activation failed.")
      }
    } catch (err) {
      setMfaErrorMsg("Network error. Please try again.")
    } finally {
      setMfaLoading(false)
    }
  }

  // Disable handler
  const handleDisableMfa = async (e) => {
    e.preventDefault()
    if (!window.confirm("Are you sure you want to disable Multi-Factor Authentication? Your account will be less secure.")) return
    setMfaErrorMsg("")
    setMfaSuccessMsg("")
    setMfaLoading(true)
    try {
      const response = await api.post("/api/v1/auth/mfa/disable", { code: mfaCode })
      if (response.ok) {
        setMfaSuccessMsg("MFA has been disabled.")
        setMfaCode("")
        setUser({ ...user, mfa_enabled: false })
      } else {
        const err = await response.json()
        setMfaErrorMsg(err.detail || "Failed to disable MFA.")
      }
    } catch (err) {
      setMfaErrorMsg("Network error. Please try again.")
    } finally {
      setMfaLoading(false)
    }
  }

  // Upload document handler
  const handleUploadDocument = async (e) => {
    e.preventDefault()
    if (!uploadFile) return
    setDocLoading(true)
    setDocError("")
    setDocSuccess(false)

    const formData = new FormData()
    formData.append("document_type", uploadType)
    formData.append("file", uploadFile)

    try {
      const response = await api.post("/api/v1/hospital/documents", {
        method: "POST",
        body: formData,
      })

      if (response.ok) {
        setDocSuccess(true)
        setUploadFile(null)
        const fileInput = document.getElementById("docFileInput")
        if (fileInput) fileInput.value = ""
        
        // Refresh document list
        const refreshDocs = await api.get("/api/v1/hospital/documents")
        if (refreshDocs.ok) setDocuments(await refreshDocs.json())
      } else {
        const err = await response.json()
        setDocError(err.detail || "Failed to upload document.")
      }
    } catch (err) {
      setDocError("Network error. Please try again.")
    } finally {
      setDocLoading(false)
    }
  }

  const loadDashboardData = async () => {
    setLoading(true)
    setError("")
    try {
      // 1. Fetch own hospital
      const hospResponse = await api.get("/api/v1/hospital/me")
      if (!hospResponse.ok) {
        const err = await hospResponse.json()
        throw new Error(err.detail || "Failed to load hospital details")
      }
      const hospData = await hospResponse.json()
      setHospital(hospData)

      // 2. Fetch bed inventories
      const bedsResponse = await api.get("/api/v1/hospital/beds")
      if (bedsResponse.ok) {
        const bedsData = await bedsResponse.json()
        setBeds(bedsData)
      }

      // 3. Fetch staff
      const staffResponse = await api.get("/api/v1/hospital/staff")
      if (staffResponse.ok) {
        const staffData = await staffResponse.json()
        setStaff(staffData)
      }

      // 4. Fetch own verification documents
      const docsResponse = await api.get("/api/v1/hospital/documents")
      if (docsResponse.ok) {
        setDocuments(await docsResponse.json())
      }
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [])

  // Bed inventory update handler
  const handleUpdateBedSubmit = async (e, bedId) => {
    e.preventDefault()
    setUpdatingBedId(bedId)
    setUpdateError("")
    setUpdateSuccess(false)

    if (updateOccupied > updateTotal) {
      setUpdateError("Occupied beds cannot exceed total beds.")
      setUpdatingBedId(null)
      return
    }

    try {
      // Enforce unique idempotency keys
      const idempotencyKey = `idem-bed-${bedId}-${Date.now()}`
      const response = await api.put(
        `/api/v1/hospital/beds/${bedId}`,
        { total_beds: parseInt(updateTotal), occupied_beds: parseInt(updateOccupied) },
        { headers: { "Idempotency-Key": idempotencyKey } }
      )

      if (response.ok) {
        setUpdateSuccess(true)
        const updatedBed = await response.json()
        setBeds((prev) => prev.map((b) => (b.id === bedId ? updatedBed : b)))
        setTimeout(() => setUpdateSuccess(false), 2000)
      } else {
        const err = await response.json()
        setUpdateError(err.detail || "Failed to update bed counts.")
      }
    } catch (err) {
      setUpdateError("Network error. Please try again.")
    } finally {
      setUpdatingBedId(null)
    }
  }

  // Fetch bed update history logs
  const fetchBedHistory = async (bedId) => {
    setViewingHistoryId(bedId)
    setHistoryLoading(true)
    setHistoryBeds([])
    try {
      const response = await api.get(`/api/v1/hospital/beds/${bedId}/history`)
      if (response.ok) {
        const data = await response.json()
        setHistoryBeds(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setHistoryLoading(false)
    }
  }

  // Invite staff handler
  const handleAddStaffSubmit = async (e) => {
    e.preventDefault()
    setStaffError("")
    setStaffSuccess(false)

    try {
      const response = await api.post("/api/v1/hospital/staff", {
        email: staffEmail,
        position: staffPosition,
      })

      if (response.ok) {
        setStaffSuccess(true)
        setStaffEmail("")
        // Refresh staff list
        const refreshedStaff = await api.get("/api/v1/hospital/staff")
        if (refreshedStaff.ok) setStaff(await refreshedStaff.json())
        setTimeout(() => setStaffSuccess(false), 2000)
      } else {
        const err = await response.json()
        setStaffError(err.detail || "Failed to add staff member.")
      }
    } catch (err) {
      setStaffError("Network error. Please try again.")
    }
  }

  // Revoke staff access handler
  const handleRemoveStaff = async (staffId) => {
    if (!window.confirm("Are you sure you want to revoke staff access for this user?")) return
    try {
      const response = await api.delete(`/api/v1/hospital/staff/${staffId}`)
      if (response.ok) {
        setStaff((prev) => prev.filter((s) => s.id !== staffId))
      }
    } catch (err) {
      console.error("Failed to revoke staff access:", err)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)]">
        <Loader className="h-10 w-10 text-brand-500 animate-spin mb-4" />
        <span className="text-slate-500 text-sm">Loading Staff Dashboard...</span>
      </div>
    )
  }

  if (error || !hospital) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <ShieldAlert className="h-12 w-12 text-rose-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-800">Access Restricted</h2>
        <p className="mt-2 text-slate-500 font-light max-w-md mx-auto">
          {error || "We could not locate any active hospital credentials linked to your user account."}
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Dashboard Brand Card */}
      <div className="glass-panel p-8 rounded-3xl shadow-sm mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-brand-50 text-brand-600 mb-2">
            Status: {hospital.verification_status}
          </span>
          <h1 className="text-3xl font-display font-extrabold text-slate-900">{hospital.name}</h1>
          <p className="text-sm text-slate-500 font-light mt-1">{hospital.city}, {hospital.state}</p>
        </div>
        <button
          onClick={loadDashboardData}
          className="flex items-center space-x-1 px-4 py-2 bg-slate-100 hover:bg-slate-200/60 text-slate-700 rounded-xl text-sm font-medium transition-all"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-8 space-x-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab("overview")}
          className={`pb-4 border-b-2 transition-all ${
            activeTab === "overview" ? "border-brand-600 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Hospital Profile
        </button>
        <button
          onClick={() => setActiveTab("beds")}
          className={`pb-4 border-b-2 transition-all ${
            activeTab === "beds" ? "border-brand-600 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Beds & History logs
        </button>
        <button
          onClick={() => setActiveTab("staff")}
          className={`pb-4 border-b-2 transition-all ${
            activeTab === "staff" ? "border-brand-600 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Staff Directory
        </button>
        <button
          onClick={() => setActiveTab("documents")}
          className={`pb-4 border-b-2 transition-all ${
            activeTab === "documents" ? "border-brand-600 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Documents
        </button>
        <button
          onClick={() => setActiveTab("security")}
          className={`pb-4 border-b-2 transition-all ${
            activeTab === "security" ? "border-brand-600 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Security & MFA
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === "overview" && (
        <div className="glass-panel p-8 rounded-3xl shadow-sm space-y-6">
          <h2 className="text-xl font-display font-bold text-slate-900">Hospital Profile details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm font-light text-slate-600">
            <div>
              <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Registration No</span>
              <span className="text-slate-900 font-medium">{hospital.registration_number}</span>
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Type</span>
              <span className="text-slate-900 font-medium">{hospital.hospital_type}</span>
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Email Contact</span>
              <span className="text-slate-900 font-medium">{hospital.email}</span>
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Phone Contact</span>
              <span className="text-slate-900 font-medium">{hospital.phone || "Not set"}</span>
            </div>
            <div className="md:col-span-2">
              <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Address</span>
              <span className="text-slate-900 font-medium">
                {hospital.address}, {hospital.city}, {hospital.state} - {hospital.pincode}
              </span>
            </div>
          </div>
        </div>
      )}

      {activeTab === "security" && (
        <div className="glass-panel p-8 rounded-3xl shadow-sm space-y-6">
          <h2 className="text-xl font-display font-bold text-slate-900">Security & Account MFA</h2>
          <p className="text-sm text-slate-500 font-light">
            Multi-Factor Authentication (MFA) adds an extra layer of security by requiring a verification code from your phone's authenticator app when logging in.
          </p>

          {mfaSuccessMsg && (
            <div className="p-4 rounded-xl bg-emerald-50 text-emerald-700 flex items-start space-x-2 text-sm">
              <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{mfaSuccessMsg}</span>
            </div>
          )}

          {mfaErrorMsg && (
            <div className="p-4 rounded-xl bg-rose-50 text-rose-700 flex items-start space-x-2 text-sm">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{mfaErrorMsg}</span>
            </div>
          )}

          {user.mfa_enabled ? (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-start space-x-3">
                <ShieldCheck className="h-6 w-6 text-emerald-600 shrink-0" />
                <div>
                  <h3 className="font-semibold text-emerald-950 text-sm">MFA Protection Enabled</h3>
                  <p className="text-xs text-emerald-700 font-light mt-0.5">
                    Your account is securely locked with TOTP two-factor logins.
                  </p>
                </div>
              </div>

              <form onSubmit={handleDisableMfa} className="space-y-4 max-w-sm pt-4 border-t border-slate-100">
                <h4 className="font-semibold text-slate-800 text-sm">Deactivate MFA Protection</h4>
                <p className="text-xs text-slate-500 font-light">
                  Input your active 6-digit authenticator code below to confirm deactivation.
                </p>
                
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    className="flex-grow px-4 py-2 rounded-xl border border-slate-200 focus:border-brand-500 outline-none text-slate-800 text-sm font-semibold tracking-wider text-center bg-white/50"
                  />
                  <button
                    type="submit"
                    disabled={mfaLoading}
                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition-all"
                  >
                    {mfaLoading ? "Deactivating..." : "Disable MFA"}
                  </button>
                </div>
              </form>
            </div>
          ) : mfaEnrolling ? (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="font-bold text-slate-800 text-base mb-2">Step 1: Setup Authenticator App</h3>
                <p className="text-sm text-slate-500 font-light mb-4">
                  Add the secret key below into your standard authenticator application (Google Authenticator, Microsoft, Duo, etc.) by entering it manually:
                </p>
                <div className="p-4 rounded-xl bg-slate-50 font-mono text-center text-slate-800 border border-slate-200 select-all font-semibold tracking-widest text-lg">
                  {mfaSecret}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  OTP Provisioning URL: <code className="break-all text-[11px] bg-slate-100 px-1 py-0.5 rounded">{mfaProvisioningUri}</code>
                </p>
              </div>

              <div className="border-b border-slate-100 pb-4">
                <h3 className="font-bold text-slate-800 text-base mb-2">Step 2: Save Account Recovery Codes</h3>
                <p className="text-sm text-slate-500 font-light mb-3">
                  Write down these recovery keys. Each can be used once to bypass log in prompts if you lose access to your authenticator app:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {mfaRecoveryCodes.map((code, idx) => (
                    <div key={idx} className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 font-mono text-center text-xs select-all">
                      {code}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-bold text-slate-800 text-base mb-2">Step 3: Confirm Setup Activation</h3>
                <form onSubmit={handleVerifyMfa} className="flex flex-col sm:flex-row gap-3 max-w-md mt-2">
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    className="flex-grow px-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 outline-none text-slate-800 text-sm font-semibold tracking-widest text-center bg-white/50"
                  />
                  <button
                    type="submit"
                    disabled={mfaLoading}
                    className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm transition-all"
                  >
                    {mfaLoading ? "Activating..." : "Confirm & Activate"}
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-500 font-light">
                Secure your user logins by activating Time-based One-Time Passwords (TOTP).
              </p>
              <button
                onClick={handleEnrollMfa}
                disabled={mfaLoading}
                className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm transition-all flex items-center justify-center space-x-2"
              >
                {mfaLoading ? "Enrolling..." : "Enroll Account in MFA"}
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === "beds" && (
        <div className="space-y-10">
          {/* Bed list update cards */}
          <div>
            <h2 className="text-xl font-display font-bold text-slate-900 mb-6">Manage Live Bed Counts</h2>

            {beds.length === 0 ? (
              <div className="glass-panel text-center py-16 rounded-3xl text-slate-500 font-light">
                No bed registries configured.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {beds.map((bed) => (
                  <div key={bed.id} className="glass-panel p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-display font-bold text-slate-900">{bed.bed_type_name}</h3>
                        <button
                          onClick={() => fetchBedHistory(bed.id)}
                          className="flex items-center space-x-1 px-3 py-1 bg-slate-100 hover:bg-slate-200/60 text-slate-500 rounded-lg text-xs font-medium transition-all"
                        >
                          <Clock className="h-3.5 w-3.5" />
                          <span>History</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center text-sm font-medium mb-6">
                        <div className="p-2 rounded-xl bg-slate-50">
                          <span className="block text-[10px] text-slate-400 uppercase font-semibold">Total</span>
                          <span className="text-slate-800 text-lg font-bold">{bed.total_beds}</span>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-50">
                          <span className="block text-[10px] text-slate-400 uppercase font-semibold">Occupied</span>
                          <span className="text-slate-800 text-lg font-bold">{bed.occupied_beds}</span>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-50">
                          <span className="block text-[10px] text-slate-400 uppercase font-semibold">Available</span>
                          <span className="text-emerald-600 text-lg font-bold">{bed.available_beds}</span>
                        </div>
                      </div>
                    </div>

                    {/* Quick update counts form */}
                    <form
                      onSubmit={(e) => handleUpdateBedSubmit(e, bed.id)}
                      className="border-t border-slate-150/50 pt-4 mt-2 flex flex-col sm:flex-row items-end gap-3"
                    >
                      <div className="flex-grow grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">New Total</label>
                          <input
                            type="number"
                            required
                            min="0"
                            onChange={(e) => setUpdateTotal(e.target.value)}
                            placeholder={bed.total_beds}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">New Occupied</label>
                          <input
                            type="number"
                            required
                            min="0"
                            onChange={(e) => setUpdateOccupied(e.target.value)}
                            placeholder={bed.occupied_beds}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-sm"
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={updatingBedId === bed.id}
                        className="w-full sm:w-auto px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-all cursor-pointer"
                      >
                        Update
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* History modal / log detail list */}
          {viewingHistoryId && (
            <div className="glass-panel p-8 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-display font-bold text-slate-900">Bed Update History logs</h3>
                <button
                  onClick={() => setViewingHistoryId(null)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
                >
                  Close History
                </button>
              </div>

              {historyLoading ? (
                <div className="flex justify-center py-8">
                  <Loader className="h-6 w-6 text-brand-500 animate-spin" />
                </div>
              ) : historyBeds.length === 0 ? (
                <p className="text-slate-500 text-sm font-light text-center py-6">No historical records found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm font-light">
                    <thead>
                      <tr className="border-b border-slate-200 font-semibold text-slate-600">
                        <th className="py-2.5">Date</th>
                        <th className="py-2.5">Operator (ID)</th>
                        <th className="py-2.5">Total (Old → New)</th>
                        <th className="py-2.5">Occupied (Old → New)</th>
                        <th className="py-2.5">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      {historyBeds.map((log) => (
                        <tr key={log.id}>
                          <td className="py-2.5">{new Date(log.created_at).toLocaleString()}</td>
                          <td className="py-2.5">User {log.updated_by}</td>
                          <td className="py-2.5">{log.old_total} → {log.new_total}</td>
                          <td className="py-2.5">{log.old_occupied} → {log.new_occupied}</td>
                          <td className="py-2.5">{log.update_source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "staff" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Staff directory list */}
          <div className="glass-panel p-6 rounded-3xl shadow-sm lg:col-span-2">
            <h2 className="text-xl font-display font-bold text-slate-900 mb-6">Staff Directory</h2>
            
            {staff.length === 0 ? (
              <p className="text-slate-500 font-light text-center py-8">No staff members linked.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {staff.map((member) => (
                  <div key={member.id} className="py-4 flex justify-between items-center gap-4">
                    <div>
                      <p className="font-semibold text-slate-800">{member.user_name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{member.user_email} • {member.position}</p>
                    </div>
                    {user.id !== member.user_id && (
                      <button
                        onClick={() => handleRemoveStaff(member.id)}
                        className="text-rose-500 hover:text-rose-700 p-2 hover:bg-rose-50 rounded-xl transition-all"
                        title="Remove Access"
                      >
                        <Trash2 className="h-4.5 w-4.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Staff form */}
          <div className="glass-panel p-6 rounded-3xl shadow-sm">
            <h2 className="text-xl font-display font-bold text-slate-900 mb-6">Add Administrative Staff</h2>

            {staffError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 flex items-start space-x-1.5 text-xs">
                <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                <span>{staffError}</span>
              </div>
            )}

            {staffSuccess && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-50 text-emerald-700 flex items-start space-x-1.5 text-xs">
                <CheckCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                <span>Staff user added successfully!</span>
              </div>
            )}

            <form onSubmit={handleAddStaffSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Staff Email</label>
                <input
                  type="email"
                  required
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  placeholder="collaborator@example.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Role / Position</label>
                <select
                  value={staffPosition}
                  onChange={(e) => setStaffPosition(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none bg-white"
                >
                  <option value="Medical Dispatcher">Medical Dispatcher</option>
                  <option value="Hospital Administrator">Hospital Administrator</option>
                  <option value="Ward In-charge">Ward In-charge</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl font-medium text-white bg-slate-950 hover:bg-slate-900 transition-all text-sm flex items-center justify-center space-x-1"
              >
                <Plus className="h-4 w-4" />
                <span>Invite Staff</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {activeTab === "documents" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Documents list */}
          <div className="glass-panel p-6 rounded-3xl shadow-sm lg:col-span-2">
            <h2 className="text-xl font-display font-bold text-slate-900 mb-6">Verification Credentials</h2>
            
            {documents.length === 0 ? (
              <p className="text-slate-500 font-light text-center py-8">No verification documents uploaded yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {documents.map((doc) => (
                  <div key={doc.id} className="py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-sm">
                    <div>
                      <div className="flex items-center space-x-2">
                        <FileText className="h-5 w-5 text-slate-400" />
                        <span className="font-semibold text-slate-800 uppercase text-xs tracking-wider">
                          {doc.document_type}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            doc.scan_status === "CLEAN"
                              ? "bg-emerald-50 text-emerald-700"
                              : doc.scan_status === "INFECTED"
                              ? "bg-rose-50 text-rose-700 font-extrabold animate-pulse"
                              : "bg-slate-50 text-slate-500"
                          }`}
                        >
                          Scan: {doc.scan_status}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            doc.verification_status === "VERIFIED"
                              ? "bg-emerald-50 text-emerald-700"
                              : doc.verification_status === "REJECTED"
                              ? "bg-rose-50 text-rose-700"
                              : "bg-slate-50 text-slate-500"
                          }`}
                        >
                          Verify: {doc.verification_status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 font-mono break-all max-w-md">
                        SHA256: {doc.checksum_sha256 || "Calculating..."}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Uploaded: {new Date(doc.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upload form */}
          <div className="glass-panel p-6 rounded-3xl shadow-sm">
            <h2 className="text-xl font-display font-bold text-slate-900 mb-6">Upload Verification File</h2>

            {docError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 flex items-start space-x-1.5 text-xs">
                <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                <span>{docError}</span>
              </div>
            )}

            {docSuccess && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-50 text-emerald-700 flex items-start space-x-1.5 text-xs">
                <CheckCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                <span>Document uploaded and scanned successfully!</span>
              </div>
            )}

            <form onSubmit={handleUploadDocument} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Document Category
                </label>
                <select
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none bg-white"
                >
                  <option value="REGISTRATION">Hospital Registration Certificate</option>
                  <option value="LICENSE">Medical Operations License</option>
                  <option value="AUTHORIZATION">Authorized Signatory Consent</option>
                  <option value="OTHER">Other Supplemental Credentials</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Verification File (PDF, PNG, JPG)
                </label>
                <input
                  id="docFileInput"
                  type="file"
                  required
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => setUploadFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200/80 cursor-pointer"
                />
              </div>

              <button
                type="submit"
                disabled={docLoading || !uploadFile}
                className="w-full py-2.5 rounded-xl font-medium text-white bg-slate-950 hover:bg-slate-900 transition-all text-sm flex items-center justify-center space-x-1"
              >
                <Upload className="h-4 w-4" />
                <span>{docLoading ? "Uploading & Scanning..." : "Upload File"}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
export default HospitalDashboard
