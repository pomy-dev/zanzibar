'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import { getUserById } from '@/services/auth-services'
import { getRoleAccesses } from '@/lib/constants'
import { Role } from '@/lib/types'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

async function getUserProfile(userId: string) {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error) throw error
  if (!session) return
  const userProfile = await getUserById(supabase, session, userId)

  return userProfile;
}

async function getLandingRoute(role?: Role): Promise<string> {
  if (!role) return '/settings';

  if (role.name.toLowerCase().replaceAll('_', ' ').trim() === 'affiliate secretary') return '/affiliate';

  const accesses = getRoleAccesses(role);

  for (const access of accesses) {
    switch (access) {
      case 'Overview':
        return '/dashboard';

      case 'Financial':
        return '/financial';

      case 'Branches':
        return '/branches';

      case 'Projects':
        return '/projects';

      case 'Events':
        return '/events';

      case 'Grievances':
        return '/helpdesk';

      case 'E-Filing':
        return '/e-filing';

      case 'Settings':
        return '/settings';

      case 'Users':
        return '/users';

      case 'Affiliates':
        return '/members';

      default:
        continue;
    }
  }

  return '/settings';
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const authenticatedUser = await login(email, password)
      const profile = await getUserProfile(authenticatedUser.id)
      const route = await getLandingRoute(profile?.role)
      router.push(route)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl">ZATUC</CardTitle>
          <CardDescription>Zanzibar Trade Union Congress · Member portal</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
