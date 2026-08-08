const BASE_URL = import.meta.env.VITE_API_URL || "" // Fallback to relative proxy route in dev

class ApiClient {
  constructor() {
    this.accessToken = localStorage.getItem("access_token") || null
    this.refreshToken = localStorage.getItem("refresh_token") || null
    this.isRefreshing = false
    this.refreshSubscribers = []
  }

  setTokens(access, refresh) {
    this.accessToken = access
    localStorage.setItem("access_token", access)
    if (refresh) {
      this.refreshToken = refresh
      localStorage.setItem("refresh_token", refresh)
    }
  }

  clearTokens() {
    this.accessToken = null
    this.refreshToken = null
    localStorage.removeItem("access_token")
    localStorage.removeItem("refresh_token")
  }

  subscribeTokenRefresh(callback) {
    this.refreshSubscribers.push(callback)
  }

  onTokenRefreshed(access) {
    this.refreshSubscribers.forEach((cb) => cb(access))
    this.refreshSubscribers = []
  }

  async request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`
    
    // Set headers
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    }

    if (options.body instanceof FormData) {
      delete headers["Content-Type"]
    }

    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`
    }

    const config = {
      ...options,
      headers,
    }

    try {
      const response = await fetch(url, config)

      // Auto-refresh token if 401 received
      if (response.status === 401 && this.refreshToken && !options._retry) {
        if (this.isRefreshing) {
          return new Promise((resolve) => {
            this.subscribeTokenRefresh((token) => {
              config.headers["Authorization"] = `Bearer ${token}`
              resolve(this.request(endpoint, config))
            })
          })
        }

        options._retry = true
        this.isRefreshing = true

        try {
          const refreshResponse = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ refresh_token: this.refreshToken }),
          })

          if (refreshResponse.ok) {
            const data = await refreshResponse.json()
            this.setTokens(data.access_token, data.refresh_token)
            this.isRefreshing = false
            this.onTokenRefreshed(data.access_token)

            // Retry the original request
            config.headers["Authorization"] = `Bearer ${data.access_token}`
            return this.request(endpoint, config)
          } else {
            // Refresh token is expired or invalid
            this.clearTokens()
            this.isRefreshing = false
            // Trigger page reload or redirect
            window.dispatchEvent(new CustomEvent("unauthorized"))
            throw new Error("Session expired. Please login again.")
          }
        } catch (refreshError) {
          this.clearTokens()
          this.isRefreshing = false
          window.dispatchEvent(new CustomEvent("unauthorized"))
          throw refreshError
        }
      }

      return response
    } catch (error) {
      console.error("API Request Error:", error)
      throw error
    }
  }

  async get(endpoint, headers = {}) {
    return this.request(endpoint, { method: "GET", headers })
  }

  async post(endpoint, body, headers = {}) {
    return this.request(endpoint, {
      method: "POST",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  async put(endpoint, body, headers = {}) {
    return this.request(endpoint, {
      method: "PUT",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  async delete(endpoint, headers = {}) {
    return this.request(endpoint, { method: "DELETE", headers })
  }
}

export const api = new ApiClient()
