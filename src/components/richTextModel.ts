/** Unwrap a model's document-level Markdown fence, never ordinary code examples. */
export function markdownBody(value: string) {
  const normalized = value.replace(/\r\n?/g, '\n')
  const wrapped = normalized.match(/^\s*```(?:markdown|md)[ \t]*\n([\s\S]*?)\n```\s*$/i)
  return wrapped ? wrapped[1] : normalized
}
