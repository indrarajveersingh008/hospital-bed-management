import React, { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { api } from "../services/api"
import { Building2, FileText, Mail, Phone, MapPin, Compass, AlertCircle, CheckCircle, Loader } from "lucide-react"

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

export const RegisterHospital = () => {
  const { setUser } = useAuth()
  const navigate = useNavigate()

  // Form fields
  const [name, setName] = useState("")
  const [regNumber, setRegNumber] = useState("")
  const [hospType, setHospType] = useState("PRIVATE")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [emergencyPhone, setEmergencyPhone] = useState("")
  const [address, setAddress] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [pincode, setPincode] = useState("")
  const [latitude, setLatitude] = useState("")
  const [longitude, setLongitude] = useState("")

  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setSuccess(false)
    setLoading(true)

    const payload = {
      name,
      registration_number: regNumber,
      hospital_type: hospType,
      email: email || null,
      phone: phone || null,
      emergency_phone: emergencyPhone || null,
      address,
      city,
      state,
      pincode,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null
    }

    try {
      const response = await api.post("/api/v1/hospital/register", payload)
      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.detail || "Failed to register hospital")
      }

      setSuccess(true)

      // Reload user profile to fetch updated HOSPITAL_ADMIN role
      const profileResponse = await api.get("/api/v1/users/me")
      if (profileResponse.ok) {
        const updatedProfile = await profileResponse.json()
        setUser(updatedProfile)
      }

      setTimeout(() => {
        navigate("/hospital/dashboard")
      }, 2000)
    } catch (err) {
      console.error(err)
      setError(err.message || "Registration failed. Verify all required fields are correct.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-slate-50 px-4 py-12 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/3 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl"></div>
      
      <div className="glass-panel max-w-2xl w-full p-8 sm:p-10 rounded-3xl shadow-xl shadow-slate-100/50 relative z-10">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-display font-extrabold text-slate-900">Register Your Hospital</h2>
          <p className="mt-2 text-sm text-slate-500 font-light">
            Enter facility details to submit a verification request to system administrators.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-700 flex items-start space-x-2 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 text-emerald-700 flex items-start space-x-2 text-sm">
            <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>Hospital registration submitted successfully! Redirecting to dashboard...</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Core Details */}
          <div className="border-b border-slate-200/50 pb-4">
            <h3 className="text-sm font-semibold text-brand-600 uppercase tracking-wider mb-4">Core Identification</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Hospital Name *</label>
                <div className="relative flex items-center">
                  <Building2 className="absolute left-3.5 h-5 w-5 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="City General Hospital"
                    className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 outline-none text-slate-800 placeholder-slate-400 bg-white/50 text-sm transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Registration Number *</label>
                <div className="relative flex items-center">
                  <FileText className="absolute left-3.5 h-5 w-5 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={regNumber}
                    onChange={(e) => setRegNumber(e.target.value)}
                    placeholder="REG-991283"
                    className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 outline-none text-slate-800 placeholder-slate-400 bg-white/50 text-sm transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Hospital Classification *</label>
              <select
                value={hospType}
                onChange={(e) => setHospType(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 outline-none text-slate-800 bg-white/50 text-sm transition-all"
              >
                <option value="GOVERNMENT">Government (Public)</option>
                <option value="PRIVATE">Private Facility</option>
                <option value="TRUST">Charitable Trust</option>
                <option value="OTHER">Other / Non-Standard</option>
              </select>
            </div>
          </div>

          {/* Section 2: Contact Information */}
          <div className="border-b border-slate-200/50 pb-4">
            <h3 className="text-sm font-semibold text-brand-600 uppercase tracking-wider mb-4">Contact Info</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Facility Email</label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-3.5 h-5 w-5 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="info@hospital.com"
                    className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 outline-none text-slate-800 placeholder-slate-400 bg-white/50 text-sm transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">General Phone</label>
                <div className="relative flex items-center">
                  <Phone className="absolute left-3.5 h-5 w-5 text-slate-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 22 555-0100"
                    className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 outline-none text-slate-800 placeholder-slate-400 bg-white/50 text-sm transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Emergency Line</label>
                <div className="relative flex items-center">
                  <Phone className="absolute left-3.5 h-5 w-5 text-slate-400" />
                  <input
                    type="tel"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    placeholder="+91 22 555-0109"
                    className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 outline-none text-slate-800 placeholder-slate-400 bg-white/50 text-sm transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Geographic Parameters */}
          <div>
            <h3 className="text-sm font-semibold text-brand-600 uppercase tracking-wider mb-4">Location Coordinates & Address</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">City *</label>
                <div className="relative flex items-center">
                  <MapPin className="absolute left-3.5 h-5 w-5 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Mumbai"
                    className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 outline-none text-slate-800 placeholder-slate-400 bg-white/50 text-sm transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">State *</label>
                <select
                  required
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 outline-none text-slate-800 bg-white/50 text-sm transition-all"
                >
                  <option value="">Select State</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Pincode *</label>
                <input
                  type="text"
                  required
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="400001"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 outline-none text-slate-800 placeholder-slate-400 bg-white/50 text-sm transition-all"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Full Address *</label>
              <textarea
                required
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="102 Marine Drive, Near Nariman Point..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 outline-none text-slate-800 placeholder-slate-400 bg-white/50 text-sm transition-all resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Latitude (Optional)</label>
                <div className="relative flex items-center">
                  <Compass className="absolute left-3.5 h-5 w-5 text-slate-400" />
                  <input
                    type="number"
                    step="0.000001"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="18.9226"
                    className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 outline-none text-slate-800 placeholder-slate-400 bg-white/50 text-sm transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Longitude (Optional)</label>
                <div className="relative flex items-center">
                  <Compass className="absolute left-3.5 h-5 w-5 text-slate-400" />
                  <input
                    type="number"
                    step="0.000001"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="72.8286"
                    className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 outline-none text-slate-800 placeholder-slate-400 bg-white/50 text-sm transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="w-full py-3.5 mt-6 rounded-xl font-medium text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 disabled:from-slate-400 disabled:to-slate-400 shadow-md shadow-brand-500/20 transition-all flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <Loader className="h-5 w-5 animate-spin" />
                <span>Submitting Registration...</span>
              </>
            ) : (
              <span>Register Hospital</span>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
export default RegisterHospital
