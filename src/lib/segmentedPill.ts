/**
 * .segmented·.projects__filters 묶음의 선택 표시(흰 알약)가 칸 사이를 미끄러져 가도록
 * 선택된 버튼의 위치·크기를 CSS 변수로 알려 준다. 화면 쪽 코드는 건드리지 않는다.
 */
function place(group: HTMLElement) {
  const on = group.querySelector<HTMLElement>('button[aria-checked="true"], button[aria-pressed="true"]')
  if (!on) {
    group.classList.remove('is-sliding')
    return
  }
  const first = !group.classList.contains('is-sliding')
  group.style.setProperty('--pill-x', `${on.offsetLeft}px`)
  group.style.setProperty('--pill-y', `${on.offsetTop}px`)
  group.style.setProperty('--pill-w', `${on.offsetWidth}px`)
  group.style.setProperty('--pill-h', `${on.offsetHeight}px`)
  // 처음 자리를 잡을 때는 움직임 없이 놓고, 그다음 프레임부터 움직이게 한다
  if (first) requestAnimationFrame(() => group.classList.add('is-sliding'))
}

function placeAll() {
  document.querySelectorAll<HTMLElement>('.segmented, .projects__filters').forEach(place)
}

export function initSegmentedPill() {
  let queued = false
  const schedule = () => {
    if (queued) return
    queued = true
    requestAnimationFrame(() => {
      queued = false
      placeAll()
    })
  }
  new MutationObserver(schedule).observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['aria-checked', 'aria-pressed'],
  })
  window.addEventListener('resize', schedule)
  schedule()
}
