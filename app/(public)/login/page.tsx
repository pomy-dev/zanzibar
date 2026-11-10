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
const landingRoutes: Record<string, string> = {
  sg: '/dashboard',
  accountant: '/financial',
  project_coordinator: '/projects',
  events_manager: '/events',
  branch_admin: '/branches'
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
      router.push(landingRoutes[authenticatedUser.role] ?? '/dashboard')
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
              <p className="text-xs text-muted-foreground">Demo accounts end in @zanzibar.org</p>
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
              <p className="text-xs text-muted-foreground">Password: demo123</p>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 p-3 bg-accent/10 rounded-lg">
            <p className="text-xs font-semibold mb-2">Demo Accounts:</p>
            <ul className="text-xs space-y-1 text-muted-foreground">
              <li>• Secretary General: sg@zanzibar.org</li>
              <li>• Accountant: accountant@zanzibar.org</li>
              <li>• Project Coordinator: projectcoordinator@zanzibar.org</li>
              <li>• Events Manager: eventsmanager@zanzibar.org</li>
              <li>• Branch Admin: branchadmin@zanzibar.org</li>
            </ul>
            <p className="text-xs mt-2 font-semibold">Password: demo123</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
