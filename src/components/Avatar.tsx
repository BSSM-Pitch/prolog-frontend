import './avatar.css'

export function Avatar({ name }: { name: string }) {
  return (
    <span className="character-avatar" aria-hidden="true">
      {name.slice(0, 1)}
    </span>
  )
}
