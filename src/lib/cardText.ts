// Plain-text form of a saved answer / card for the Today review cards.
// Answers imported from the library carry reader markup: `**bold**`,
// `[[#ch25-s6-p4|📖 منبع در متن]]` source links and `[[ch25]]` chapter
// links. The card has no reader to jump into (the same chapter number exists
// in several books), so links become their text; a generic «منبع …» label is
// dropped together with its " · " separator, since the line before it
// already names the chapter.
const SOURCE_LINK_RE = /(\s*·\s*|[ \t]+)?\[\[#[\w-]+(?:\|([^\]]+))?\]\]/g
const CHAPTER_LINK_RE = /\[\[ch(\d+)\]\]/g

export function plainCardText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(SOURCE_LINK_RE, (_m, sep: string | undefined, label: string | undefined) => {
      if (!label || /منبع/.test(label)) return ''
      return `${sep ?? ''}${label}`
    })
    .replace(CHAPTER_LINK_RE, 'فصل $1')
    .replace(/[ \t]+$/gm, '')
}
