/**
 * School SIS helpers — pure (no I/O).
 * Classes, attendance, grades / report cards. Not an LMS.
 */

export const ATTENDANCE_MARKS = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const
export type AttendanceMark = (typeof ATTENDANCE_MARKS)[number]

export function isAttendanceMark(value: string): value is AttendanceMark {
  return (ATTENDANCE_MARKS as readonly string[]).includes(value)
}

/** Weighted average as percent of max (0–100 scale). */
export function weightedGradePercent(
  rows: { score: number; maxScore: number; weightPercent: number }[],
): number | null {
  let weightSum = 0
  let weighted = 0
  for (const row of rows) {
    if (!Number.isFinite(row.score) || !Number.isFinite(row.maxScore) || row.maxScore <= 0) continue
    const w = Number.isFinite(row.weightPercent) && row.weightPercent > 0 ? row.weightPercent : 0
    if (w <= 0) continue
    const pct = (row.score / row.maxScore) * 100
    weighted += pct * w
    weightSum += w
  }
  if (weightSum <= 0) return null
  return Math.round((weighted / weightSum) * 100) / 100
}

export function letterFromPercent(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return '—'
  if (pct >= 90) return 'A'
  if (pct >= 80) return 'B'
  if (pct >= 70) return 'C'
  if (pct >= 60) return 'D'
  return 'F'
}

/** Horn Africa school letters: Distinction / Credit / Pass / Fail. */
export function letterFromPercentHorn(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return '—'
  if (pct >= 80) return 'Distinction'
  if (pct >= 65) return 'Credit'
  if (pct >= 50) return 'Pass'
  return 'Fail'
}

/**
 * Competition ranks (1 = highest percent). Ties share a rank; the next rank skips.
 * Null / non-finite percents get a null rank and are ignored when placing others.
 */
export function rankStudents(percents: (number | null | undefined)[]): (number | null)[] {
  const ranked = percents
    .map((pct, index) => ({
      index,
      pct: pct != null && Number.isFinite(pct) ? pct : null,
    }))
    .filter((row): row is { index: number; pct: number } => row.pct != null)
    .sort((a, b) => b.pct - a.pct)

  const ranks: (number | null)[] = percents.map(() => null)
  let lastPct: number | null = null
  let lastRank = 0
  ranked.forEach((row, i) => {
    if (lastPct === null || row.pct !== lastPct) {
      lastRank = i + 1
      lastPct = row.pct
    }
    ranks[row.index] = lastRank
  })
  return ranks
}

export function attendanceSummary(
  marks: AttendanceMark[],
): { present: number; absent: number; late: number; excused: number; total: number; rate: number | null } {
  let present = 0
  let absent = 0
  let late = 0
  let excused = 0
  for (const mark of marks) {
    if (mark === 'PRESENT') present += 1
    else if (mark === 'LATE') late += 1
    else if (mark === 'EXCUSED') excused += 1
    else absent += 1
  }
  const total = marks.length
  const attended = present + late
  const rate = total > 0 ? Math.round((attended / total) * 10000) / 100 : null
  return { present, absent, late, excused, total, rate }
}

export function assertScoreInRange(score: number, maxScore: number): string | null {
  if (!Number.isFinite(score) || score < 0) return 'Score must be zero or greater.'
  if (!Number.isFinite(maxScore) || maxScore <= 0) return 'Max score must be greater than zero.'
  if (score > maxScore) return 'Score cannot exceed the max score.'
  return null
}
