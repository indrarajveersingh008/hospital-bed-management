import React, { createContext, useState, useEffect, useContext } from "react"
import { api } from "../services/api"

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Fetch current user details
  const fetchCurrentUserProfile = async () => {
    try {
      const response = await api.get("/api/v1/users/me")
      if (response.ok) {
        const profile = await response.json()
        setUser(profile)
      } else {
        api.clearTokens()
        setUser(null)
      }
    } catch (error) {
      console.error("Failed to load user profile:", error)
      api.clearTokens()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  // Handle unauthorized events dispatched from api.js
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null)
    }

    window.addEventListener("unauthorized", handleUnauthorized)
    
    // Check user on app init
    if (localStorage.getItem("access_token")) {
      fetchCurrentUserProfile()
    } else {
      setLoading(false)
    }

    return () => {
      window.removeEventListener("unauthorized", handleUnauthorized)
    }
  }, [])

  // Login handler
  const login = async (email, password) => {
    try {
      const response = await api.post("/api/v1/auth/login", { email, password })
      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.detail || "Authentication failed")
      }
      
      const data = await response.json()
      if (data.mfa_required) {
        return { mfa_required: true, mfa_token: data.mfa_token }
      }

      api.setTokens(data.access_token, data.refresh_token)
      
      // Fetch user profile info
      const profileResponse = await api.get("/api/v1/users/me")
      if (profileResponse.ok) {
        const profile = await profileResponse.json()
        setUser(profile)
        return profile
      } else {
        throw new Error("Could not load user profile after login")
      }
    } catch (error) {
      api.clearTokens()
      setUser(null)
      throw error
    }
  }

  // MFA verification login handler
  const verifyMfaLogin = async (mfaToken, code) => {
    try {
      const response = await api.post("/api/v1/auth/mfa/login", {
        mfa_token: mfaToken,
        code: code,
      })

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.detail || "MFA validation failed")
      }

      const data = await response.json()
      api.setTokens(data.access_token, data.refresh_token)

      // Fetch user profile info
      const profileResponse = await api.get("/api/v1/users/me")
      if (profileResponse.ok) {
        const profile = await profileResponse.json()
        setUser(profile)
        return profile
      } else {
        throw new Error("Could not load user profile after MFA verification")
      }
    } catch (error) {
      api.clearTokens()
      setUser(null)
      throw error
    }
  }


  // Register handler
  const register = async (name, email, password, phone = null) => {
    const response = await api.post("/api/v1/auth/register", {
      name,
      email,
      password,
      phone,
    })
    if (!response.ok) {
      const errData = await response.json()
      throw new Error(errData.detail || "Registration failed")
    }
    return response.json()
  }

  // Logout handler
  const logout = async () => {
    const refreshToken = localStorage.getItem("refresh_token")
    if (refreshToken) {
      try {
        await api.post("/api/v1/auth/logout", { refresh_token: refreshToken })
      } catch (err) {
        console.error("Logout request failed:", err)
      }
    }
    api.clearTokens()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setUser, verifyMfaLogin }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  return useContext(AuthContext)
}
