import { getJsonData, renderTags, sortBy, renderDescList, renderRune } from '../utils'

const spells = {
  async render(params) {
    const spellData = await getJsonData('./src/data/spells.json')
    const sorted = await spellData.sort(sortBy('name'))

    let spells = `
      <div class="container">
      `

    return spells += sorted.map(spell => {
      return `
        <article class="spell border">
        ${renderRune(spell.rune)}
        <h3 class="names nospace">${spell.name}</h3>
        <section class="school">${renderTags(spell.tags, '#spellTags')}</section>
        <blockquote>
          <section class="description">${spell.description}</section>
        </blockquote>

        ${renderDescList(spell.descList)}

        </article>
      `
    }).join('\n')
  }
}
export default spells

