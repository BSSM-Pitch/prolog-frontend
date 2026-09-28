// [받침 있을 때, 받침 없을 때]
const PAIRS = {
  '을/를': ['을', '를'],
  '이/가': ['이', '가'],
  '은/는': ['은', '는'],
  '와/과': ['과', '와'],
  '으로/로': ['으로', '로'],
} as const

/** 받침 유무에 따라 조사를 붙인다. josa('윤서', '을/를') → '윤서를', josa('재현', '와/과') → '재현과' */
export function josa(word: string, pair: keyof typeof PAIRS): string {
  const last = word.charCodeAt(word.length - 1)
  const isHangul = last >= 0xac00 && last <= 0xd7a3
  const jong = isHangul ? (last - 0xac00) % 28 : 0
  const [withFinal, withoutFinal] = PAIRS[pair]
  // '으로/로'는 받침이 ㄹ(8)이어도 '로'
  const useFinal = pair === '으로/로' ? jong !== 0 && jong !== 8 : jong !== 0
  return word + (useFinal ? withFinal : withoutFinal)
}
