'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, Pause, Play, SkipBack, SkipForward } from 'lucide-react'

import type { AiDemoVideo } from '@/lib/ai-demo-videos'

/**
 * Practice lessons for the luxury marketing site.
 * Preview frames show the real product; Open opens the live system to use it.
 */
export function AiDemoPlayer({ videos }: { videos: AiDemoVideo[] }) {
  const [activeId, setActiveId] = useState(videos[0]?.id ?? '')
  const active = videos.find((video) => video.id === activeId) ?? videos[0]

  if (!active) return null

  return (
    <div className="mt-12 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
      <ul className="space-y-2">
        {videos.map((video, index) => {
          const on = video.id === active.id
          return (
            <li key={video.id}>
              <button
                type="button"
                onClick={() => setActiveId(video.id)}
                className={`flex w-full items-start gap-3 border px-4 py-3.5 text-left transition-colors ${
                  on
                    ? 'border-primary/40 bg-primary/8 text-foreground'
                    : 'border-border/70 bg-[#100e14] text-muted-foreground hover:border-primary/30 hover:bg-[#14111a] hover:text-foreground'
                }`}
              >
                <span className="relative mt-0.5 size-14 shrink-0 overflow-hidden border border-border/70">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`${video.frames[0]?.src}?v=system`}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute inset-0 grid place-items-center bg-[#07060a]/45">
                    <Play className="size-4 text-primary" fill="currentColor" />
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
                    Lesson {String(index + 1).padStart(2, '0')} · {video.durationLabel}
                  </span>
                  <span className="mt-1 block text-[15px] font-semibold tracking-tight text-foreground">
                    {video.title}
                  </span>
                  <span className="mt-1 block text-[13px] text-muted-foreground">{video.summary}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="overflow-hidden border border-border/70 bg-[#100e14]">
        <ReelPlayer key={active.id} video={active} />
        <div className="border-t border-border/60 px-5 py-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
            Live system · SOM ERP
          </p>
          <p className="mt-1 text-[1.1rem] font-semibold text-foreground">{active.title}</p>
          <p className="mt-1 text-[14px] text-muted-foreground">{active.summary}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={active.openHref}
              className="inline-flex h-11 items-center gap-2 rounded-sm bg-primary px-5 text-[14px] font-semibold text-primary-foreground hover:opacity-90"
            >
              {active.openLabel}
              <ArrowUpRight className="size-4" />
            </Link>
            <Link
              href="/register"
              className="inline-flex h-11 items-center gap-2 rounded-sm border border-primary/35 px-5 text-[14px] font-medium text-primary hover:bg-primary/10"
            >
              Start free trial
            </Link>
          </div>
          <p className="mt-3 text-[12px] text-muted-foreground">
            Opens the real desk. Sign in if asked — then practice the steps above.
          </p>
        </div>
      </div>
    </div>
  )
}

function ReelPlayer({ video }: { video: AiDemoVideo }) {
  const timeline = useMemo(
    () =>
      video.frames.map((frame) => ({
        ...frame,
        seconds: frame.seconds ?? 4,
      })),
    [video.frames],
  )
  const totalSeconds = timeline.reduce((sum, frame) => sum + frame.seconds, 0)

  const [playing, setPlaying] = useState(true)
  const [elapsed, setElapsed] = useState(0)
  const elapsedRef = useRef(0)

  const [seenVideoId, setSeenVideoId] = useState(video.id)
  if (video.id !== seenVideoId) {
    setSeenVideoId(video.id)
    setElapsed(0)
    setPlaying(true)
  }
  useEffect(() => {
    elapsedRef.current = 0
  }, [video.id])

  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => {
      const next = elapsedRef.current + 0.1
      if (next >= totalSeconds) {
        elapsedRef.current = totalSeconds
        setElapsed(totalSeconds)
        setPlaying(false)
        return
      }
      elapsedRef.current = next
      setElapsed(next)
    }, 100)
    return () => window.clearInterval(id)
  }, [playing, totalSeconds])

  let cursor = 0
  let index = 0
  for (let i = 0; i < timeline.length; i++) {
    const end = cursor + timeline[i].seconds
    if (elapsed < end || i === timeline.length - 1) {
      index = i
      break
    }
    cursor = end
  }

  const frame = timeline[index] ?? timeline[0]
  const progress = totalSeconds > 0 ? (elapsed / totalSeconds) * 100 : 0

  const jumpTo = (seconds: number) => {
    const clamped = Math.min(totalSeconds, Math.max(0, seconds))
    elapsedRef.current = clamped
    setElapsed(clamped)
    setPlaying(true)
  }

  return (
    <div className="relative aspect-video overflow-hidden bg-[#07060a]">
      {timeline.map((item, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${item.src}-${i}`}
          src={`${item.src}?v=system`}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            i === index ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            transform: i === index ? 'scale(1.02)' : 'scale(1)',
            transition: 'opacity 700ms ease, transform 10s ease-out',
          }}
        />
      ))}

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#07060a]/95 via-[#07060a]/20 to-[#07060a]/30"
      />

      <div className="absolute left-4 top-4 border border-primary/25 bg-[#100e14]/90 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-primary backdrop-blur">
        Live preview · SOM ERP
      </div>

      <div className="absolute inset-x-0 bottom-0 space-y-3 p-4 sm:p-5">
        <p className="max-w-2xl text-[1.15rem] font-semibold leading-snug text-[#f3eee6] sm:text-[1.35rem]">
          {frame?.caption}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Restart"
            onClick={() => jumpTo(0)}
            className="grid size-9 place-items-center border border-[#f3eee6]/20 bg-[#f3eee6]/10 text-[#f3eee6] hover:bg-[#f3eee6]/15"
          >
            <SkipBack className="size-4" />
          </button>
          <button
            type="button"
            aria-label={playing ? 'Pause' : 'Play'}
            onClick={() => {
              if (elapsedRef.current >= totalSeconds) {
                jumpTo(0)
                return
              }
              setPlaying((value) => !value)
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-sm bg-primary px-3 text-[13px] font-semibold text-primary-foreground hover:opacity-90"
          >
            {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            {playing ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            aria-label="Next scene"
            onClick={() => {
              let start = 0
              for (let i = 0; i <= index; i++) start += timeline[i]?.seconds ?? 0
              jumpTo(start)
            }}
            className="grid size-9 place-items-center border border-[#f3eee6]/20 bg-[#f3eee6]/10 text-[#f3eee6] hover:bg-[#f3eee6]/15"
          >
            <SkipForward className="size-4" />
          </button>
          <Link
            href={video.openHref}
            className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-sm border border-primary/40 bg-primary/15 px-3 text-[13px] font-semibold text-primary hover:bg-primary/25"
          >
            Open system
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        <button
          type="button"
          aria-label="Seek"
          className="block h-1 w-full overflow-hidden bg-[#f3eee6]/20"
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect()
            const ratio = (event.clientX - rect.left) / rect.width
            jumpTo(ratio * totalSeconds)
          }}
        >
          <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
        </button>
      </div>
    </div>
  )
}
