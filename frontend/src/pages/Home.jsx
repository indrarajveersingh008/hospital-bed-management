import React, { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Search, Activity, ShieldCheck, HeartHandshake, Eye } from "lucide-react"

export const Home = () => {
  const [city, setCity] = useState("")
  const navigate = useNavigate()

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    if (city.trim()) {
      navigate(`/hospitals?city=${encodeURIComponent(city.trim())}`)
    } else {
      navigate("/hospitals")
    }
  }

  return (
    <div className="relative overflow-hidden bg-slate-50 min-h-[calc(100vh-4rem)]">
      {/* Decorative background blur blobs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl -translate-y-12"></div>
      <div className="absolute bottom-0 right-1/4 w-[450px] h-[450px] bg-indigo-500/10 rounded-full blur-3xl translate-y-12"></div>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center relative z-10">
        <div className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-brand-50 text-brand-600 text-xs font-semibold tracking-wide uppercase mb-6 shadow-sm">
          <Activity className="h-4 w-4 animate-pulse" />
          <span>Real-time availability system</span>
        </div>

        <h1 className="text-5xl sm:text-6xl font-display font-extrabold text-slate-900 tracking-tight leading-none max-w-4xl mx-auto">
          Find and Secure Available Hospital Beds{" "}
          <span className="bg-gradient-to-r from-brand-600 to-indigo-600 bg-clip-text text-transparent">
            Instantly
          </span>
        </h1>
        
        <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto font-light">
          Track live bed availability, view verified hospital credentials, and report updates with absolute data transparency.
        </p>

        {/* Quick Search Card */}
        <div className="mt-10 max-w-xl mx-auto">
          <form onSubmit={handleSearchSubmit} className="glass-panel p-2 rounded-2xl shadow-lg shadow-slate-100 flex items-center">
            <div className="relative flex-grow pl-3 flex items-center">
              <Search className="h-5 w-5 text-slate-400 mr-2" />
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Enter city or town name (e.g. Springfield)"
                className="w-full bg-transparent border-0 outline-none text-slate-800 placeholder-slate-400 text-base py-3"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 rounded-xl font-medium text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 shadow-md shadow-brand-500/20 transition-all duration-200"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      {/* Feature Blocks */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="glass-panel p-8 rounded-3xl shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300">
            <div className="h-12 w-12 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600 mb-6">
              <Activity className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-display font-bold text-slate-900">Real-Time Syncing</h3>
            <p className="mt-3 text-slate-600 leading-relaxed font-light">
              WebSocket and Redis-powered notifications push updates instantly, keeping medical dispatchers synchronized.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="glass-panel p-8 rounded-3xl shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300">
            <div className="h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-6">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-display font-bold text-slate-900">Verified Credentials</h3>
            <p className="mt-3 text-slate-600 leading-relaxed font-light">
              Strict administrator registration verification workflows protect against unauthorized inventory changes.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="glass-panel p-8 rounded-3xl shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300">
            <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 mb-6">
              <HeartHandshake className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-display font-bold text-slate-900">Public Reporting</h3>
            <p className="mt-3 text-slate-600 leading-relaxed font-light">
              Submit reports of discrepancies or incorrect data directly to admins, ensuring data integrity.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
export default Home
