'use client'

import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns'
import { ko } from 'date-fns/locale/ko'
import { toDateKey } from '@/lib/utils/format'
import type { NoteForCalendar } from '@/types'
import { useMemo, useEffect, useState } from 'react'

interface CalendarNotesProps {
  notes: NoteForCalendar[]
  selectedDate: Date | null
  onSelectDate: (date: Date | null) => void
  currentMonth: Date
  onMonthChange: (date: Date) => void
}

export default function CalendarNotes({
  notes,
  selectedDate,
  onSelectDate,
  currentMonth,
  onMonthChange,
}: CalendarNotesProps) {
  const [isDark, setIsDark] = useState(false)
  
  useEffect(() => {
    // 다크 모드 감지
    const checkDarkMode = () => {
      setIsDark(document.documentElement.classList.contains('dark'))
    }
    checkDarkMode()
    
    // 다크 모드 변경 감지
    const observer = new MutationObserver(checkDarkMode)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    
    return () => observer.disconnect()
  }, [])
  
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  const notesByDate = useMemo(() => {
    return notes.reduce<Record<string, number>>((acc, n) => {
      const key = toDateKey(n.created_at)
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})
  }, [notes])

  // 날짜별 노트 개수에 따른 배경색 강도 계산
  // 배경색만 투명하게 하기 위해 rgba 사용
  const getNoteBgStyle = (count: number, isDark: boolean): React.CSSProperties => {
    if (count === 0) return {}
    
    let opacity = 0
    if (count === 1) opacity = 0.2
    else if (count === 2) opacity = 0.35
    else if (count === 3) opacity = 0.5
    else if (count >= 4 && count <= 5) opacity = 0.65
    else if (count >= 6 && count <= 8) opacity = 0.75
    else opacity = 0.85 // 9개 이상
    
    // 다크 모드: #f59e0b (rgb(245, 158, 11)), 라이트 모드: #b45309 (rgb(180, 83, 9))
    // 배경색만 opacity 적용 (텍스트는 영향 없음)
    if (isDark) {
      return {
        backgroundColor: `rgba(245, 158, 11, ${opacity})`,
      }
    } else {
      return {
        backgroundColor: `rgba(180, 83, 9, ${opacity})`,
      }
    }
  }

  const getNoteTextColor = (count: number, selected: boolean): string => {
    if (selected) return 'text-white'
    if (count === 0) return 'text-[var(--foreground)]'
    if (count <= 2) return 'text-[var(--accent)]'
    if (count <= 5) return 'text-[var(--accent)] font-semibold'
    return 'text-white font-semibold' // 6개 이상이면 흰색 텍스트
  }

  const weekdays = ['일', '월', '화', '수', '목', '금', '토']

  // 달력 첫 주 시작 전 빈 칸
  const emptySlots = monthStart.getDay()

  return (
    <div className="rounded-2xl border border-[var(--surface-hover)] bg-[var(--surface)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onMonthChange(subMonths(currentMonth, 1))}
          className="rounded-xl p-2 text-[var(--foreground-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
          aria-label="이전 달"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-[var(--foreground)]">
          {format(currentMonth, 'yyyy년 M월', { locale: ko })}
        </span>
        <button
          type="button"
          onClick={() => onMonthChange(addMonths(currentMonth, 1))}
          className="rounded-xl p-2 text-[var(--foreground-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
          aria-label="다음 달"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center">
        {weekdays.map((d) => (
          <div key={d} className="py-1 text-xs font-medium text-[var(--foreground-subtle)]">
            {d}
          </div>
        ))}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd')
          const count = notesByDate[key] ?? 0
          const hasNotes = count > 0
          const selected = selectedDate && isSameDay(day, selectedDate)
          const isCurrentMonth = isSameMonth(day, currentMonth)

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate(selected && selectedDate && isSameDay(day, selectedDate) ? null : day)}
              style={hasNotes && !selected ? getNoteBgStyle(count, isDark) : {}}
              className={`relative flex aspect-square items-center justify-center rounded-xl text-sm font-medium transition-colors ${
                !isCurrentMonth ? 'text-[var(--foreground-subtle)]/50' : ''
              } ${
                selected
                  ? 'bg-[var(--accent)] text-white ring-1 ring-[var(--accent)]'
                  : hasNotes
                    ? `${getNoteTextColor(count, false)} hover:opacity-80`
                    : 'text-[var(--foreground)] hover:bg-[var(--surface-hover)]'
              }`}
              title={hasNotes ? `${count}개 노트` : undefined}
            >
              {format(day, 'd')}
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-[var(--foreground-subtle)]">
        날짜를 누르면 해당 날짜의 노트만 보입니다.
      </p>
    </div>
  )
}
