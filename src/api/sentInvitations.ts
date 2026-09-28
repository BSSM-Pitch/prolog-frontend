// real 모드: 백엔드에 "보낸 초대 목록"(PRJ) API가 없어서, 이 브라우저에서 보낸 초대를 기억해 둔다.
// 초대 링크에 들어갈 토큰도 생성 응답에만 오므로 여기 함께 남긴다 (DB에는 해시만 있다).

const KEY = 'prolog.sent-invitations.v1'

type Store = Record<string, Array<Record<string, unknown>>>

function read(): Store {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Store
  } catch {
    return {}
  }
}

function write(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    // 저장소를 못 쓰면 이번 화면에서만 보인다
  }
}

export function rememberInvitation<T extends { invitation_id: string }>(scope: string, invitation: T) {
  const store = read()
  store[scope] = [invitation as unknown as Record<string, unknown>, ...(store[scope] ?? []).filter((x) => x.invitation_id !== invitation.invitation_id)]
  write(store)
}

export function sentInvitations<T>(scope: string): T[] {
  return (read()[scope] ?? []) as T[]
}

export function forgetInvitation(scope: string, invitationId: string) {
  const store = read()
  store[scope] = (store[scope] ?? []).filter((x) => x.invitation_id !== invitationId)
  write(store)
}

/** 초대받은 사람이 여는 링크. 수락 화면이 토큰을 본문에 담아 accept API를 부른다 */
export function inviteUrl(kind: 'project' | 'team', parentId: string, invitationId: string, token: string | undefined) {
  if (!token) return null
  return `${window.location.origin}/invite/${kind}/${parentId}/${invitationId}?token=${encodeURIComponent(token)}`
}
