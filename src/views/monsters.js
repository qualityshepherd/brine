import { getJsonData, sortBy, renderTags, renderImage } from '../utils'

const monsters = {
  async render(params) {
    const monsterData = await getJsonData('./src/data/monsters.json')
    const sorted = await monsterData.sort(sortBy('name'))

    let monsters = `
      <div class="container">
      `

    monsters += sorted.map(monster => {
      return `
        <article class="post border">
          ${renderImage(monster.image)}
          <h3 class="nospace">${monster.name}</h3>
          <section class="monster-stats">
            <span title="Attack"><b>AT:</b> ${monster.stats.at}</span>
            <span title="Armor: subtract from Damage Die"><b>AR:</b> ${monster.stats.ar};</span>
          </section>
          <blockquote>
            <section class="description">${monster.description}</section>
          </blockquote>
          <section class="tags" title="tags/filters">${renderTags(monster.tags, '#tags')}</section>
        </article>
      `
    }).join('\n')

    return monsters += `</div> <div class="small">images by midjourney</div>`
  }
}
export default monsters