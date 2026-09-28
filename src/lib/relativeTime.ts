/** "방금", "2시간 전", "어제", "3일 전", "1주 전", "2달 전" */
export function relativeTime(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime())
  const min = Math.floor(diff / 60_000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days === 1) return '어제'
  if (days < 7) return `${days}일 전`
  if (days < 30) return `${Math.floor(days / 7)}주 전`
  if (days < 365) return `${Math.floor(days / 30)}달 전`
  return `${Math.floor(days / 365)}년 전`
}

/** "오늘 14:22", "어제 22:10", "9월 25일 18:02", 해가 다르면 "2025년 9월 25일 18:02" */
export function formatStamp(iso: string, now = new Date()): string {
  const d = new Date(iso)
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((day(now) - day(d)) / 86_400_000)
  if (diff === 0) return `오늘 ${time}`
  if (diff === 1) return `어제 ${time}`
  const date = `${d.getMonth() + 1}월 ${d.getDate()}일`
  return d.getFullYear() === now.getFullYear() ? `${date} ${time}` : `${d.getFullYear()}년 ${date} ${time}`
}

/** "8월 12일" */
export function shortDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}
