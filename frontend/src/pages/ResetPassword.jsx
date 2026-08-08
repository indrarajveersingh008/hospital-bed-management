import React, { useState } from "react"
import { useNavigate, useSearchParams, Link } from "react-router-dom"
import { api } from "../services/api"
import { Lock, AlertCircle, CheckCircle, Loader } from "lucide-react"

export const ResetPassword = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token")

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    if (!token) {
      setError("Missing reset token. Request a new password recovery link.")
      return
    }

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setLoading(true)
    try {
      const response = await api.post("/api/v1/auth/reset-password", {
        token: token,
        new_password: password,
      })

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.detail || "Credentials update failed.")
      }

      setSuccess("Your password has been successfully updated.")
      setTimeout(() => {
        navigate("/login")
      }, 3000)
    } catch (err) {
      console.error(err)
      setError(err.message || "Failed to reset password. The link may have expired.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-slate-50 px-4 py-12 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/3 w-72 h-72 bg-brand-500/10 rounded-full blur-3xl"></div>

      <div className="glass-panel max-w-md w-full p-8 rounded-3xl shadow-xl relative z-10">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-display font-extrabold text-slate-900">Define New Password</h2>
          <p className="mt-2 text-sm text-slate-500 font-light">
            Set your new credentials to securely lock your account.
          </p>
        </div>

        {!token && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 text-rose-700 flex items-start space-x-2 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>Missing or invalid security reset token. Please request a new recovery link.</span>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-700 flex items-start space-x-2 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-50 text-emerald-700 flex items-start space-x-2 text-sm">
              <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{success} Redirecting to login page...</span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                New Password
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3.5 h-5 w-5 text-slate-400" />
                <input
                  type="password"
                  required
                  disabled={!token}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:border-brand-500 outline-none text-slate-800 placeholder-slate-400 bg-white/50 text-sm transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Confirm Password
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3.5 h-5 w-5 text-slate-400" />
                <input
                  type="password"
                  required
                  disabled={!token}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:border-brand-500 outline-none text-slate-800 placeholder-slate-400 bg-white/50 text-sm transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !token}
              className="w-full py-3 rounded-xl font-medium text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 disabled:from-slate-400 disabled:to-slate-400 shadow-md shadow-brand-500/20 transition-all flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <Loader className="h-5 w-5 animate-spin" />
                  <span>Saving Password...</span>
                </>
              ) : (
                <span>Update Password Credentials</span>
              )}
            </button>
          </form>
        )}
        
        <div className="mt-8 text-center border-t border-slate-200/50 pt-6">
          <Link to="/login" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
            Return to Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}
export default ResetPassword
