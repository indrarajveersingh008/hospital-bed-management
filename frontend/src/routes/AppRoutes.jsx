import React from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { Navbar } from "../layouts/Navbar"

// Pages
import { Home } from "../pages/Home"
import { Login } from "../pages/Login"
import { Register } from "../pages/Register"
import { Hospitals } from "../pages/Hospitals"
import { HospitalDetails } from "../pages/HospitalDetails"
import { HospitalDashboard } from "../pages/HospitalDashboard"
import { AdminDashboard } from "../pages/AdminDashboard"
import { ForgotPassword } from "../pages/ForgotPassword"
import { ResetPassword } from "../pages/ResetPassword"
import { RegisterHospital } from "../pages/RegisterHospital"

// Protected Route Guard Wrapper
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-10 w-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-slate-500 text-sm font-medium">Verifying Session...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return children
}

export const AppRoutes = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <main className="flex-grow">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/hospitals" element={<Hospitals />} />
          <Route path="/hospitals/:hospitalId" element={<HospitalDetails />} />
          <Route
            path="/register-hospital"
            element={
              <ProtectedRoute allowedRoles={["USER"]}>
                <RegisterHospital />
              </ProtectedRoute>
            }
          />

          {/* Protected Hospital Admin Dashboard */}
          <Route
            path="/hospital/dashboard"
            element={
              <ProtectedRoute allowedRoles={["HOSPITAL_ADMIN"]}>
                <HospitalDashboard />
              </ProtectedRoute>
            }
          />

          {/* Protected System Admin Dashboard */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
export default AppRoutes
