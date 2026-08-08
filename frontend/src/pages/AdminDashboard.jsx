import React, { useState, useEffect } from "react"
import { api } from "../services/api"
import { useAuth } from "../context/AuthContext"
import { Loader, AlertCircle, CheckCircle, ShieldAlert, Check, X, ShieldCheck, Ban, FileText, Activity, Clock, RefreshCw, Trash2, ShieldAlert as ShieldIcon } from "lucide-react"

export const AdminDashboard = () => {
  const { user, setUser } = useAuth()

  const [stats, setStats] = useState(null)
  const [pendingHospitals, setPendingHospitals] = useState([])
  const [allHospitals, setAllHospitals] = useState([])
  const [reports, setReports] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [sessions, setSessions] = useState([])

  // MFA setup states
  const [mfaEnrolling, setMfaEnrolling] = useState(false)
  const [mfaSecret, setMfaSecret] = useState("")
  const [mfaProvisioningUri, setMfaProvisioningUri] = useState("")
  const [mfaRecoveryCodes, setMfaRecoveryCodes] = useState([])
  const [mfaCode, setMfaCode] = useState("")
  const [mfaSuccessMsg, setMfaSuccessMsg] = useState("")
  const [mfaErrorMsg, setMfaErrorMsg] = useState("")
  const [mfaLoading, setMfaLoading] = useState(false)

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [changePasswordSuccess, setChangePasswordSuccess] = useState(false)
  const [changePasswordError, setChangePasswordError] = useState("")
  const [changePasswordLoading, setChangePasswordLoading] = useState(false)

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setChangePasswordLoading(true)
    setChangePasswordError("")
    setChangePasswordSuccess(false)
    try {
      const response = await api.post("/api/v1/users/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      })
      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.detail || "Failed to change password.")
      }
      setChangePasswordSuccess(true)
      setCurrentPassword("")
      setNewPassword("")
    } catch (err) {
      setChangePasswordError(err.message)
    } finally {
      setChangePasswordLoading(false)
    }
  }

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
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Tabs state
  const [activeTab, setActiveTab] = useState("stats")

  // Rejection modal state
  const [rejectId, setRejectId] = useState(null)
  const [rejectionReason, setRejectionReason] = useState("")
  const [rejectSubmitting, setRejectSubmitting] = useState(false)

  // Document checking state
  const [selectedHospitalDocs, setSelectedHospitalDocs] = useState([])
  const [viewingDocsHospitalId, setViewingDocsHospitalId] = useState(null)

  const handleViewDocuments = async (hospitalId) => {
    if (viewingDocsHospitalId === hospitalId) {
      setViewingDocsHospitalId(null)
      setSelectedHospitalDocs([])
      return
    }
    setViewingDocsHospitalId(hospitalId)
    setSelectedHospitalDocs([])
    try {
      const response = await api.get(`/api/v1/admin/hospitals/${hospitalId}/documents`)
      if (response.ok) {
        setSelectedHospitalDocs(await response.json())
      }
    } catch (err) {
      console.error("Failed to load documents:", err)
    }
  }

  const loadAdminData = async () => {
    setLoading(true)
    setError("")
    try {
      // 1. Fetch system statistics
      const statsResponse = await api.get("/api/v1/admin/dashboard")
      if (statsResponse.ok) setStats(await statsResponse.json())

      // 2. Fetch pending verification queue
      const pendingResponse = await api.get("/api/v1/admin/hospitals/pending")
      if (pendingResponse.ok) setPendingHospitals(await pendingResponse.json())

      // 3. Fetch all registered hospitals
      const allResponse = await api.get("/api/v1/admin/hospitals")
      if (allResponse.ok) setAllHospitals(await allResponse.json())

      // 4. Fetch discrepancy reports
      const reportsResponse = await api.get("/api/v1/admin/reports")
      if (reportsResponse.ok) setReports(await reportsResponse.json())

      // 5. Fetch audit logs
      const auditsResponse = await api.get("/api/v1/admin/audit-logs")
      if (auditsResponse.ok) setAuditLogs(await auditsResponse.json())

      // 6. Fetch admin's active device sessions
      const sessionsResponse = await api.get("/api/v1/auth/sessions")
      if (sessionsResponse.ok) setSessions(await sessionsResponse.json())
    } catch (err) {
      console.error(err)
      setError("Failed to load administration data. Verify role access.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAdminData()
  }, [])

  // Approve hospital handler
  const handleApproveHospital = async (hospitalId) => {
    if (!window.confirm("Approve and activate this hospital registration?")) return
    try {
      const response = await api.post(`/api/v1/admin/hospitals/${hospitalId}/verify`)
      if (response.ok) {
        // Refresh arrays
        setPendingHospitals((prev) => prev.filter((h) => h.id !== hospitalId))
        loadAdminData()
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Reject hospital handler
  const handleRejectHospitalSubmit = async (e) => {
    e.preventDefault()
    setRejectSubmitting(true)
    try {
      const response = await api.post(`/api/v1/admin/hospitals/${rejectId}/reject`, {
        rejection_reason: rejectionReason,
      })
      if (response.ok) {
        setPendingHospitals((prev) => prev.filter((h) => h.id !== rejectId))
        setRejectId(null)
        setRejectionReason("")
        loadAdminData()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setRejectSubmitting(false)
    }
  }

  // Suspend hospital service handler
  const handleSuspendHospital = async (hospitalId) => {
    if (!window.confirm("Are you sure you want to suspend this hospital?")) return
    try {
      const response = await api.post(`/api/v1/admin/hospitals/${hospitalId}/suspend`)
      if (response.ok) loadAdminData()
    } catch (err) {
      console.error(err)
    }
  }

  // Reactivate hospital service handler
  const handleActivateHospital = async (hospitalId) => {
    try {
      const response = await api.post(`/api/v1/admin/hospitals/${hospitalId}/activate`)
      if (response.ok) loadAdminData()
    } catch (err) {
      console.error(err)
    }
  }

  // Delete hospital handler
  const handleDeleteHospital = async (hospitalId) => {
    if (!window.confirm("WARNING: Are you sure you want to completely delete this hospital? This action cannot be undone and will delete all bed inventory history, documents, and staff associations.")) return
    try {
      const response = await api.delete(`/api/v1/admin/hospitals/${hospitalId}`)
      if (response.ok) {
        loadAdminData()
      } else {
        const err = await response.json()
        alert(err.detail || "Failed to delete hospital.")
      }
    } catch (err) {
      console.error(err)
      alert("Network error. Please try again.")
    }
  }

  // Resolve discrepancy report handler
  const handleResolveReport = async (reportId) => {
    if (!window.confirm("Mark this discrepancy report as resolved?")) return
    try {
      const response = await api.post(`/api/v1/admin/reports/${reportId}/resolve`)
      if (response.ok) {
        const updated = await response.json()
        setReports((prev) => prev.map((r) => (r.id === reportId ? updated : r)))
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Revoke user session token handler
  const handleRevokeSession = async (sessionId) => {
    if (!window.confirm("Revoke this session? This will force a logout on that device.")) return
    try {
      const response = await api.delete(`/api/v1/auth/sessions/${sessionId}`)
      if (response.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId))
      }
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)]">
        <Loader className="h-10 w-10 text-brand-500 animate-spin mb-4" />
        <span className="text-slate-500 text-sm">Loading Admin Panel...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <ShieldIcon className="h-12 w-12 text-rose-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-800">Access Blocked</h2>
        <p className="mt-2 text-slate-500 font-light max-w-md mx-auto">{error}</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Brand card */}
      <div className="glass-panel p-8 rounded-3xl shadow-sm mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 text-rose-600 mb-2">
            Admin Mode
          </span>
          <h1 className="text-3xl font-display font-extrabold text-slate-900">System Control Center</h1>
          <p className="text-sm text-slate-500 font-light mt-1">Logged in as {user.name} ({user.email})</p>
        </div>
        <button
          onClick={loadAdminData}
          className="flex items-center space-x-1 px-4 py-2 bg-slate-100 hover:bg-slate-200/60 text-slate-700 rounded-xl text-sm font-medium transition-all"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-8 space-x-6 text-sm font-medium overflow-x-auto whitespace-nowrap">
        <button
          onClick={() => setActiveTab("stats")}
          className={`pb-4 border-b-2 transition-all ${
            activeTab === "stats" ? "border-brand-600 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Statistics
        </button>
        <button
          onClick={() => setActiveTab("pending")}
          className={`pb-4 border-b-2 transition-all ${
            activeTab === "pending" ? "border-brand-600 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Verification Queue ({pendingHospitals.length})
        </button>
        <button
          onClick={() => setActiveTab("hospitals")}
          className={`pb-4 border-b-2 transition-all ${
            activeTab === "hospitals" ? "border-brand-600 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Registered Facilities
        </button>
        <button
          onClick={() => setActiveTab("reports")}
          className={`pb-4 border-b-2 transition-all ${
            activeTab === "reports" ? "border-brand-600 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Discrepancy Reports ({reports.filter((r) => r.status === "OPEN").length})
        </button>
        <button
          onClick={() => setActiveTab("audits")}
          className={`pb-4 border-b-2 transition-all ${
            activeTab === "audits" ? "border-brand-600 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Security Audit Logs
        </button>
        <button
          onClick={() => setActiveTab("sessions")}
          className={`pb-4 border-b-2 transition-all ${
            activeTab === "sessions" ? "border-brand-600 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Active Sessions
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

      {/* Stats View */}
      {activeTab === "stats" && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="glass-panel p-6 rounded-3xl shadow-sm">
            <h3 className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">Hospitals Index</h3>
            <div className="text-3xl font-display font-extrabold text-slate-900">{stats.total_hospitals} Registered</div>
            <div className="text-sm text-slate-400 mt-2">
              {stats.verified_hospitals} Verified • {stats.pending_hospitals} Pending approval
            </div>
          </div>
          <div className="glass-panel p-6 rounded-3xl shadow-sm">
            <h3 className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">Total System Capacity</h3>
            <div className="text-3xl font-display font-extrabold text-slate-900">{stats.total_beds} Beds</div>
            <div className="text-sm text-slate-400 mt-2">
              {stats.occupied_beds} Occupied • {stats.available_beds} Available
            </div>
          </div>
          <div className="glass-panel p-6 rounded-3xl shadow-sm">
            <h3 className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">Percentage Availability</h3>
            <div className="text-3xl font-display font-extrabold text-brand-600">
              {stats.total_beds > 0 ? ((stats.available_beds / stats.total_beds) * 100).toFixed(1) : 0}%
            </div>
            <div className="text-sm text-slate-400 mt-2">
              System occupancy is at {stats.total_beds > 0 ? ((stats.occupied_beds / stats.total_beds) * 100).toFixed(1) : 0}% capacity
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

          {/* Change Password Panel */}
          <div className="border-t border-slate-150 pt-8 mt-8">
            <h3 className="text-lg font-display font-bold text-slate-900 mb-2">Change Account Password</h3>
            <p className="text-sm text-slate-500 font-light mb-4">
              Update your account login password. The new password must be at least 8 characters long.
            </p>

            {changePasswordError && (
              <div className="mb-4 p-4 rounded-xl bg-rose-50 text-rose-700 flex items-start space-x-2 text-sm max-w-md">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <span>{changePasswordError}</span>
              </div>
            )}

            {changePasswordSuccess && (
              <div className="mb-4 p-4 rounded-xl bg-emerald-50 text-emerald-700 flex items-start space-x-2 text-sm max-w-md">
                <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <span>Password changed successfully!</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-brand-500 outline-none text-slate-800 text-sm bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-brand-500 outline-none text-slate-800 text-sm bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={changePasswordLoading || !currentPassword || !newPassword}
                className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:bg-slate-300"
              >
                {changePasswordLoading ? "Updating..." : "Update Password"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Pending verification queue */}
      {activeTab === "pending" && (
        <div className="glass-panel p-6 rounded-3xl shadow-sm">
          <h2 className="text-xl font-display font-bold text-slate-900 mb-6">Verification Request Queue</h2>
          {pendingHospitals.length === 0 ? (
            <p className="text-slate-500 font-light text-center py-10">No registrations awaiting verification.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingHospitals.map((hosp) => (
                <div key={hosp.id} className="py-6 border-b border-slate-100 last:border-0">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h3 className="text-lg font-display font-bold text-slate-900">{hosp.name}</h3>
                      <p className="text-xs text-slate-400 mt-1">
                        {hosp.hospital_type} • Reg No: {hosp.registration_number}
                      </p>
                      <p className="text-sm text-slate-500 mt-2">
                        {hosp.address}, {hosp.city}, {hosp.state} - {hosp.pincode}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 w-full md:w-auto">
                      <button
                        onClick={() => handleViewDocuments(hosp.id)}
                        className="flex-grow md:flex-none flex items-center justify-center space-x-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-all"
                      >
                        <FileText className="h-4 w-4" />
                        <span>{viewingDocsHospitalId === hosp.id ? "Hide Files" : "Check Files"}</span>
                      </button>
                      <button
                        onClick={() => handleApproveHospital(hosp.id)}
                        className="flex-grow md:flex-none flex items-center justify-center space-x-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-all"
                      >
                        <Check className="h-4 w-4" />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => setRejectId(hosp.id)}
                        className="flex-grow md:flex-none flex items-center justify-center space-x-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-all"
                      >
                        <X className="h-4 w-4" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>

                  {viewingDocsHospitalId === hosp.id && (
                    <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 w-full text-xs text-slate-600">
                      <h4 className="font-semibold text-slate-800 text-sm">Uploaded Credentials ({selectedHospitalDocs.length})</h4>
                      {selectedHospitalDocs.length === 0 ? (
                        <p className="text-slate-400 italic">No credentials submitted yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {selectedHospitalDocs.map((doc) => (
                            <div key={doc.id} className="p-3 bg-white rounded-xl border border-slate-100 flex flex-col gap-1 shadow-sm">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-slate-700 uppercase tracking-wider">{doc.document_type}</span>
                                <div className="flex gap-1.5">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                    doc.scan_status === "CLEAN" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700 animate-pulse font-extrabold"
                                  }`}>
                                    Scan: {doc.scan_status}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-50 text-slate-500">
                                    Verify: {doc.verification_status}
                                  </span>
                                </div>
                              </div>
                              <div className="font-mono text-[10px] text-slate-400 mt-1 break-all">SHA256: {doc.checksum_sha256}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">Uploaded: {new Date(doc.created_at).toLocaleString()}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reject Reason input modal */}
      {rejectId && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel-dark max-w-md w-full p-8 rounded-3xl shadow-2xl relative text-white">
            <h3 className="text-2xl font-display font-bold mb-2">Provide Rejection Reason</h3>
            <p className="text-sm text-slate-300 font-light mb-6">
              Detail why this hospital request is being rejected. This notification will be visible to hospital staffs.
            </p>

            <form onSubmit={handleRejectHospitalSubmit} className="space-y-4">
              <textarea
                required
                rows={4}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Invalid registration documents supplied or credentials check failed."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 outline-none text-white text-sm resize-none"
              ></textarea>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setRejectId(null)
                    setRejectionReason("")
                  }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-slate-700 hover:bg-slate-800/50 transition-all text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rejectSubmitting}
                  className="flex-grow py-2.5 rounded-xl text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 transition-all"
                >
                  Confirm Reject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* All Registered Hospitals */}
      {activeTab === "hospitals" && (
        <div className="glass-panel p-6 rounded-3xl shadow-sm">
          <h2 className="text-xl font-display font-bold text-slate-900 mb-6">Registered Medical Facilities</h2>
          {allHospitals.length === 0 ? (
            <p className="text-slate-500 font-light text-center py-10">No registered hospitals found.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {allHospitals.map((hosp) => (
                <div key={hosp.id} className="py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-bold text-slate-900 text-lg">{hosp.name}</h3>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          hosp.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700"
                            : hosp.status === "SUSPENDED"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {hosp.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Verification: {hosp.verification_status} • {hosp.city}, {hosp.state}
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {hosp.verification_status === "VERIFIED" && (
                      <>
                        {hosp.status === "ACTIVE" ? (
                          <button
                            onClick={() => handleSuspendHospital(hosp.id)}
                            className="flex items-center space-x-1 px-3.5 py-1.5 border border-amber-200 text-amber-600 hover:bg-amber-50 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                          >
                            <Ban className="h-3.5 w-3.5" />
                            <span>Suspend</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivateHospital(hosp.id)}
                            className="flex items-center space-x-1 px-3.5 py-1.5 border border-emerald-200 text-emerald-600 hover:bg-emerald-50 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            <span>Activate</span>
                          </button>
                        )}
                      </>
                    )}
                    
                    <button
                      onClick={() => handleDeleteHospital(hosp.id)}
                      className="flex items-center space-x-1 px-3.5 py-1.5 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Discrepancy Reports list */}
      {activeTab === "reports" && (
        <div className="glass-panel p-6 rounded-3xl shadow-sm">
          <h2 className="text-xl font-display font-bold text-slate-900 mb-6">Submitted Discrepancy Reports</h2>
          {reports.length === 0 ? (
            <p className="text-slate-500 font-light text-center py-10">No reports filed.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {reports.map((rep) => (
                <div key={rep.id} className="py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-slate-800 text-sm">Report #{rep.id}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          rep.status === "OPEN" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {rep.status}
                      </span>
                    </div>
                    <div className="mt-1.5 space-y-0.5 text-xs text-slate-500">
                      <p className="font-semibold text-slate-700">
                        Hospital: <span className="text-brand-600 font-bold">{rep.hospital_name || `ID #${rep.hospital_id}`}</span> 
                        {rep.hospital_location && <span className="text-slate-400 font-light"> ({rep.hospital_location})</span>}
                      </p>
                      <p>
                        Reason: <span className="font-medium text-slate-700">{rep.reason}</span>
                      </p>
                      <p>
                        Reporter: <span className="font-medium text-slate-700">{rep.reporter_email || `User ID #${rep.user_id}`}</span>
                      </p>
                    </div>
                    <p className="text-sm text-slate-600 mt-3 italic font-light bg-slate-50 border border-slate-100 p-2.5 rounded-xl">"{rep.description}"</p>
                  </div>

                  {rep.status === "OPEN" && (
                    <button
                      onClick={() => handleResolveReport(rep.id)}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-all"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Audit Logs tab */}
      {activeTab === "audits" && (
        <div className="glass-panel p-6 rounded-3xl shadow-sm">
          <h2 className="text-xl font-display font-bold text-slate-900 mb-6">Security Audit Logs</h2>
          {auditLogs.length === 0 ? (
            <p className="text-slate-500 font-light text-center py-10">No security audit logs recorded.</p>
          ) : (
            <div className="overflow-x-auto text-sm text-slate-600">
              <table className="min-w-full text-left font-light">
                <thead>
                  <tr className="border-b border-slate-200 font-semibold text-slate-700">
                    <th className="py-2.5">Date</th>
                    <th className="py-2.5">User</th>
                    <th className="py-2.5">Action</th>
                    <th className="py-2.5">Target entity</th>
                    <th className="py-2.5">Diff Payload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="py-3 font-normal text-slate-500 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 font-medium">User #{log.user_id}</td>
                      <td className="py-3 text-slate-700 font-semibold">{log.action}</td>
                      <td className="py-3 text-slate-500 uppercase text-xs">
                        {log.entity_type || "N/A"} ({log.entity_id || "-"})
                      </td>
                      <td className="py-3 text-[11px] font-mono text-slate-400 max-w-xs truncate">
                        {JSON.stringify(log.new_values || {})}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Sessions Management */}
      {activeTab === "sessions" && (
        <div className="glass-panel p-6 rounded-3xl shadow-sm">
          <h2 className="text-xl font-display font-bold text-slate-900 mb-6">Active Administrative Sessions</h2>
          {sessions.length === 0 ? (
            <p className="text-slate-500 font-light text-center py-10">No active session tokens found.</p>
          ) : (
            <div className="divide-y divide-slate-100 text-sm text-slate-600">
              {sessions.map((sess) => (
                <div key={sess.id} className="py-4 flex justify-between items-center gap-4">
                  <div>
                    <p className="font-semibold text-slate-800">Device/Client Session ID: {sess.id}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Created: {new Date(sess.created_at).toLocaleString()} • IP: {sess.ip_address || "Unknown"}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate max-w-md">Agent: {sess.user_agent || "N/A"}</p>
                  </div>
                  <button
                    onClick={() => handleRevokeSession(sess.id)}
                    className="text-rose-600 hover:text-rose-800 p-2 hover:bg-rose-50 rounded-xl transition-all"
                    title="Revoke Session"
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
export default AdminDashboard
