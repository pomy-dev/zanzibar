'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Users, DollarSign, Briefcase, AlertCircle, CheckCircle, Clock, Plus, Trash2, CalendarDays, ChevronRight } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { recordActivityLog } from '@/lib/constants'
import { useUserIP } from '@/lib/userUserIp'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

export default function DashboardPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { ip } = useUserIP()
  const [activeTab, setActiveTab] = useState('overview')
  const [articles, setArticles] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [financialRecords, setFinancialRecords] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [cases, setCases] = useState<any[]>([])
  const [affiliates, setAffiliates] = useState<any[]>([])
  const [affiliatePayments, setAffiliatePayments] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true)
  const [dashboardError, setDashboardError] = useState('')
  const [showArticleForm, setShowArticleForm] = useState(false)
  const [articleForm, setArticleForm] = useState({
    title: '',
    content: '',
    category: 'General',
    published: false,
    featuredImage: null as any,
    featuredImageCaption: '',
    attachedFiles: [] as any[]
  })

  useEffect(() => {
    try {
      setArticles(JSON.parse(localStorage.getItem('articles') || '[]'))
    } catch {
      setArticles([])
    }
  }, [activeTab])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const loadDashboard = async () => {
      setIsLoadingDashboard(true)
      setDashboardError('')
      try {
        const supabase = getSupabaseBrowserClient()
        if (!supabase) throw new Error('Supabase is not configured.')
        const [memberResult, branchResult, financeResult, projectResult, caseResult, affiliateResult, paymentResult, eventResult] = await Promise.all([
          supabase.from('members').select('id, branch_id, affiliate_id, tucoswa_status'),
          supabase.from('branches').select('id, branch_name'),
          supabase.from('financial_records').select('transaction_type, amount, transaction_date'),
          supabase.from('projects').select('id, status'),
          supabase.from('helpdesk_cases').select('id, title, status, updated_at, created_at, branch_id, affiliate_id'),
          supabase.from('affiliates').select('id, official_name, acronym, status, financial_standing, declared_membership, active'),
          supabase.from('affiliate_payments').select('affiliate_id, payment_date, recorded_at, status'),
          supabase.from('events').select('*'),
        ])
        const results = [memberResult, branchResult, financeResult, projectResult, caseResult, affiliateResult, paymentResult, eventResult]
        const failed = results.find(result => result.error)
        if (failed?.error) throw failed.error
        if (cancelled) return
        setMembers(memberResult.data ?? [])
        setBranches(branchResult.data ?? [])
        setFinancialRecords(financeResult.data ?? [])
        setProjects(projectResult.data ?? [])
        setCases(caseResult.data ?? [])
        setAffiliates(affiliateResult.data ?? [])
        setAffiliatePayments(paymentResult.data ?? [])
        setEvents(eventResult.data ?? [])
      } catch (error) {
        console.error('Unable to load dashboard data:', error)
        if (!cancelled) setDashboardError(error instanceof Error ? error.message : 'Unable to load dashboard data.')
      } finally {
        if (!cancelled) setIsLoadingDashboard(false)
      }
    }
    void loadDashboard()
    return () => { cancelled = true }
  }, [user])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      setArticleForm(prev => ({
        ...prev,
        featuredImage: ev.target?.result as string
      }))
    }
    reader.readAsDataURL(file)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        setArticleForm(prev => ({
          ...prev,
          attachedFiles: [...prev.attachedFiles, {
            name: file.name,
            url: ev.target?.result as string,
            caption: ''
          }]
        }))
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  const handleAddArticle = () => {
    if (!articleForm.title.trim() || !articleForm.content.trim()) {
      alert('Please fill in all fields')
      return
    }

    const newArticle = {
      id: `article_${Date.now()}`,
      title: articleForm.title,
      content: articleForm.content,
      category: articleForm.category,
      published: articleForm.published,
      featuredImage: articleForm.featuredImage,
      featuredImageCaption: articleForm.featuredImageCaption,
      attachedFiles: articleForm.attachedFiles,
      createdBy: user?.name,
      createdAt: new Date().toISOString()
    }

    const allArticles = [...articles, newArticle]
    localStorage.setItem('articles', JSON.stringify(allArticles))
    setArticles(allArticles)
    setArticleForm({ title: '', content: '', category: 'General', published: false, featuredImage: null, featuredImageCaption: '', attachedFiles: [] })
    setShowArticleForm(false)
    recordActivityLog('Published', `Uploaded & published article - ${newArticle.title} ${newArticle.category}`, user?.id, user?.name, ip!)
  }

  const handleDeleteArticle = (id: string) => {
    const updated = articles.filter(a => a.id !== id)
    localStorage.setItem('articles', JSON.stringify(updated))
    setArticles(updated)
    const deletedArticle = articles.find(a => a.id === id)?.title
    recordActivityLog('Unpublish', `Removed article - ${deletedArticle}`, user?.id, user?.name, ip!)
  }

  const stats = useMemo(() => {
    const totalIncome = financialRecords.filter(record => record.transaction_type === 'income')
      .reduce((sum, record) => sum + Number(record.amount || 0), 0)
    const totalExpense = financialRecords.filter(record => record.transaction_type === 'expense')
      .reduce((sum, record) => sum + Number(record.amount || 0), 0)
    return {
      totalMembers: members.length,
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      activeProjects: projects.filter(project => project.status === 'in_progress').length,
      openCases: cases.filter(item => item.status !== 'completed').length,
    }
  }, [members, financialRecords, projects, cases])

  const generateUniqueColors = (count: number): string[] => {
    const palette = ['#315A85', '#4F8A8B', '#80658F', '#C89C45', '#BF6B61'];
    return Array.from({ length: count }, (_, index) => palette[index % palette.length]);
  };

  const chartData = useMemo(() => {
    const months = Array.from({ length: 7 }, (_, index) => {
      const date = new Date()
      date.setDate(1)
      date.setMonth(date.getMonth() - (6 - index))
      return { key: `${date.getFullYear()}-${date.getMonth()}`, month: date.toLocaleDateString('en', { month: 'short' }), income: 0, expense: 0 }
    })
    financialRecords.forEach(record => {
      const date = new Date(record.transaction_date)
      const row = months.find(item => item.key === `${date.getFullYear()}-${date.getMonth()}`)
      if (!row) return
      if (record.transaction_type === 'income') row.income += Number(record.amount || 0)
      else if (record.transaction_type === 'expense') row.expense += Number(record.amount || 0)
    })
    return months.map(({ month, income, expense }) => ({ month, income, expense }))
  }, [financialRecords])

  const branchData = useMemo(() => branches.map(branch => ({
    name: branch.branch_name,
    value: members.filter(member => member.branch_id === branch.id).length,
  })), [branches, members])

  const affiliateSnapshot = useMemo(() => {
    const activeAffiliates = affiliates.filter(affiliate => affiliate.active !== false)
      .map(affiliate => ({
        ...affiliate,
        memberCount: Number(affiliate.declared_membership ?? 0),
        lastSubscription: affiliatePayments
          .filter(payment => payment.affiliate_id === affiliate.id && payment.status === 'Received')
          .sort((a, b) => Date.parse(b.payment_date || b.recorded_at) - Date.parse(a.payment_date || a.recorded_at))[0],
      }))
      .sort((a, b) => b.memberCount - a.memberCount)
    const maxMembers = Math.max(1, ...activeAffiliates.map(affiliate => affiliate.memberCount))
    return activeAffiliates.slice(0, 3).map(affiliate => ({
      ...affiliate,
      membershipProgress: Math.round(affiliate.memberCount / maxMembers * 100),
    }))
  }, [affiliates, members, affiliatePayments])

  const recentCases = useMemo(() => cases
    .filter(item => item.status !== 'completed')
    .sort((a, b) => Date.parse(b.updated_at || b.created_at) - Date.parse(a.updated_at || a.created_at))
    .slice(0, 5), [cases])
  const upcomingEvents = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return events.filter(event => !event.archived && String(event.event_date ?? '').slice(0, 10) >= today)
      .sort((a, b) => String(a.event_date).localeCompare(String(b.event_date)))
      .slice(0, 5)
  }, [events])

  const pieColors = useMemo(() => {
    return generateUniqueColors(branchData.length);
  }, [branchData.length]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back to ZATUC Management System</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition ${activeTab === 'overview'
            ? 'border-primary text-primary'
            : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('articles')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition ${activeTab === 'articles'
            ? 'border-primary text-primary'
            : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          Articles & Content
        </button>
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {dashboardError && <p role="alert" className="text-sm text-destructive">{dashboardError}</p>}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Members</CardTitle>
                <Users className="w-4 h-4 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalMembers}</div>
                <p className="text-xs text-muted-foreground mt-1">Active members across all branches</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Balance</CardTitle>
                <DollarSign className="w-4 h-4 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">E{(stats.balance / 1000).toFixed(0)}K</div>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="text-green-600 font-semibold">+E{(stats.totalIncome / 1000).toFixed(0)}K</span> income
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
                <Briefcase className="w-4 h-4 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.activeProjects}</div>
                <p className="text-xs text-muted-foreground mt-1">Currently in progress</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Open Cases</CardTitle>
                <AlertCircle className="w-4 h-4 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.openCases}</div>
                <p className="text-xs text-muted-foreground mt-1">Pending resolution</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Income vs Expenses</CardTitle>
                <CardDescription>Monthly financial overview</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="income" fill="#315A85" name="Income" />
                    <Bar dataKey="expense" fill="#BF6B61" name="Expense" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Members by Branch</CardTitle>
                <CardDescription>Distribution across regions</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={branchData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={80}
                      fill="#4F8A8B"
                      dataKey="value"
                    >
                      {branchData.map((_entry: { name: string; value: number }, index: number) => (
                        <Cell key={`cell-${index}`} fill={pieColors[index]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      iconType="circle"
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>Affiliate membership snapshot</CardTitle>
                <CardDescription>Top three active affiliates by registered individual members</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => router.push('/members')}>
                More <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {isLoadingDashboard ? <p className="text-sm text-muted-foreground">Loading affiliate data…</p> : affiliateSnapshot.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active affiliates found.</p>
              ) : (
                <div className="space-y-5">
                  {affiliateSnapshot.map(affiliate => (
                    <div key={affiliate.id} className="grid gap-3 border-b border-border pb-4 last:border-0 last:pb-0 md:grid-cols-[minmax(0,1.3fr)_auto_auto_minmax(180px,1fr)] md:items-center">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{affiliate.acronym || affiliate.official_name}</p>
                        <p className="truncate text-xs text-muted-foreground">{affiliate.official_name}</p>
                      </div>
                      <Badge variant="secondary">{affiliate.status || 'Status not recorded'}</Badge>
                      <div>
                        <Badge className={affiliate.financial_standing === 'Good standing' ? 'bg-emerald-100 text-emerald-800' : affiliate.financial_standing === 'Arrears' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}>
                          {affiliate.financial_standing || 'Standing not recorded'}
                        </Badge>
                        <p className="mt-1 text-xs text-muted-foreground">Last subscription: {affiliate.lastSubscription?.payment_date ? new Date(affiliate.lastSubscription.payment_date).toLocaleDateString() : 'Not recorded'}</p>
                      </div>
                      <div>
                        <div className="mb-1 flex justify-between text-xs">
                          <span>{affiliate.memberCount} members</span>
                          <span>{affiliate.membershipProgress}% of largest affiliate</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${affiliate.acronym || affiliate.official_name} membership compared with largest affiliate`} aria-valuenow={affiliate.membershipProgress} aria-valuemin={0} aria-valuemax={100}>
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${affiliate.membershipProgress}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <div>
                  <CardTitle>Recent grievances & queries</CardTitle>
                  <CardDescription>{stats.openCases} unresolved cases</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => router.push('/helpdesk')}>
                  View all <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                {isLoadingDashboard ? <p className="text-sm text-muted-foreground">Loading grievances…</p> : recentCases.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No unresolved grievances or queries.</p>
                ) : (
                  <div className="space-y-2">
                    {recentCases.map(item => (
                      <Link key={item.id} href={`/helpdesk/${item.id}`} className="flex w-full items-center justify-between gap-3 border-b border-border p-3 text-left transition hover:bg-muted/50">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{item.title}</span>
                          <span className="block text-xs text-muted-foreground">{item.member_name || 'Member query'} · {new Date(item.updated_at || item.created_at).toLocaleDateString()}</span>
                        </span>
                        <Badge variant="secondary" className="shrink-0">{String(item.status).replaceAll('_', ' ')}</Badge>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <div>
                  <CardTitle>Coming events</CardTitle>
                  <CardDescription>Upcoming union and affiliate events</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => router.push('/events')}>
                  View all <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                {isLoadingDashboard ? <p className="text-sm text-muted-foreground">Loading events…</p> : upcomingEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No upcoming events scheduled.</p>
                ) : (
                  <div className="space-y-2">
                    {upcomingEvents.map(event => (
                      <button key={event.id} type="button" onClick={() => router.push(`/events/${event.id}`)} className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition hover:bg-muted/50">
                        <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-md bg-primary/10 text-primary">
                          <CalendarDays className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{event.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">{event.location || 'Location not set'} · {new Date(event.event_date).toLocaleDateString()}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ARTICLES TAB */}
      {activeTab === 'articles' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Articles & Content</h2>
              <p className="text-muted-foreground mt-1">Manage articles that appear on the website</p>
            </div>
            <Button onClick={() => setShowArticleForm(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              New Article
            </Button>
          </div>

          {showArticleForm && (
            <Card>
              <CardHeader>
                <CardTitle>Create New Article</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title">Article Title *</Label>
                  <Input
                    id="title"
                    placeholder="Article title"
                    value={articleForm.title}
                    onChange={(e) => setArticleForm({ ...articleForm, title: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="content">Content *</Label>
                  <Textarea
                    id="content"
                    placeholder="Article content..."
                    value={articleForm.content}
                    onChange={(e) => setArticleForm({ ...articleForm, content: e.target.value })}
                    rows={6}
                  />
                </div>

                <div>
                  <Label htmlFor="category">Category</Label>
                  <select
                    id="category"
                    value={articleForm.category}
                    onChange={(e) => setArticleForm({ ...articleForm, category: e.target.value })}
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-md text-sm 
                      focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary appearance-none"
                  >
                    <option value="General">General</option>
                    <option value="News">News</option>
                    <option value="Announcement">Announcement</option>
                    <option value="Guide">Guide</option>
                    <option value="Resources">Resources</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="featuredImage">Featured Image</Label>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label>
                        <Button type="button" onClick={() => document.getElementById("featuredImage")?.click()} variant="outline" className="w-full">
                          Choose Image
                        </Button>
                        <input
                          id="featuredImage"
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                    {articleForm.featuredImage && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setArticleForm({ ...articleForm, featuredImage: null })}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  {articleForm.featuredImage && (
                    <div className='flex flex-wrap items-start gap-8 mt-6'>
                      <div>
                        <img src={articleForm.featuredImage} alt="Featured" className="w-40 h-40 object-stretch rounded" />
                      </div>

                      <div>
                        <Label htmlFor="imageCaption">Caption</Label>
                        <Textarea
                          id="imageCaption"
                          className='w-2xl'
                          placeholder="Add a caption for the featured image"
                          value={articleForm.featuredImageCaption}
                          onChange={(e) => setArticleForm({ ...articleForm, featuredImageCaption: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <Label>Attach Files</Label>
                  <label>
                    <Button type="button" onClick={() => document.getElementById("articleFile")?.click()} variant="outline" className="w-full">
                      Upload Files
                    </Button>

                    <input
                      id='articleFile'
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {articleForm.attachedFiles.length > 0 && (
                  <div>
                    <Label className="mb-2 block">Attached Files ({articleForm.attachedFiles.length})</Label>
                    <div className="space-y-2">
                      {articleForm.attachedFiles.map((file, idx) => (
                        <div key={idx} className="p-3 border rounded-lg space-y-2 bg-muted/30">
                          <div className="flex justify-between items-start">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setArticleForm(prev => ({
                                ...prev,
                                attachedFiles: prev.attachedFiles.filter((_, i) => i !== idx)
                              }))}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                          <Input
                            placeholder="Add caption for this file"
                            value={file.caption}
                            onChange={(e) => {
                              const updated = [...articleForm.attachedFiles]
                              updated[idx].caption = e.target.value
                              setArticleForm(prev => ({ ...prev, attachedFiles: updated }))
                            }}
                            className="text-xs"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="published"
                    checked={articleForm.published}
                    onChange={(e) => setArticleForm({ ...articleForm, published: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="published" className="cursor-pointer">Publish to website</Label>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleAddArticle}>Create Article</Button>
                  <Button variant="outline" onClick={() => setShowArticleForm(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Articles List */}
          <div className="grid gap-4">
            {articles.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No articles yet. Create your first article to get started!
                </CardContent>
              </Card>
            ) : (
              articles.map(article => (
                <Card key={article.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{article.title}</CardTitle>
                          {article.published ? (
                            <Badge className="gap-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              <CheckCircle className="w-3 h-3" />
                              Published
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <Clock className="w-3 h-3" />
                              Draft
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                          <span className="px-2 py-1 bg-muted rounded">{article.category}</span>
                          <span>{new Date(article.createdAt).toLocaleDateString()}</span>
                          <span>By {article.createdBy}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteArticle(article.id)}
                        className="text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-3">{article.content}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
