/** Select an exact source span and reveal it, including wrapped lines and late chapters. */
export function selectTextSource(el: HTMLTextAreaElement, quote: string, start?: number) {
  const at = start ?? el.value.indexOf(quote)
  if (at < 0 || el.value.slice(at, at + quote.length) !== quote) return false
  const style = getComputedStyle(el)
  const mirror = document.createElement('div')
  for (const property of ['font', 'line-height', 'letter-spacing', 'padding', 'border', 'box-sizing', 'word-spacing', 'tab-size']) {
    mirror.style.setProperty(property, style.getPropertyValue(property))
  }
  Object.assign(mirror.style, {
    position: 'fixed', left: '-100000px', top: '0', visibility: 'hidden',
    width: `${el.clientWidth}px`, whiteSpace: 'pre-wrap', overflowWrap: 'break-word',
  })
  mirror.textContent = el.value.slice(0, at)
  const marker = document.createElement('span')
  marker.textContent = quote || '\u200b'
  mirror.append(marker)
  document.body.append(mirror)
  const top = marker.getBoundingClientRect().top - mirror.getBoundingClientRect().top
  mirror.remove()
  el.focus({ preventScroll: true })
  el.setSelectionRange(at, at + quote.length)
  el.scrollTop = Math.max(0, top - el.clientHeight / 3)
  el.dispatchEvent(new Event('scroll'))
  el.scrollIntoView({ block: 'center' })
  return true
}
