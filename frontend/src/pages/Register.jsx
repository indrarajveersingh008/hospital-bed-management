import React, { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { api } from "../services/api"
import { User, Mail, Lock, Phone, AlertCircle, CheckCircle, Loader, ShieldCheck } from "lucide-react"

export const Register = () => {
  const { register, login } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [phone, setPhone] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  // OTP Verification state
  const [otpSent, setOtpSent] = useState(false)
  const [otpCode, setOtpCode] = useState("")
  const [emailVerified, setEmailVerified] = useState(false)
  const [otpLoading, setOtpLoading] = useState(false)

  const handleSendOtp = async () => {
    if (!email) {
      setError("Please enter your email address first.")
      return
    }
    setError("")
    setOtpLoading(true)
    try {
      const response = await api.post("/api/v1/auth/email/send-otp", { email })
      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.detail || "Failed to send OTP.")
      }
      setOtpSent(true)
      const data = await response.json()
      if (data.otp_dev) {
        console.log(`[DEV OTP]: ${data.otp_dev}`)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setOtpLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (!otpCode) {
      setError("Please enter the 6-digit OTP code.")
      return
    }
    setError("")
    setOtpLoading(true)
    try {
      const response = await api.post("/api/v1/auth/email/verify-otp", { email, code: otpCode })
      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.detail || "OTP verification failed.")
      }
      setEmailVerified(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setOtpLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setSuccess(false)
    setLoading(true)

    try {
      await register(name, email, password, phone || null)
      setSuccess(true)
      
      // Auto-login user after successful registration
      setTimeout(async () => {
        try {
          await login(email, password)
          navigate("/")
        } catch (loginErr) {
          navigate("/login")
        }
      }, 1500)
    } catch (err) {
      console.error(err)
      setError(err.message || "Registration failed. Email might already exist.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-slate-50 px-4 py-12 relative overflow-hidden">
      <div className="absolute bottom-1/4 right-1/3 w-72 h-72 bg-brand-500/10 rounded-full blur-3xl"></div>
      
      <div className="glass-panel max-w-md w-full p-8 rounded-3xl shadow-xl shadow-slate-100/50 relative z-10">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-display font-extrabold text-slate-900">Create Account</h2>
          <p className="mt-2 text-sm text-slate-500 font-light">
            Sign up to register hospitals or log bed counts.
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
            <span>Account created successfully! Auto-logging in...</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Full Name
            </label>
            <div className="relative flex items-center">
              <User className="absolute left-3.5 h-5 w-5 text-slate-400" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 outline-none text-slate-800 placeholder-slate-400 bg-white/50 text-sm transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="flex gap-2 items-center">
              <div className="relative flex-grow flex items-center">
                <Mail className="absolute left-3.5 h-5 w-5 text-slate-400" />
                <input
                  type="email"
                  required
                  disabled={emailVerified}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john.doe@example.com"
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 outline-none text-slate-800 placeholder-slate-400 bg-white/50 text-sm transition-all disabled:opacity-75 disabled:bg-slate-100"
                />
              </div>
              {!emailVerified && (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={otpLoading || !email}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 transition-all shrink-0 cursor-pointer"
                >
                  {otpLoading ? "Sending..." : "Send OTP"}
                </button>
              )}
            </div>
          </div>

          {otpSent && !emailVerified && (
            <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-3">
              <label className="block text-xs font-semibold text-indigo-900 uppercase tracking-wider">
                Enter 6-Digit Email OTP
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  className="flex-grow px-3 py-2 text-center text-lg font-bold tracking-widest rounded-xl border border-indigo-200 outline-none focus:border-indigo-500 bg-white"
                />
                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={otpLoading || otpCode.length !== 6}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 transition-all shrink-0 cursor-pointer"
                >
                  Verify
                </button>
              </div>
              <p className="text-[10px] text-indigo-500 font-light">
                * Check your email inbox (and spam folder) for the 6-digit verification code.
              </p>
            </div>
          )}

          {emailVerified && (
            <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-800 flex items-center space-x-2 text-xs font-medium border border-emerald-200">
              <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
              <span>Email Address Verified Successfully!</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Phone Number (Optional)
            </label>
            <div className="relative flex items-center">
              <Phone className="absolute left-3.5 h-5 w-5 text-slate-400" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555-0199"
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 outline-none text-slate-800 placeholder-slate-400 bg-white/50 text-sm transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3.5 h-5 w-5 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 outline-none text-slate-800 placeholder-slate-400 bg-white/50 text-sm transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || success || !emailVerified}
            className="w-full py-3 mt-4 rounded-xl font-medium text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 disabled:from-slate-400 disabled:to-slate-400 shadow-md shadow-brand-500/20 transition-all flex items-center justify-center space-x-2 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader className="h-5 w-5 animate-spin" />
                <span>Creating Account...</span>
              </>
            ) : (
              <span>Register</span>
            )}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-slate-200/50 pt-6">
          <p className="text-sm text-slate-500 font-light">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
              Sign In Here
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
export default Register
