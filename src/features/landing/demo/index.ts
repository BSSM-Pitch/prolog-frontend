import type { ComponentType } from 'react'
import type { FeatureKey } from '../../../content/voice'
import { ASK_LENGTH, AskDemo } from './AskDemo'
import { CHARACTER_LENGTH, CharacterDemo } from './CharacterDemo'
import { MANUSCRIPT_LENGTH, ManuscriptDemo } from './ManuscriptDemo'
import { OVERVIEW_LENGTH, OverviewDemo } from './OverviewDemo'
import { TEAM_LENGTH, TeamDemo } from './TeamDemo'
import { WORLD_LENGTH, WorldDemo } from './WorldDemo'

type Entry = { Demo: ComponentType<{ t: number }>; length: number; path: string }

/** 기능별 화면 데모, 재생 길이(초), 주소 표시줄에 보일 경로. 순서는 VOICE.features.items를 따른다 */
export const DEMOS: Record<FeatureKey, Entry> = {
  manuscript: { Demo: ManuscriptDemo, length: MANUSCRIPT_LENGTH, path: 'projects/붉은-문-너머/manuscripts/3차-원고' },
  ask: { Demo: AskDemo, length: ASK_LENGTH, path: 'projects/붉은-문-너머/ask' },
  character: { Demo: CharacterDemo, length: CHARACTER_LENGTH, path: 'projects/붉은-문-너머/characters/new' },
  world: { Demo: WorldDemo, length: WORLD_LENGTH, path: 'projects/붉은-문-너머/rules' },
  overview: { Demo: OverviewDemo, length: OVERVIEW_LENGTH, path: 'projects/붉은-문-너머/relationships' },
  team: { Demo: TeamDemo, length: TEAM_LENGTH, path: 'projects/붉은-문-너머/members' },
}
