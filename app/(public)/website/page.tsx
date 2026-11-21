'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft, ArrowRight, BookOpen, CheckCircle, Clock, Handshake,
  Mail, Megaphone, MessageCircle, Scale, ShieldCheck,
  Sparkles, UsersRound, AlertTriangle
} from 'lucide-react'
import Twitter from '@/public/twitter.png'
import Facebook from '@/public/facebook.png'
import type { Article, ArticleAttachment, Event, EventFile, HelpDeskCase } from '@/lib/types'
import { AddMemberModal } from '@/components/modals/add-member-modal'
import { FileCaseModal } from '@/components/modals/file-case-modal'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { getArticleFileUrl, getArticles } from '@/services/article-service'
import { getEvents, getEventFiles } from '@/services/events-service'
import { createMember } from '@/services/affiliate-service'
import { getAllBranches } from '@/services/branch-service'

type PublicArticle = Article & {
  featuredImageUrl: string | null
  attachmentUrls: Record<string, string>
}
type PublicEvent = Event & { files: EventFile[] }

export default function PublicWebsite() {
  const [statistics, setStatistics] = useState({
    members: 0,
    projects: 0,
    branches: 0,
    affiliates: 0
  })

  const [publishedArticles, setPublishedArticles] = useState<PublicArticle[]>([])
  const [publicEvents, setPublicEvents] = useState<PublicEvent[]>([])
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [registrationMessage, setRegistrationMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [articleLoadError, setArticleLoadError] = useState('')
  const aboutSectionRef = useRef<HTMLDivElement>(null)

  const [showAddMemberModal, setShowAddMemberModal] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showFileModal, setShowFileModal] = useState(false)
  const [selectedArticle, setSelectedArticle] = useState<PublicArticle | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<PublicEvent | null>(null)

  // Carousel state
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const carouselRef = useRef<HTMLDivElement>(null)

  // Load published articles and their media from Supabase.
  useEffect(() => {
    if (typeof window === 'undefined') return

    let cancelled = false
    const loadPublicContent = async () => {
      try {
        const supabase = getSupabaseBrowserClient()
        if (!supabase) throw new Error('Public articles are temporarily unavailable.')
        const [articles, events, branchRows, statisticsResult] = await Promise.all([
          getArticles(supabase),
          getEvents(supabase),
          getAllBranches(supabase),
          supabase.rpc('get_public_website_statistics')
        ])
        if (cancelled) return
        const publicArticles = articles
          .filter(article => article.published)
          .map(article => ({
            ...article,
            featuredImageUrl: article.featured_image_path
              ? getArticleFileUrl(supabase, article.featured_image_path)
              : null,
            attachmentUrls: Object.fromEntries(
              (article.attachments ?? []).map((attachment: ArticleAttachment) => [
                attachment.id,
                getArticleFileUrl(supabase, attachment.file_path)
              ])
            )
          }))
        setPublishedArticles(publicArticles)
        const visibleEvents = events.filter(event => !event.archived)
        setPublicEvents(await Promise.all(visibleEvents.map(async event => ({
          ...event,
          files: await getEventFiles(supabase, event.id)
        }))))
        setBranches(branchRows.map(branch => ({ id: branch.id, name: (branch as any).branch_name ?? branch.name })))
        if (statisticsResult.error) {
          console.error('Unable to load public website statistics:', statisticsResult.error)
        } else {
          const stats = statisticsResult.data as { members?: number; projects?: number; branches?: number; affiliates?: number } | null
          setStatistics({
            members: Number(stats?.members ?? 0),
            projects: Number(stats?.projects ?? 0),
            branches: Number(stats?.branches ?? 0),
            affiliates: Number(stats?.affiliates ?? 0)
          })
        }
        setArticleLoadError('')
      } catch (error) {
        if (!cancelled)
          setArticleLoadError(
            error instanceof Error ? error.message : 'Unable to load public articles.'
          )
      }
    }
    void loadPublicContent()
    return () => {
      cancelled = true
    }
  }, [])

  // Auto-advance carousel
  useEffect(() => {
    if (publishedArticles.length + publicEvents.length <= 1 || isPaused) return

    const interval = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % (publishedArticles.length + publicEvents.length))
    }, 6000)

    return () => clearInterval(interval)
  }, [publishedArticles.length, publicEvents.length, isPaused])

  const goToSlide = useCallback((index: number) => {
    setCurrentSlide(index)
  }, [])

  const nextSlide = useCallback(() => {
    setCurrentSlide(prev => (prev + 1) % (publishedArticles.length + publicEvents.length))
  }, [publishedArticles.length, publicEvents.length])

  const prevSlide = useCallback(() => {
    setCurrentSlide(prev => (prev - 1 + publishedArticles.length + publicEvents.length) % (publishedArticles.length + publicEvents.length))
  }, [publishedArticles.length, publicEvents.length])

  const handleFileCase = async (caseData: Partial<HelpDeskCase>) => {
    setIsLoading(true)
    try {
      const supabase = getSupabaseBrowserClient()
      if (!supabase) throw new Error('Supabase is not configured.')
      const { error } = await supabase.from('helpdesk_cases').insert({
        branch_id: caseData.branch_id || null, title: caseData.title, member_name: caseData.member_name,
        member_phone: caseData.member_phone, member_email: caseData.member_email,
        description: caseData.description, status: 'pending', created_by_name: caseData.member_name || 'Website visitor'
      })
      if (error) throw error
      setShowFileModal(false)
      setRegistrationMessage({ kind: 'success', text: 'Your grievance was submitted successfully.' })
    } catch (error) {
      setRegistrationMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Unable to submit your grievance.' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[#f7f8fa] text-slate-900">
      {/* Top bar */}
      <div className="bg-[#1a3a52] px-4 py-2.5 text-center text-xs font-semibold tracking-[0.2em] text-white/90">
        ZATUC · ZANZIBAR TRADE UNION CONGRESS
      </div>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <a href="#top" className="flex items-center gap-3">
            <img
              src="/zatuc-logo.png"
              alt="ZATUC logo"
              className="h-11 w-11 rounded-xl object-cover shadow-md"
            />
            <span>
              <span className="block text-lg font-bold tracking-tight text-[#1a3a52]">ZATUC</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Solidarity forever.
              </span>
            </span>
          </a>

          <div className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <a href="#about" className="transition hover:text-[#c45c2a]">
              Our movement
            </a>
            <a href="#priorities" className="transition hover:text-[#c45c2a]">
              Priorities
            </a>
            <a href="#updates" className="transition hover:text-[#c45c2a]">
              Updates
            </a>
            <a href="#contact" className="transition hover:text-[#c45c2a]">
              Contact
            </a>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              className="hidden text-[#1a3a52] sm:inline-flex"
              onClick={() => (window.location.href = '/login')}
            >
              Member login
            </Button>
            <Button
              type="button"
              className="bg-[#c45c2a] text-white shadow-md hover:bg-[#a84d22]"
              onClick={() => setShowAddMemberModal(true)}
            >
              Join ZATUC
            </Button>
          </div>
        </div>
      </nav>

      <main id="top">
        {/* Hero */}
        <section className="relative isolate overflow-hidden bg-[#1a3a52] text-white">
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#c45c2a]/25 blur-3xl" />
          <div className="absolute -bottom-32 left-1/3 h-96 w-96 rounded-full bg-[#2a9d8f]/15 blur-3xl" />

          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-28">
            <div className="relative z-10">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-white/85">
                <span className="h-1.5 w-1.5 rounded-full bg-[#e8b84a]" />
                A united voice for Zanzibar’s workers
              </div>

              <h1 className="max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Dignity at work.
                <br />
                <span className="text-[#e8b84a]">Solidarity in action.</span>
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-200">
                The Zanzibar Trade Union Congress brings workers and unions together to advance
                decent work, social dialogue, and the rights and welfare of working people across
                Unguja and Pemba.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  size="lg"
                  className="gap-2 bg-[#c45c2a] px-6 text-white hover:bg-[#a84d22]"
                  onClick={() => setShowAddMemberModal(true)}
                >
                  <UsersRound className="h-4 w-4" />
                  Become a member
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/25 bg-white/10 px-6 text-white hover:bg-white/20 hover:text-white"
                  onClick={() => aboutSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
                >
                  Discover our work
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>

              <div className="mt-12 grid max-w-2xl grid-cols-2 gap-6 border-t border-white/10 pt-6 sm:grid-cols-4">
                <div>
                  <div className="text-2xl font-bold text-[#e8b84a]">
                    {statistics.members.toLocaleString()}
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-wider text-slate-300">
                    Members
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-[#e8b84a]">
                    {statistics.branches.toLocaleString()}
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-wider text-slate-300">
                    Branches
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-[#e8b84a]">
                    {statistics.projects.toLocaleString()}
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-wider text-slate-300">
                    Projects
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-[#e8b84a]">
                    {statistics.affiliates.toLocaleString()}
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-wider text-slate-300">
                    Affiliates
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-2 rounded-2xl border border-[#e8b84a]/25 rotate-2" />
              <div className="relative overflow-hidden rounded-2xl border-4 border-white/10 bg-slate-800 shadow-2xl">
                <img
                  src="/executive.jpeg"
                  alt="Workers marching together in Tanzania"
                  className="aspect-[4/3] w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0f2a3d] via-[#0f2a3d]/80 to-transparent p-6 pt-16">
                  <p className="max-w-sm text-sm font-medium leading-relaxed text-white">
                    “In unity we are guaranteed strength.”
                  </p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-[#e8b84a]">
                    The ZATUC spirit
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* About */}
        <section
          id="about"
          ref={aboutSectionRef}
          className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24"
        >
          <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c45c2a]">
                Our movement
              </p>
              <h2 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-[#1a3a52] sm:text-4xl">
                Zanzibar’s workers, organised for dignity.
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-slate-600">
                ZATUC is Zanzibar’s national trade union centre, bringing affiliated unions together
                around workers’ rights, decent work, social dialogue, and a stronger collective voice.
              </p>
              <p className="mt-4 text-base leading-relaxed text-slate-500">
                From workplace organising to regional cooperation, our movement connects the everyday
                realities of workers with the policies and institutions that shape their lives.
              </p>
              <Button
                variant="outline"
                className="mt-7 gap-2 border-[#1a3a52]/25 text-[#1a3a52] hover:bg-[#1a3a52] hover:text-white"
                onClick={() => setShowFileModal(true)}
              >
                Raise a workplace concern
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  icon: Handshake,
                  title: 'Unity across Zanzibar',
                  copy: 'A shared platform for affiliates and members across Unguja, Pemba, and every sector of work.'
                },
                {
                  icon: Scale,
                  title: 'Decent work',
                  copy: 'Advocating for fair treatment, safe workplaces, and the dignity of working families.'
                },
                {
                  icon: Megaphone,
                  title: 'Social dialogue',
                  copy: 'Turning workers’ lived experience into informed advocacy and constructive public action.'
                },
                {
                  icon: ShieldCheck,
                  title: 'Rights at work',
                  copy: 'Standing for freedom of association, organising, equality, and fair representation.'
                }
              ].map(({ icon: Icon, title, copy }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-[#c45c2a]/30 hover:shadow-md"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1a3a52]/8 text-[#1a3a52]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-[#1a3a52]">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Full-bleed image */}
        <section
          aria-label="Zanzibar communities standing together in solidarity"
          className="min-h-[70svh] w-full bg-[#1a3a52] bg-cover bg-center bg-fixed"
          style={{ backgroundImage: "url('/hands-on.jpeg')" }}
        />

        {/* Priorities */}
        <section id="priorities" className="bg-[#eef2f4] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c45c2a]">
                What we stand for
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#1a3a52] sm:text-4xl">
                A workers’ movement rooted in Zanzibar.
              </h2>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {[
                {
                  number: '01',
                  title: 'Organise',
                  copy: 'Build strong, democratic structures where members can participate and lead.'
                },
                {
                  number: '02',
                  title: 'Educate',
                  copy: 'Equip workers with the knowledge to understand rights, responsibilities, and collective action.'
                },
                {
                  number: '03',
                  title: 'Represent',
                  copy: 'Carry workers’ priorities into social dialogue and advocacy for fair, inclusive workplaces.'
                }
              ].map(item => (
                <div
                  key={item.number}
                  className="relative overflow-hidden rounded-2xl bg-[#1a3a52] p-7 text-white shadow-lg transition hover:-translate-y-1"
                >
                  <span className="absolute -right-2 -top-6 text-[7rem] font-bold leading-none text-white/5">
                    {item.number}
                  </span>
                  <div className="relative">
                    <span className="text-sm font-semibold text-[#e8b84a]">{item.number}</span>
                    <h3 className="mt-8 text-2xl font-bold">{item.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-slate-300">{item.copy}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 grid gap-6 overflow-hidden rounded-2xl bg-white shadow-sm md:grid-cols-[0.9fr_1.1fr]">
              <img
                src="/meeting.jpeg"
                alt="Workers and traders in Stone Town, Zanzibar"
                className="h-full min-h-64 w-full object-cover"
              />
              <div className="flex flex-col justify-center p-6 md:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c45c2a]">
                  Democracy is workplace work
                </p>
                <h3 className="mt-3 text-2xl font-bold leading-snug text-[#1a3a52]">
                  Accountability grows when workers have a seat at the table.
                </h3>
                <p className="mt-4 leading-relaxed text-slate-600">
                  ZATUC’s organising and education work connects workplace realities with social
                  dialogue — strengthening participation, gender equality, and accountable union
                  structures.
                </p>
                <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-[#1a3a52]">
                  <BookOpen className="h-4 w-4 text-[#c45c2a]" />
                  Education, participation, representation
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===================== UPDATES – BANNER CAROUSEL ===================== */}
        <section id="updates" className="bg-white">
          <div className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8">
            <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c45c2a]">
                  Stay connected
                </p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#1a3a52]">
                  From the movement
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-relaxed text-slate-500">
                Follow union news, events, and member-led action from across Zanzibar.
              </p>
            </div>
          </div>

          {articleLoadError ? (
            <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
              <p role="alert" className="text-sm text-slate-500">
                {articleLoadError}
              </p>
            </div>
          ) : publishedArticles.length + publicEvents.length > 0 ? (
            <div
              ref={carouselRef}
              className="relative w-full"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              {/* Slides */}
              <div className="relative h-[520px] w-full overflow-hidden sm:h-[560px] lg:h-[600px]">
                {Array.from({ length: publishedArticles.length + publicEvents.length }).map((_, index) => {
                  const event = index < publicEvents.length ? publicEvents[index] : null
                  const article = event ? null : publishedArticles[index - publicEvents.length]
                  return (
                    <div
                      key={event ? `event-${event.id}` : `article-${article!.id}`}
                      className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'
                        }`}
                    >
                      {/* Background image or solid fallback */}
                      <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{
                          backgroundImage: article?.featuredImageUrl
                            ? `url(${article.featuredImageUrl})`
                            : undefined,
                          backgroundColor: article?.featuredImageUrl ? undefined : '#1a3a52'
                        }}
                      />
                      {/* Dark gradient overlay for readability */}
                      <div className="absolute inset-0 bg-gradient-to-r from-[#0f2a3d]/92 via-[#0f2a3d]/70 to-[#0f2a3d]/40" />

                      {/* Content */}
                      <div className="relative z-10 flex h-full items-center">
                        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
                          <div className="max-w-2xl text-white">
                            <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
                              <span className="rounded-full bg-white/15 px-3 py-1 font-medium backdrop-blur-sm">
                                {event ? 'Event' : article!.category}
                              </span>
                              <span className="text-white/80">
                                {new Date(event ? event.event_date : article!.created_at).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </span>
                            </div>

                            <h3 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                              {event ? event.title : article!.title}
                            </h3>

                            <p className="mt-5 line-clamp-3 text-base leading-relaxed text-white/85 sm:text-lg">
                              {event ? `${event.location ? `${event.location} · ` : ''}${event.notes}` : article!.content}
                            </p>

                            <Button
                              size="lg"
                              className="mt-8 gap-2 bg-[#c45c2a] text-white hover:bg-[#a84d22]"
                              onClick={() => event ? setSelectedEvent(event) : article && setSelectedArticle(article)}
                            >
                              {event ? 'Event details' : 'Read full article'}
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      {event?.files.some(file => file.url && file.file_kind === 'document') ? <div className="absolute bottom-20 right-8 z-20 flex flex-wrap justify-end gap-2">{event.files.filter(file => file.url && file.file_kind === 'document').map(file => <a key={file.id} href={`${file.url!.split('?')[0]}?download=${encodeURIComponent(file.name)}`} download={file.name} className="rounded bg-white px-3 py-2 text-xs font-semibold text-[#1a3a52]">Download {file.name}</a>)}</div> : null}
                    </div>
                  )
                })}
              </div>

              {/* Controls */}
              {publishedArticles.length + publicEvents.length > 1 && (
                <>
                  {/* Prev / Next */}
                  <button
                    type="button"
                    onClick={prevSlide}
                    aria-label="Previous update"
                    className="absolute left-4 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/25 sm:left-6"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={nextSlide}
                    aria-label="Next update"
                    className="absolute right-4 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/25 sm:right-6"
                  >
                    <ArrowRight className="h-5 w-5" />
                  </button>

                  {/* Dots */}
                  <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 gap-2">
                    {Array.from({ length: publishedArticles.length + publicEvents.length }).map((_, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => goToSlide(index)}
                        aria-label={`Go to update ${index + 1}`}
                        className={`h-2.5 rounded-full transition-all ${index === currentSlide
                          ? 'w-8 bg-white'
                          : 'w-2.5 bg-white/40 hover:bg-white/70'
                          }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
                <Sparkles className="mx-auto h-7 w-7 text-[#c45c2a]" />
                <h3 className="mt-4 text-xl font-bold text-[#1a3a52]">
                  News and resources are on the way
                </h3>
                <p className="mx-auto mt-2 max-w-md text-slate-500">
                  This space will carry the latest updates, statements, and resources from the
                  movement.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Full-bleed image */}
        <section
          aria-label="Zanzibar heritage, livelihoods, and working communities"
          className="min-h-[70svh] w-full bg-[#1a3a52] bg-cover bg-center bg-fixed"
          style={{ backgroundImage: "url('/funding.jpeg')" }}
        />

        {/* CTA */}
        <section id="contact" className="bg-[#c45c2a] px-4 py-14 text-white sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 md:flex-row md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
                Your voice matters
              </p>
              <h2 className="mt-2 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
                Stand with workers. Strengthen Zanzibar’s movement.
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                size="lg"
                className="bg-[#1a3a52] px-6 text-white hover:bg-[#0f2a3d]"
                onClick={() => setShowAddMemberModal(true)}
              >
                Join ZATUC
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/50 bg-transparent text-white hover:bg-white hover:text-[#c45c2a]"
                onClick={() => setShowFileModal(true)}
              >
                File a grievance
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Modals */}
      <AddMemberModal
        open={showAddMemberModal}
        onOpenChange={setShowAddMemberModal}
        availableBranches={branches}
        onSubmit={async (member: any) => {
          setIsLoading(true)
          try {
            const supabase = getSupabaseBrowserClient()
            if (!supabase) throw new Error('Supabase is not configured.')

            const newMember = await createMember(supabase, {
              branch_id: member?.branch_id, name: member.name,
              email: member.email, phone: member.phone,
              member_id: `ZATUC-M-${crypto.randomUUID().slice(0, 4)}`,
              gender: member.gender ?? 'Other', date_of_birth: member.dob,
              workplace: member.workplace ?? '', address: member.address ?? '',
              next_of_kin: member.next_of_kin ?? '',
              next_of_kin_phone: member.next_of_kin_phone ?? '',
              tucoswa_status: 'Active',
              join_date: new Date()
            } as any)

            setShowAddMemberModal(false)
            newMember && setRegistrationMessage({ kind: 'success', text: 'Your membership registration was submitted successfully. The branch will follow up with you.' })
          } catch (error) {
            console.log("Error", error)
            setRegistrationMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Unable to submit your registration.' })
          } finally {
            setIsLoading(false)
          }
        }}
        isLoading={isLoading}
      />

      {registrationMessage && (
        <div role={registrationMessage.kind === 'error' ? 'alert' : 'status'} className={`fixed bottom-5 right-5 z-[120] max-w-md rounded-xl px-5 py-4 shadow-xl ${registrationMessage.kind === 'success' ? 'bg-emerald-700 text-white' : 'bg-red-700 text-white'}`}>
          <div className="flex items-start gap-3">
            {registrationMessage.kind === 'error' ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /> : <CheckCircle className="mt-0.5 h-5 w-5 shrink-0" />}
            <p>{registrationMessage.text}</p>
            <button aria-label="Dismiss" className="ml-2" onClick={() => setRegistrationMessage(null)}>×</button>
          </div>
        </div>
      )}

      <FileCaseModal
        open={showFileModal}
        onOpenChange={setShowFileModal}
        onSubmit={handleFileCase}
        isLoading={isLoading}
        availableBranches={branches}
      />

      {selectedArticle && (
        <ArticleModal article={selectedArticle} onClose={() => setSelectedArticle(null)} />
      )}
      {selectedEvent && (
        <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}

      {/* Footer */}
      <footer className="border-t bg-slate-50 py-10">
        <div className="mx-auto max-w-7xl px-4 text-center text-slate-500">
          <p className="font-semibold text-[#1a3a52]">ZATUC · Zanzibar Trade Union Congress</p>
          <p className="mt-2 text-xs">
            P.O. Box 667, Zanzibar, Tanzania · +255 24 2236614 · zatuc_congress@yahoo.com
          </p>
          <p className="mt-3 text-xs leading-relaxed">
            Public information references:{' '}
            <a
              className="underline hover:text-[#1a3a52]"
              href="https://www.ituc-africa.org/Zanzibar-Trade-Union-Congress-ZATUC.html"
              target="_blank"
              rel="noreferrer"
            >
              ITUC-Africa
            </a>{' '}
            and{' '}
            <a
              className="underline hover:text-[#1a3a52]"
              href="https://eatuc.org/affiliates/"
              target="_blank"
              rel="noreferrer"
            >
              EATUC
            </a>
            . Image credits:{' '}
            <a
              className="underline hover:text-[#1a3a52]"
              href="https://dailynews.co.tz/union-tanzanias-journey-of-shared-prosperity/"
              target="_blank"
              rel="noreferrer"
            >
              Daily News Tanzania
            </a>
            ,{' '}
            <a
              className="underline hover:text-[#1a3a52]"
              href="https://www.adventurevolunteer.org/en/project/volunteer-in-zanzibar/"
              target="_blank"
              rel="noreferrer"
            >
              Adventure Volunteer
            </a>
            ,{' '}
            <a
              className="underline hover:text-[#1a3a52]"
              href="https://www.spiritedpursuit.com/blog/sp-wander-guide-stone-town-zanzibar"
              target="_blank"
              rel="noreferrer"
            >
              Spirited Pursuit
            </a>
            , and{' '}
            <a
              className="underline hover:text-[#1a3a52]"
              href="https://www.bbc.com/news/in-pictures-39030786"
              target="_blank"
              rel="noreferrer"
            >
              BBC News
            </a>
            .
          </p>
        </div>
      </footer>
    </div>
  )

  // ========================= Full Article Modal ========================= //
  function ArticleModal({
    article,
    onClose
  }: {
    article: PublicArticle
    onClose: () => void
  }) {
    if (!article) return null

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/70 p-4">
        <div className="flex max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="sticky top-0 z-10 flex items-start justify-between border-b bg-white p-6">
            <div>
              <div className="mb-2 flex items-center gap-3 text-sm text-slate-500">
                <span className="rounded-full bg-[#1a3a52]/10 px-3 py-1 font-medium text-[#1a3a52]">
                  {article.category}
                </span>
                <span>
                  {new Date(article.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
              <h1 className="text-2xl font-bold leading-tight text-[#1a3a52] sm:text-3xl">
                {article.title}
              </h1>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="flex-shrink-0">
              ✕
            </Button>
          </div>

          <div className="flex-1 space-y-8 overflow-y-auto p-6">
            {article.featuredImageUrl && (
              <div className="space-y-3">
                <img
                  src={article.featuredImageUrl}
                  alt={article.title}
                  className="max-h-[480px] w-full rounded-xl object-cover"
                />
                {article.featured_image_caption && (
                  <p className="px-2 text-center text-sm italic text-slate-500">
                    {article.featured_image_caption}
                  </p>
                )}
                {article.featured_image_path && <a className="inline-flex rounded-lg border px-4 py-2 text-sm font-semibold text-[#1a3a52] hover:bg-slate-50" href={`${article.featuredImageUrl.split('?')[0]}?download=${encodeURIComponent(article.featured_image_path.split('/').pop() ?? 'featured-image')}`} download>Download featured image</a>}
              </div>
            )}

            <div className="prose max-w-none leading-relaxed text-slate-700">
              {article.content.split('\n\n').map((paragraph: string, idx: number) => (
                <p key={idx} className="mb-4">
                  {paragraph}
                </p>
              ))}
            </div>

            {article.attachments && article.attachments.length > 0 && (
              <div className="border-t pt-6">
                <h4 className="mb-4 flex items-center gap-2 font-semibold">
                  📎 Attached Files ({article.attachments.length})
                </h4>
                <div className="grid gap-3">
                  {article.attachments.map((file, idx) => (
                    <a
                      key={file.id || idx}
                      href={article.attachmentUrls[file.id] ? `${article.attachmentUrls[file.id].split('?')[0]}?download=${encodeURIComponent(file.file_name)}` : '#'}
                      download={file.file_name}
                      className="group flex items-center gap-4 rounded-xl border p-4 transition hover:bg-slate-50"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-2xl">
                        📄
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium group-hover:text-[#c45c2a]">
                          {file.file_name}
                        </p>
                        {file.caption && (
                          <p className="line-clamp-2 text-sm text-slate-500">{file.caption}</p>
                        )}
                      </div>
                      <Button variant="outline" size="sm">
                        Download
                      </Button>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="border-t bg-slate-50 p-5 text-center text-sm text-slate-500">
            ZATUC • Empowering Workers
          </div>
        </div>
      </div>
    )
  }

  // =============================== Event Modals ========================== //
  // Featured Event
  function FeaturedEvent({ event, onReadMore }: { event: any; onReadMore: (e: any) => void }) {
    return (
      <Card className="overflow-hidden group cursor-pointer" onClick={() => onReadMore(event)}>
        <div className="md:flex">
          {event.images && (
            <div className="md:w-3/10 relative">
              <img
                src={event.images[0]?.url}
                alt={event.title}
                className="w-full object-stretch aspect-video md:aspect-auto"
              />
            </div>
          )}
          <div className="p-8 md:w-5/10 flex flex-col">
            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {new Date(event.date).toLocaleDateString('en-US', {
                  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
                })}
              </div>
              <div>{event.location}</div>
            </div>

            <h2 className="text-3xl font-bold leading-tight mb-4 group-hover:text-primary transition">
              {event.title}
            </h2>

            <p className="text-muted-foreground line-clamp-4 mb-auto">
              {event.notes || event.description || "Join us for this important event."}
            </p>

            <Button className="mt-6 w-fit">View Full Details →</Button>
          </div>
        </div>
      </Card>
    );
  }

  // Event Card
  function EventCard({ event, onReadMore }: { event: any; onReadMore: (e: any) => void }) {
    return (
      <Card
        className="overflow-hidden group hover:shadow-lg transition-all cursor-pointer flex flex-col h-full"
        onClick={() => onReadMore(event)}
      >
        {event.featuredImage && (
          <div className="relative h-48 overflow-hidden">
            <img
              src={event.featuredImage}
              alt={event.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </div>
        )}

        <div className="p-6 flex-1 flex flex-col">
          <div className="text-xs text-muted-foreground mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>

          <h3 className="font-semibold text-lg leading-tight mb-3 line-clamp-3 group-hover:text-primary transition">
            {event.title}
          </h3>

          <p className="text-sm text-muted-foreground line-clamp-4 flex-1">
            {event.notes || event.description}
          </p>

          {event.location && (
            <p className="text-xs text-muted-foreground mt-4 pt-4 border-t">
              📍 {event.location}
            </p>
          )}
        </div>
      </Card>
    );
  }

  // Full Event Modal
  function EventModal({ event, onClose }: { event: PublicEvent; onClose: () => void }) {
    if (!event) return null;

    return (
      <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4">
        <div className="bg-background max-w-3xl w-full rounded-2xl shadow-2xl max-h-[95vh] overflow-hidden flex flex-col">
          <div className="p-6 border-b sticky top-0 bg-background z-10 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 text-sm mb-2">
                <span className="px-3 py-1 bg-primary/10 text-primary rounded-full font-medium">
                  Event
                </span>
                <span>{new Date(event.event_date).toLocaleDateString('en-US', {
                  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
                })}</span>
              </div>
              <h1 className="text-3xl font-bold">{event.title}</h1>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>✕</Button>
          </div>

          <div className="overflow-y-auto p-6 space-y-8">
            {event.files.some(file => file.file_kind === 'image' && file.url) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {event.files.filter(file => file.file_kind === 'image' && file.url).map(file => (
                  <img
                    key={file.id}
                    src={file.url!}
                    alt={file.name || event.title}
                    className="max-h-[420px] w-full rounded-xl object-cover"
                  />
                ))}
              </div>
            )}

            {/* Details */}
            <div className="grid grid-cols-2 gap-6 text-sm">
              <div>
                <p className="text-muted-foreground">📍 Location</p>
                <p className="font-medium">{event.location || 'TBA'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">🕒 Date & Time</p>
                <p className="font-medium">{new Date(event.event_date).toLocaleString()}</p>
              </div>
            </div>

            {/* Description / Notes */}
            <div className="prose dark:prose-invert">
              <h4 className="font-semibold text-lg mb-3">About This Event</h4>
              <p className="whitespace-pre-line text-muted-foreground leading-relaxed">
                {event.notes || "No additional details provided."}
              </p>
            </div>

            {/* Attached Files */}
            {event.files.some(file => file.file_kind === 'document' && file.url) && (
              <div className="pt-6 border-t">
                <h4 className="font-semibold mb-4">📎 Supporting Documents</h4>
                <div className="space-y-3">
                  {event.files.filter(file => file.file_kind === 'document' && file.url).map(file => (
                    <a
                      key={file.id}
                      href={`${file.url!.split('?')[0]}?download=${encodeURIComponent(file.name)}`}
                      download={file.name}
                      className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/50 group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-3xl">📄</div>
                        <div>
                          <p className="font-medium group-hover:text-primary">{file.name}</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">Download</Button>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Share Buttons */}
          <div className="p-6 border-t bg-muted/30">
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  const text = `Join us for ${event.title} on ${new Date(event.event_date).toLocaleString()} at ${event.location}`
                  window.open(`mailto:?subject=${event.title}&body=${text}`, '_blank')
                }}
                title="Share via Email"
              >
                <Mail className="w-3 h-3" />
                Email
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  const text = `Join us for ${event.title} on ${new Date(event.event_date).toLocaleString()} at ${event.location}`
                  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
                }}
                title="Share via WhatsApp"
              >
                <MessageCircle className="w-3 h-3" />
                WhatsApp
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  const text = `Join us for ${event.title} on ${new Date(event.event_date).toLocaleString()} at ${event.location}`
                  window.open(`https://www.facebook.com/sharer/sharer.php?u=${window.location.href}&quote=${encodeURIComponent(text)}`, '_blank')
                }}
                title="Share on Facebook"
              >
                <img src={Facebook.src} alt='F' className="w-3 h-3" />
                Facebook
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  const text = `Join us for ${event.title} on ${new Date(event.event_date).toLocaleString()} at ${event.location}`
                  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank')
                }}
                title="Share on Twitter"
              >
                <img src={Twitter.src} alt='X' className="w-3 h-3" />
                Twitter
              </Button>
            </div>
            {event.stakeholders && event.stakeholders.length > 0 && (
              <p className="text-xs text-muted-foreground">
                <strong>{event.stakeholders.length}</strong> people invited
              </p>
            )}
          </div >
        </div >
      </div >
    );
  }

  function FeaturedArticle({ article, onReadMore }: { article: PublicArticle; onReadMore: (a: PublicArticle) => void }) {
    return (
      <Card className="overflow-hidden group cursor-pointer" onClick={() => onReadMore(article)}>
        <div className="md:flex">
          {article.featuredImageUrl && (
            <div className="md:w-5/12 relative">
              <img
                src={article.featuredImageUrl}
                alt={article.title}
                className="w-full h-full object-cover aspect-video md:aspect-auto"
              />
              <div className="absolute top-4 left-4">
                <span className="px-3 py-1 text-xs font-medium bg-black/70 text-white rounded-full">
                  {article.category}
                </span>
              </div>
            </div>
          )}
          <div className="p-8 md:w-7/12 flex flex-col">
            <div className="text-sm text-muted-foreground mb-3">
              {new Date(article.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>

            <h2 className="text-3xl font-bold leading-tight mb-4 group-hover:text-primary transition">
              {article.title}
            </h2>

            <p className="text-muted-foreground line-clamp-4 mb-auto">
              {article.content}
            </p>

            <Button className="mt-6 w-fit" variant="default">
              Read Full Article →
            </Button>
          </div>
        </div>
      </Card>
    );
  }
}
