export const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/
export const CODE_RULE = /^\d{6}$/

export function validateUsername(v: string): string | null {
  const s = v.trim()
  if (!s) return '아이디를 입력해 주세요.'
  if (s.length < 2 || s.length > 30) return '아이디는 2~30자로 정해 주세요.'
  if (/\s/.test(s)) return '아이디에는 공백을 넣을 수 없어요.'
  return null
}

export function validateEmail(v: string): string | null {
  if (!v.trim()) return '이메일을 입력해 주세요.'
  if (!EMAIL_RULE.test(v.trim())) return '이메일 형식이 올바르지 않아요. 예: writer@example.com'
  return null
}

export function validatePassword(v: string): string | null {
  if (!v) return '비밀번호를 입력해 주세요.'
  if (!PASSWORD_RULE.test(v)) return '영문과 숫자를 포함해 8자 이상으로 정해 주세요.'
  return null
}

export function validateConfirm(password: string, confirm: string): string | null {
  if (!confirm) return '비밀번호를 한 번 더 입력해 주세요.'
  if (password !== confirm) return '비밀번호가 서로 달라요.'
  return null
}
