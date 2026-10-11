'use client'

import { useEffect, useState } from 'react'
import { Pause, Play, SkipForward } from 'lucide-react'

import type { TutorialLesson } from '@/lib/marketing-site'

/**
 * Video-style how-to lessons for the public site.
 *
 * When a lesson has a YouTube id it embeds the video. Otherwise it plays the
 * written steps as a timed reel so visitors still get a guided walkthrough.
 * Colours follow the same theme tokens as the signed-in workspace.
 */
export function TutorialLessons({ lessons }: { lessons: TutorialLesson[] }) {
  const [activeId, setActiveId] = useState(lessons[0]?.id ?? '')
  const active = lessons.find((lesson) => lesson.id === activeId) ?? lessons[0]

  if (!active) return null

  return (
    <div className="mt-12 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
      <ul className="space-y-2">
        {lessons.map((lesson, index) => {
          const on = lesson.id === active.id
          return (
            <li key={lesson.id}>
              <button
                type="button"
                onClick={() => setActiveId(lesson.id)}
                className={`flex w-full items-start gap-3 rounded-md border px-4 py-3.5 text-left transition-colors ${
                  on
                    ? 'border-primary/35 bg-accent text-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/25 hover:bg-secondary/70 hover:text-foreground'
                }`}
              >
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-background text-[13px] font-bold text-success">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold tracking-tight text-foreground">
                    {lesson.title}
                  </span>
                  <span className="mt-1 block text-[13px] text-muted-foreground">{lesson.summary}</span>
                  <span className="mt-2 inline-block text-[11px] font-semibold uppercase tracking-[0.14em] text-success">
                    {lesson.youtubeId ? 'Video' : 'Guided lesson'} · {lesson.duration}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {active.youtubeId ? (
          <div className="aspect-video bg-foreground/90">
            <iframe
              title={active.title}
              src={`https://www.youtube-nocookie.com/embed/${active.youtubeId}?rel=0`}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <StepReel key={active.id} lesson={active} />
        )}
        <div className="border-t border-border px-5 py-4">
          <p className="text-[1.1rem] font-semibold text-foreground">{active.title}</p>
          <p className="mt-1 text-[14px] text-muted-foreground">{active.summary}</p>
        </div>
      </div>
    </div>
  )
}

function StepReel({ lesson }: { lesson: TutorialLesson }) {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % lesson.steps.length)
    }, 4200)
    return () => window.clearInterval(timer)
  }, [playing, lesson.steps.length])

  const step = lesson.steps[index] ?? lesson.steps[0]

  return (
    <div className="relative aspect-video overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_80%_at_80%_10%,color-mix(in_oklab,var(--success)_16%,transparent),transparent_55%),radial-gradient(50%_60%_at_10%_90%,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_50%)]"
      />

      <div className="relative flex h-full flex-col justify-between p-5 sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-md bg-accent px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-foreground">
            Lesson {String(index + 1).padStart(2, '0')} / {String(lesson.steps.length).padStart(2, '0')}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPlaying((value) => !value)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground transition-colors hover:opacity-90"
            >
              {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              {playing ? 'Pause' : 'Play'}
            </button>
            <button
              type="button"
              onClick={() => {
                setIndex((current) => (current + 1) % lesson.steps.length)
                setPlaying(true)
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-secondary"
            >
              <SkipForward className="size-3.5" />
              Next
            </button>
          </div>
        </div>

        <div className="max-w-xl">
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-success">
            How to use SOM ERP
          </p>
          <p className="mt-3 text-[1.45rem] font-bold leading-tight tracking-tight text-foreground sm:text-[1.75rem]">
            {step}
          </p>
        </div>

        <div className="flex gap-1.5">
          {lesson.steps.map((_, stepIndex) => (
            <button
              key={stepIndex}
              type="button"
              aria-label={`Go to step ${stepIndex + 1}`}
              onClick={() => {
                setIndex(stepIndex)
                setPlaying(false)
              }}
              className={`h-1 flex-1 rounded-full transition-colors ${
                stepIndex === index ? 'bg-primary' : 'bg-border hover:bg-muted-foreground/40'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
