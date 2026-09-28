// real 모드에서 "나"의 user_id. 백엔드 응답에 my_role 같은 값이 없어 화면 쪽에서 계산할 때 쓴다.
// 로그인·/users/me 응답을 받을 때 client가 채운다.
let currentUserId: string | null = null

export const setCurrentUserId = (id: string | null) => {
  currentUserId = id
}
export const getCurrentUserId = () => currentUserId
