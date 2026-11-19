'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Bell, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

export function Header() {
  const { user } = useAuth()
  const router = useRouter()
  const [openGrievanceCount, setOpenGrievanceCount] = useState(0)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return

    const refreshCount = async () => {
      const { count, error } = await supabase
        .from('helpdesk_cases')
        .select('id', { count: 'exact', head: true })
        .neq('status', 'completed')
      if (error) {
        console.error('Unable to load unresolved grievance count:', error)
        return
      }
      if (!cancelled) setOpenGrievanceCount(count ?? 0)
    }

    void refreshCount()
    const channel = supabase.channel('header-open-helpdesk-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'helpdesk_cases' }, () => { void refreshCount() })
      .subscribe()
    window.addEventListener('focus', refreshCount)

    return () => {
      cancelled = true
      window.removeEventListener('focus', refreshCount)
      void supabase.removeChannel(channel)
    }
  }, [user])

  return (
    <header className="bg-card border-b border-border h-16 flex items-center justify-between px-6">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            className="pl-10 h-9"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          aria-label={`${openGrievanceCount} unresolved grievances or queries. Open grievances`}
          onClick={() => router.push('/helpdesk')}
          className="relative"
        >
          <Bell className="w-5 h-5" />
          {openGrievanceCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
            {openGrievanceCount > 99 ? '99+' : openGrievanceCount}
          </span>}
        </Button>

        <div className="flex items-center gap-3 pl-4 border-l border-border">
          <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center">
            <span className="text-sm font-semibold text-accent-foreground">
              {user?.name?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="text-sm">
            <p className="font-medium text-foreground">{user?.name}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
