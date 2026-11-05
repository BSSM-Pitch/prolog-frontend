/** 받은 파일을 브라우저 다운로드로 저장한다 */
export function saveFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.append(a)
  a.click()
  a.remove()
  // 다운로드가 시작될 시간을 준 뒤 해제한다
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
