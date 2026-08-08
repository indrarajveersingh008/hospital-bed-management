import React, { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { Lock, Mail, AlertCircle, Loader, Eye, EyeOff } from "lucide-react"

export const Login = () => {
  const { login, verifyMfaLogin } = useAuth()
  const navigate = useNavigate()
  
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // 2FA state
  const [mfaRequired, setMfaRequired] = useState(false)
  const [mfaToken, setMfaToken] = useState("")
  const [mfaCode, setMfaCode] = useState("")

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const loggedUser = await login(email, password)
      if (loggedUser.mfa_required) {
        setMfaRequired(true)
        setMfaToken(loggedUser.mfa_token)
      } else {
        redirectUser(loggedUser)
      }
    } catch (err) {
      console.error(err)
      setError(err.message || "Invalid credentials. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleMfaSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const loggedUser = await verifyMfaLogin(mfaToken, mfaCode)
      redirectUser(loggedUser)
    } catch (err) {
      console.error(err)
      setError(err.message || "Invalid 2FA verification code.")
    } finally {
      setLoading(false)
    }
  }

  const redirectUser = (loggedUser) => {
    if (loggedUser.role === "ADMIN") {
      navigate("/admin/dashboard")
    } else if (loggedUser.role === "HOSPITAL_ADMIN") {
      navigate("/hospital/dashboard")
    } else {
      navigate("/")
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-slate-50 px-4 py-12 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/3 w-72 h-72 bg-brand-500/10 rounded-full blur-3xl"></div>
      
      <div className="glass-panel max-w-md w-full p-8 rounded-3xl shadow-xl shadow-slate-100/50 relative z-10">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-display font-extrabold text-slate-900">
            {mfaRequired ? "Two-Factor Verification" : "Welcome Back"}
          </h2>
          <p className="mt-2 text-sm text-slate-500 font-light">
            {mfaRequired
              ? "Please enter the 6-digit verification code from your authenticator app."
              : "Sign in to manage your hospital bed inventories or view reports."}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-700 flex items-start space-x-2 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {mfaRequired ? (
          <form onSubmit={handleMfaSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                6-Digit Verification Code
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3.5 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:border-brand-500 outline-none text-slate-800 tracking-widest placeholder-slate-400 bg-white/50 text-base font-bold text-center transition-all"
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
                  <span>Verifying Code...</span>
                </>
              ) : (
                <span>Verify Code</span>
              )}
            </button>
          </form>
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
                  placeholder="staff_user@example.com"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:border-brand-500 outline-none text-slate-800 placeholder-slate-400 bg-white/50 text-sm transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
                <Link to="/forgot-password" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                  Forgot Password?
                </Link>
              </div>
              <div className="relative flex items-center">
                <Lock className="absolute left-3.5 h-5 w-5 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-11 pr-11 py-3 rounded-xl border border-slate-200 focus:border-brand-500 outline-none text-slate-800 placeholder-slate-400 bg-white/50 text-sm transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
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
                  <span>Signing In...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>
        )}

        <div className="mt-8 text-center border-t border-slate-200/50 pt-6">
          <p className="text-sm text-slate-500 font-light">
            Don't have an account?{" "}
            <Link to="/register" className="font-semibold text-brand-600 hover:text-brand-700">
              Register Here
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
export default Login
