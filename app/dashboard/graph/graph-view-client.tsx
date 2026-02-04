'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale/ko'
import { createClient } from '@/lib/supabase/client'
import ThemeToggle from '@/components/theme-toggle'
import type { Note, Category } from '@/types'

interface GraphViewClientProps {
  notes: Note[]
  categories: Category[]
  userEmail: string
  isAdmin?: boolean
  /** 날짜 문자열 YYYY-MM-DD 목록 (노트에서 추출, 정렬) */
  dateKeys?: string[]
  /** 노트 id → 해당 노트에서 추출한 단어 목록 */
  noteWords?: Record<string, string[]>
}

const CENTER_R = 56
const CATEGORY_R = 44
const NOTE_R = 28
const DATE_R = 22
const WORD_R = 18
const HUB_DIST = 200
const DATE_DIST = 300
const WORD_DIST = 400
const NOTE_ORBIT = 100

function polar(r: number, theta: number) {
  return { x: r * Math.cos(theta), y: r * Math.sin(theta) }
}

function hash(s: string) {
  return s.split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0)
}

function categoryHue(catId: string): number {
  return Math.abs(hash(catId)) % 360
}

export default function GraphViewClient({
  notes,
  categories,
  userEmail,
  isAdmin,
  dateKeys = [],
  noteWords = {},
}: GraphViewClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const [size, setSize] = useState({ w: 1200, h: 800 })

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }
  const [hovered, setHovered] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)

  const ZOOM_MIN = 0.35
  const ZOOM_MAX = 3
  const ZOOM_STEP = 1.15

  useEffect(() => {
    const onFocus = () => {
      router.refresh()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [router])

  const handlePanStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as Element).closest?.('[data-graph-no-pan]')) return
    e.preventDefault()
    setIsDragging(true)
    const start = { clientX: e.clientX, clientY: e.clientY, panX: pan.x, panY: pan.y }
    const onMove = (ev: MouseEvent) => {
      setPan({
        x: start.panX + (ev.clientX - start.clientX),
        y: start.panY + (ev.clientY - start.clientY),
      })
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      setIsDragging(false)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [pan.x, pan.y])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z * (e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP))))
  }, [])

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(ZOOM_MAX, z * ZOOM_STEP)), [])
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(ZOOM_MIN, z / ZOOM_STEP)), [])
  const handleZoomReset = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }) }, [])

  const resize = useCallback(() => {
    setSize({ w: window.innerWidth, h: window.innerHeight })
  }, [])

  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    setMounted(true)
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [resize])

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => e.preventDefault()
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [mounted])

  const cx = size.w / 2
  const cy = size.h / 2

  const { categoryNodes, dateNodes, wordNodes, noteNodes, links } = useMemo(() => {
    const catList = categories as Category[]
    const uncategorized = notes.filter((n) => !n.category_id)
    const noteList = notes as Note[]
    const nCat = Math.max(1, catList.length + (uncategorized.length ? 1 : 0))
    const dates = dateKeys.length ? dateKeys : (() => {
      const set = new Set<string>()
      noteList.forEach((n) => set.add(format(new Date(n.created_at), 'yyyy-MM-dd')))
      return Array.from(set).sort()
    })()
    const wordSet = new Set<string>()
    Object.values(noteWords).forEach((words) => words.forEach((w) => wordSet.add(w)))
    const words = Array.from(wordSet).sort().slice(0, 60)

    const categoryNodes: { id: string; name: string; x: number; y: number; index: number }[] = []
    let i = 0
    catList.forEach((c) => {
      const theta = (i / nCat) * Math.PI * 2 - Math.PI / 2
      const p = polar(HUB_DIST, theta)
      categoryNodes.push({ id: c.id, name: c.name, x: cx + p.x, y: cy + p.y, index: i })
      i++
    })
    if (uncategorized.length) {
      const theta = (i / nCat) * Math.PI * 2 - Math.PI / 2
      const p = polar(HUB_DIST, theta)
      categoryNodes.push({ id: '_none', name: '미분류', x: cx + p.x, y: cy + p.y, index: i })
    }

    const nDate = Math.max(1, dates.length)
    const dateNodes: { id: string; label: string; x: number; y: number }[] = dates.map((d, i) => {
      const theta = (i / nDate) * Math.PI * 2 - Math.PI / 2
      const p = polar(DATE_DIST, theta)
      return { id: `date-${d}`, label: d.slice(5), x: cx + p.x, y: cy + p.y }
    })

    const nWord = Math.max(1, words.length)
    const wordNodes: { id: string; label: string; x: number; y: number }[] = words.map((w, i) => {
      const theta = (i / nWord) * Math.PI * 2 - Math.PI / 2
      const p = polar(WORD_DIST, theta)
      return { id: `word-${w}`, label: w.length > 6 ? w.slice(0, 5) + '…' : w, x: cx + p.x, y: cy + p.y }
    })

    const getCatPos = (cid: string | null) => {
      const node = categoryNodes.find((n) => n.id === (cid ?? '_none'))
      return node ? { x: node.x, y: node.y } : { x: cx, y: cy }
    }

    const noteNodes: { id: string; title: string; x: number; y: number; categoryId: string | null; created_at: string; dateKey: string }[] = []
    const links: { from: [number, number]; to: [number, number]; key: string; categoryId?: string }[] = []

    noteList.forEach((note) => {
      const catId = note.category_id ?? '_none'
      const catPos = getCatPos(note.category_id ?? null)
      const catNode = categoryNodes.find((n) => n.id === catId)
      const countInCat = noteList.filter((n) => (n.category_id ?? '_none') === catId).length
      const j = noteList.filter((n) => (n.category_id ?? '_none') === catId).findIndex((n) => n.id === note.id)
      const theta = catNode ? (catNode.index / nCat) * Math.PI * 2 - Math.PI / 2 : 0
      const noteAngle = theta + (j - (countInCat - 1) / 2) * 0.4
      const p = polar(NOTE_ORBIT, noteAngle)
      const jitter = ((hash(note.id) % 100) / 100 - 0.5) * 20
      const nx = catPos.x + p.x + jitter
      const ny = catPos.y + p.y + ((hash(note.id + 'y') % 100) / 100 - 0.5) * 20
      const dateKey = format(new Date(note.created_at), 'yyyy-MM-dd')
      noteNodes.push({
        id: note.id,
        title: note.title,
        x: nx,
        y: ny,
        categoryId: note.category_id ?? null,
        created_at: note.created_at,
        dateKey,
      })
      links.push({
        from: [nx, ny],
        to: [catPos.x, catPos.y],
        key: `n-c-${note.id}-${catId}`,
        categoryId: catId,
      })
      const dateNode = dateNodes.find((dn) => dn.id === `date-${dateKey}`)
      if (dateNode) {
        links.push({ from: [nx, ny], to: [dateNode.x, dateNode.y], key: `n-d-${note.id}-${dateKey}` })
      }
      ;(noteWords[note.id] || []).slice(0, 5).forEach((w) => {
        const wn = wordNodes.find((n) => n.id === `word-${w}`)
        if (wn) links.push({ from: [nx, ny], to: [wn.x, wn.y], key: `n-w-${note.id}-${w}` })
      })
    })

    return { categoryNodes, dateNodes, wordNodes, noteNodes, links }
  }, [notes, categories, dateKeys, noteWords, cx, cy])

  const viewBox = `0 0 ${size.w} ${size.h}`

  return (
    <div className="fixed inset-0 flex flex-col bg-[var(--background)] overflow-hidden">
      <header className="absolute top-0 left-0 right-0 z-10 flex h-14 items-center justify-between px-4 bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)]/40 sm:px-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-lg font-semibold tracking-tight text-[var(--foreground)] no-underline hover:opacity-80 transition-opacity">
            Study Notes
          </Link>
          <span className="text-sm font-medium text-[var(--accent)]">그래프 뷰</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <span className="max-sm:hidden text-sm text-[var(--foreground-subtle)]">{userEmail}</span>
          {isAdmin && (
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-md bg-[var(--accent-muted)] px-2 py-1 text-xs font-medium text-[var(--accent)]">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              관리자
            </span>
          )}
          {isAdmin && (
            <Link href="/admin/approvals" className="rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--accent)] hover:underline">
              가입 승인
            </Link>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
          >
            로그아웃
          </button>
          <Link href="/dashboard" className="rounded-xl px-3 py-2 text-sm font-medium text-[var(--foreground-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]">
            대시보드
          </Link>
        </div>
      </header>

      <div className="flex-1 pt-14 relative flex flex-col">
        <div className="absolute right-4 top-20 z-10 flex flex-col gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)]/90 p-1.5 shadow-lg backdrop-blur-sm">
          <button type="button" onClick={handleZoomIn} className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--foreground-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]" aria-label="확대">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" /></svg>
          </button>
          <button type="button" onClick={handleZoomOut} className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--foreground-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]" aria-label="축소">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
          </button>
          <button type="button" onClick={handleZoomReset} className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--foreground-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]" aria-label="확대/축소 초기화">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
          </button>
        </div>
        <svg
          ref={svgRef}
          viewBox={viewBox}
          className="w-full h-full touch-none select-none"
          style={{ minHeight: 'calc(100vh - 3.5rem)', cursor: isDragging ? 'grabbing' : 'grab' }}
          onMouseLeave={() => setHovered(null)}
          onMouseDown={handlePanStart}
          onWheel={handleWheel}
        >
          <defs>
            <pattern id="dotGrid" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="14" cy="14" r="0.6" fill="var(--foreground)" fillOpacity="0.04" />
            </pattern>
            <radialGradient id="bgGrad" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.04" />
              <stop offset="100%" stopColor="var(--background)" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="centerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.9" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.6" />
            </linearGradient>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          <g transform={`translate(${pan.x} ${pan.y}) translate(${cx} ${cy}) scale(${zoom}) translate(${-cx} ${-cy})`}>
            <rect width={size.w} height={size.h} fill="url(#bgGrad)" />
            <rect width={size.w} height={size.h} fill="url(#dotGrid)" />
            <circle cx={cx} cy={cy} r={WORD_DIST + 60} fill="none" stroke="var(--border)" strokeOpacity="0.12" strokeWidth="1" />
            <circle cx={cx} cy={cy} r={DATE_DIST + 20} fill="none" stroke="var(--border)" strokeOpacity="0.08" strokeWidth="1" />
            <circle cx={cx} cy={cy} r={HUB_DIST + 20} fill="none" stroke="var(--border)" strokeOpacity="0.08" strokeWidth="1" />

            {/* 링크 — 노트→카테고리/날짜/단어 쭉 뻗어서 연결 */}
          <g data-graph-no-pan className="transition-opacity duration-300" style={{ opacity: mounted ? 1 : 0 }}>
            {links.map((link, i) => {
              const [fx, fy] = link.from
              const [tx, ty] = link.to
              const hue = link.categoryId != null ? categoryHue(link.categoryId) : 200
              const strokeColor = `hsl(${hue}, 58%, 55%)`
              const isExtra = !link.categoryId
              return (
                <path
                  key={link.key}
                  pathLength={1}
                  d={`M ${fx} ${fy} Q ${(fx + tx) / 2 + 20} ${(fy + ty) / 2 - 20} ${tx} ${ty}`}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={isExtra ? 1 : 1.6}
                  strokeOpacity={isExtra ? 0.35 : 0.5}
                  style={{ animationDelay: `${i * 18}ms` }}
                  className="graph-link-draw animate-[drawLine_0.5s_ease-out_forwards]"
                />
              )
            })}
          </g>

          {/* 단어 노드 (가장 바깥 링) */}
          <g data-graph-no-pan style={{ opacity: mounted ? 1 : 0 }}>
            {wordNodes.map((node, i) => (
              <g
                key={node.id}
                data-graph-no-pan
                transform={`translate(${node.x},${node.y})`}
                className="cursor-default"
                style={{ animation: mounted ? 'graphNodeIn 0.4s ease-out forwards' : 'none', animationDelay: `${500 + i * 15}ms`, opacity: 0 }}
                onMouseEnter={() => setHovered(node.id)}
                onMouseLeave={() => setHovered(null)}
              >
                <circle r={WORD_R} fill="var(--surface-hover)" stroke="var(--foreground-muted)" strokeWidth="0.8" strokeOpacity="0.5" filter="url(#softGlow)" className="transition-all duration-200" />
                <text textAnchor="middle" dominantBaseline="middle" className="fill-[var(--foreground-muted)] text-[10px] font-medium pointer-events-none select-none" style={{ fontFamily: 'var(--font-noto), system-ui, sans-serif' }}>{node.label}</text>
              </g>
            ))}
          </g>

          {/* 날짜 노드 */}
          <g data-graph-no-pan style={{ opacity: mounted ? 1 : 0 }}>
            {dateNodes.map((node, i) => (
              <g
                key={node.id}
                data-graph-no-pan
                transform={`translate(${node.x},${node.y})`}
                className="cursor-default"
                style={{ animation: mounted ? 'graphNodeIn 0.45s ease-out forwards' : 'none', animationDelay: `${320 + i * 25}ms`, opacity: 0 }}
                onMouseEnter={() => setHovered(node.id)}
                onMouseLeave={() => setHovered(null)}
              >
                <circle r={DATE_R} fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.2" strokeOpacity="0.5" filter="url(#softGlow)" className="transition-all duration-200" />
                <text textAnchor="middle" dominantBaseline="middle" className="fill-[var(--foreground-subtle)] text-xs font-medium pointer-events-none select-none" style={{ fontFamily: 'var(--font-noto), system-ui, sans-serif' }}>{node.label}</text>
              </g>
            ))}
          </g>

          {/* 카테고리 노드 */}
          <g data-graph-no-pan style={{ opacity: mounted ? 1 : 0 }}>
            {categoryNodes.map((node, i) => {
              const hue = categoryHue(node.id)
              const strokeColor = `hsl(${hue}, 62%, 52%)`
              return (
                <g
                  key={node.id}
                  data-graph-no-pan
                  transform={`translate(${node.x},${node.y})`}
                  className="cursor-default"
                  style={{ animation: mounted ? 'graphNodeIn 0.5s ease-out forwards' : 'none', animationDelay: `${200 + i * 80}ms`, opacity: 0 }}
                  onMouseEnter={() => setHovered(`cat-${node.id}`)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <circle r={CATEGORY_R} fill="var(--surface)" stroke={strokeColor} strokeWidth={hovered === `cat-${node.id}` ? 2.5 : 2} strokeOpacity={hovered === `cat-${node.id}` ? 0.95 : 0.6} filter="url(#softGlow)" className="transition-all duration-300" />
                  <text textAnchor="middle" dominantBaseline="middle" className="fill-[var(--foreground)] text-sm font-semibold pointer-events-none select-none" style={{ fontFamily: 'var(--font-noto), system-ui, sans-serif' }}>{node.name.length > 6 ? node.name.slice(0, 5) + '…' : node.name}</text>
                </g>
              )
            })}
          </g>

          {/* 노트 노드 */}
          <g data-graph-no-pan style={{ opacity: mounted ? 1 : 0 }}>
            {noteNodes.map((node, i) => {
              const isHover = hovered === node.id
              const hue = categoryHue(node.categoryId ?? '_none')
              const strokeColor = `hsl(${hue}, 58%, 48%)`
              return (
                <g
                  key={node.id}
                  data-graph-no-pan
                  transform={`translate(${node.x},${node.y})`}
                  className="cursor-pointer"
                  style={{ animation: mounted ? 'graphNodeIn 0.4s ease-out forwards' : 'none', animationDelay: `${400 + i * 35}ms`, opacity: 0 }}
                  onMouseEnter={() => setHovered(node.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => router.push(`/dashboard/notes/${node.id}`)}
                >
                  <circle r={NOTE_R} fill="var(--surface)" stroke={strokeColor} strokeWidth={isHover ? 2.5 : 1.2} strokeOpacity={isHover ? 0.95 : 0.55} filter={isHover ? 'url(#glow)' : undefined} className="transition-all duration-200" />
                  <text textAnchor="middle" dominantBaseline="middle" className="fill-[var(--foreground-muted)] text-xs font-medium pointer-events-none select-none" style={{ fontFamily: 'var(--font-noto), system-ui, sans-serif' }}>{(node.title || '제목 없음').slice(0, 8)}{(node.title || '').length > 8 ? '…' : ''}</text>
                </g>
              )
            })}
          </g>

          {/* 중앙 허브 - 노트가 있을 때만 표시 */}
          {notes.length > 0 && (
            <g data-graph-no-pan transform={`translate(${cx},${cy})`} className="pointer-events-none">
              <circle r={CENTER_R} fill="url(#centerGrad)" filter="url(#glow)" className="transition-opacity duration-500" style={{ opacity: mounted ? 1 : 0, animation: mounted ? 'graphHubPulse 2.8s ease-in-out infinite' : 'none' }} />
              <text textAnchor="middle" dominantBaseline="middle" className="fill-white text-base font-bold" style={{ fontFamily: 'var(--font-noto), system-ui, sans-serif' }}>Study</text>
              <text textAnchor="middle" dominantBaseline="middle" dy={22} className="fill-white/80 text-xs">{notes.length}개 노트</text>
            </g>
          )}
          </g>
        </svg>

        {hovered && !hovered.startsWith('cat-') && !hovered.startsWith('date-') && !hovered.startsWith('word-') && (() => {
          const n = noteNodes.find((nn) => nn.id === hovered)
          if (!n) return null
          const hue = categoryHue(n.categoryId ?? '_none')
          return (
            <div className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2 pointer-events-none rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]" style={{ borderLeftWidth: 4, borderLeftColor: `hsl(${hue}, 62%, 52%)` }}>
              <p className="font-semibold text-[var(--foreground)]">{n.title || '제목 없음'}</p>
              <p className="text-xs text-[var(--foreground-subtle)] mt-1">{format(new Date(n.created_at), 'yyyy.M.d HH:mm', { locale: ko })}</p>
              <p className="text-xs mt-1.5" style={{ color: `hsl(${hue}, 62%, 42%)` }}>클릭하면 노트 열기</p>
            </div>
          )
        })()}

        {notes.length === 0 && (
          <div className="absolute top-14 left-0 right-0 bottom-0 z-5 flex items-center justify-center bg-[var(--background)]/95 backdrop-blur-sm">
            <div className="text-center px-6 max-w-md">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--surface-hover)] text-[var(--foreground-subtle)] mb-6 shadow-sm">
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </div>
              <h2 className="text-xl font-semibold text-[var(--foreground)] mb-2">노트가 없어요</h2>
              <p className="text-sm text-[var(--foreground-muted)] mb-6 leading-relaxed">대시보드에서 .txt / .md 파일을 업로드하면 그래프에 나타납니다.</p>
              <Link href="/dashboard" className="inline-block rounded-xl bg-[var(--accent)] px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity shadow-sm">대시보드로 이동</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
