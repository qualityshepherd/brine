import { sortBy, renderTags, getJsonData, renderDescList, renderRune } from '../utils'

const spellTags = {
  async render(params) {
    const t = params.get('t')
    const spellData = await getJsonData('./src/data/spells.json')
    const sorted = await spellData.sort(sortBy('name'))
    const found = sorted.filter(({tags}) => {
      return tags.toLowerCase().indexOf(t.toLowerCase()) > -1
    })

    let spells = `
      <div class="container">
      `

    spells += found.map(spell => {
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

    return spells += `</div>`

    const noResults = `
      <h1>No Results Found</h1>
    `
    return (spells.length > 0) ? spells : noResults
  }
}
export default spellTags