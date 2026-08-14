import React from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { Search, LogOut, User, Activity, Building, Shield } from "lucide-react"

export const Navbar = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate("/")
  }

  return (
    <nav className="glass-panel sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <Activity className="h-8 w-8 text-brand-600 animate-pulse" />
              <span className="font-display font-extrabold text-xl tracking-tight bg-gradient-to-r from-brand-600 to-indigo-600 bg-clip-text text-transparent">
                TrackBed
              </span>
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center space-x-4">
            <Link
              to="/hospitals"
              className="flex items-center space-x-1 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-700 hover:text-brand-600 hover:bg-slate-100/50 transition-all duration-200"
            >
              <Search className="h-4 w-4" />
              <span>Search Beds</span>
            </Link>

            <a
              href="https://expo.dev/artifacts/eas/nF3abcuVBP8cx-BUpPukxiaMHkcaP9uo6CIcjJwzDAs.apk"
              className="flex items-center space-x-1 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-700 hover:text-brand-600 hover:bg-slate-100/50 transition-all duration-200"
            >
              <Activity className="h-4 w-4 text-brand-600" />
              <span>Download App</span>
            </a>


            {user ? (
              <div className="flex items-center space-x-3">
                {/* Role Specific Actions */}
                {user.role === "USER" && (
                  <Link
                    to="/register-hospital"
                    className="flex items-center space-x-1 px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md shadow-emerald-500/25 transition-all duration-200"
                  >
                    <Building className="h-4 w-4" />
                    <span>Register Hospital</span>
                  </Link>
                )}

                {user.role === "HOSPITAL_ADMIN" && (
                  <Link
                    to="/hospital/dashboard"
                    className="flex items-center space-x-1 px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-brand-600 to-blue-600 hover:from-brand-700 hover:to-blue-700 shadow-md shadow-brand-500/25 transition-all duration-200"
                  >
                    <Building className="h-4 w-4" />
                    <span>Hospital Portal</span>
                  </Link>
                )}

                {user.role === "ADMIN" && (
                  <Link
                    to="/admin/dashboard"
                    className="flex items-center space-x-1 px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 shadow-md shadow-rose-500/25 transition-all duration-200"
                  >
                    <Shield className="h-4 w-4" />
                    <span>Admin Panel</span>
                  </Link>
                )}

                {/* Profile Display */}
                <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-200/50">
                  <User className="h-4 w-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700 max-w-[120px] truncate">
                    {user.name}
                  </span>
                </div>

                {/* Logout */}
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center p-2 rounded-xl text-slate-500 hover:text-red-500 hover:bg-red-50/50 transition-all duration-200"
                  title="Logout"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-brand-600 transition-all"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm transition-all"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
export default Navbar
