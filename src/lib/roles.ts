import type { ProjectRole, TeamRole, UserRole } from '../api/types'

// Figma 840:176 사용자 유형 선택지. API role 값과 1:1
export const ROLE_OPTIONS: Array<{ value: UserRole; title: string; body: string }> = [
  { value: 'writer', title: '현직 작가', body: '출간·연재 원고와 장기 서사 관리' },
  { value: 'aspiring_writer', title: '지망생', body: '집필 습관과 스토리 설계' },
  { value: 'reader', title: '독자', body: '작품 및 설정 분석' },
]

// PRJ 역할 (Figma 28)
export const PROJECT_ROLE_LABEL: Record<ProjectRole, string> = { owner: '소유자', editor: '편집자', viewer: '보기 전용' }

// TEAM 역할 (Figma 29)
export const TEAM_ROLE_LABEL: Record<TeamRole, string> = { owner: '소유자', admin: '관리자', member: '멤버' }
