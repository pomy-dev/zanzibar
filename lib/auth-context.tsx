'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { AuthContextType, User } from './types'
import { dummyUsers } from './dummy-data'

const AuthContext = createContext<AuthContextType | undefined>(undefined)
const AUTH_STORAGE_KEY = 'auth_user'
const DEMO_PASSWORD = 'demo123'

// Demo-only accounts. Supabase authentication is intentionally bypassed here.
export const demoUsers: User[] = dummyUsers.map(({ id, email, name, role, branchId, createdAt }) => ({
  id, email, name, role, branchId: branchId ?? '', createdAt: new Date(createdAt)
}))

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem(AUTH_STORAGE_KEY)
      if (savedUser) {
        const parsed = JSON.parse(savedUser) as User
        const matchingUser = demoUsers.find((candidate) => candidate.id === parsed.id)
        if (matchingUser) setUser(matchingUser)
        else localStorage.removeItem(AUTH_STORAGE_KEY)
      }
    } catch {
      localStorage.removeItem(AUTH_STORAGE_KEY)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const login: AuthContextType['login'] = async (email, password) => {
    const matchedUser = demoUsers.find((candidate) => candidate.email === email.trim().toLowerCase())
    if (password !== DEMO_PASSWORD || !matchedUser) {
      throw new Error('Invalid email or password. Use a demo account and password demo123.')
    }
    setUser(matchedUser)
    setIsLoading(false)
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(matchedUser))
    return matchedUser
  }

  const logout = async () => {
    setUser(null)
    localStorage.removeItem(AUTH_STORAGE_KEY)
  }

  const register: AuthContextType['register'] = async () => {
    throw new Error('Registration is disabled for demo accounts.')
  }

  const updatePassword: AuthContextType['updatePassword'] = async (currentPassword, newPassword) => {
    if (!user) throw new Error('You must be signed in to change your password.')
    if (currentPassword !== DEMO_PASSWORD) throw new Error('Current password is incorrect.')
    if (newPassword !== DEMO_PASSWORD) throw new Error('Demo account passwords are fixed to demo123.')
  }

  const value: AuthContextType = {
    user,
    isAuthenticated: user !== null,
    isLoading,
    login,
    logout,
    register,
    updatePassword
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
