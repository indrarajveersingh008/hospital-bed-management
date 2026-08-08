import React, { useState } from "react"
import { Link } from "react-router-dom"
import { api } from "../services/api"
import { Mail, AlertCircle, CheckCircle, Loader } from "lucide-react"

export const ForgotPassword = () => {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setLoading(true)

    try {
      const response = await api.post("/api/v1/auth/forgot-password", { email })
      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.detail || "Request failed.")
      }

      const data = await response.json()
      setSuccess(data.message)
      
      // In development mode, log token to developers console
      if (data.token_dev) {
        console.log("Development Reset Link: ", `http://localhost:5173/reset-password?token=${data.token_dev}`)
      }
    } catch (err) {
      console.error(err)
      setError(err.message || "Failed to process request. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-slate-50 px-4 py-12 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/3 w-72 h-72 bg-brand-500/10 rounded-full blur-3xl"></div>

      <div className="glass-panel max-w-md w-full p-8 rounded-3xl shadow-xl relative z-10">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-display font-extrabold text-slate-900">Reset Password</h2>
          <p className="mt-2 text-sm text-slate-500 font-light">
            Enter your email address and we'll dispatch a link to securely update your credentials.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-700 flex items-start space-x-2 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-emerald-50 text-emerald-700 flex items-start space-x-2 text-sm">
              <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
            
            <Link
              to="/login"
              className="block w-full py-3 rounded-xl font-medium text-center text-white bg-brand-600 hover:bg-brand-700 shadow-md shadow-brand-500/20 transition-all"
            >
              Return to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <div className="relative flex items-center">
                <Mail className="absolute left-3.5 h-5 w-5 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:border-brand-500 outline-none text-slate-800 placeholder-slate-400 bg-white/50 text-sm transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-medium text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 disabled:from-slate-400 disabled:to-slate-400 shadow-md shadow-brand-500/20 transition-all flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <Loader className="h-5 w-5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <span>Request Recovery Link</span>
              )}
            </button>
            
            <div className="text-center pt-2">
              <Link to="/login" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
export default ForgotPassword
