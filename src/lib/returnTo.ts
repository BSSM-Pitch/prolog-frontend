// 로그인이 필요한 주소(예: 초대 링크)로 들어왔다가 로그인 화면으로 간 경우, 로그인 뒤 돌아갈 곳.
// Google 인가 화면을 다녀와도 남도록 sessionStorage에 둔다.
const KEY = 'prolog.return-to'

export function saveReturnTo(path: string) {
  try {
    sessionStorage.setItem(KEY, path)
  } catch {
    // 저장소를 못 쓰면 내 프로젝트로 간다
  }
}

export function takeReturnTo(fallback = '/projects') {
  try {
    const path = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    return path && path.startsWith('/') ? path : fallback
  } catch {
    return fallback
  }
}
