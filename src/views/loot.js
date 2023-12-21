import { getJsonData, d6, getRandom } from '../utils'

const loot = {
  async render(params) {
    const lootData = await getJsonData('./src/data/loot.json')
    const herbs = await getJsonData('./src/data/herbs.json')

    // loot
    let view = `
      <div class="container">
      <div class="loot border">
      <h2 class="loot-type">Loot
        <a class="refresh" onclick="location.reload()" title="refresh...">&#8635;</a>
      </h2>
      <ul>
      `
    for(let i = 0; i < d6() + d6(); i++) {
      const lootType = await getRandom(lootData.loot)
      view += `
        <li>${getRandom(lootData.size)} <a href="https://www.google.com/search?q=${lootType}%20d%26d" target="new"><b>${lootType}</b></a>
         ${getRandom(lootData.quality)}.</li>
        `
    }

    view += `<li>and ${d6() * d6() + d6()} <b>coins</b>... </li></ul>`

    // herbs
    view += `
      <h3 class="loot-type">Herbs, Oils & Stones</h3>
      <ul>
    `

    for(let i = 0; i <= d6(); i++) {
      view += `
        <li>${getRandom(herbs)}</li>
      `
    }
    view += `</ul>`

    // potions
    view += `
      <h3 class="loot-type">Potions</h3>
      <ul>
    `

    for(let i = 0; i <= d6(); i++) {
      view += `
        <li>${getRandom(lootData.container)} that contains ${getRandom(lootData.potion_adjective)},
         ${getRandom(lootData.color)} liquid that ${getRandom(lootData.taste)} and when consumed <i>${getRandom(lootData.effect)}</i>.</li>
      `
    }
    view += `</ul>`

    // magic items...
    view += `
      <h3 class="loot-type">Magic Items</h3>
      <ul>
    `

    for(let i = 0; i <= d6(); i++) {
      view += `
        <li>${getRandom(lootData.magic_item)}</li>
      `
    }

    return view += `</ul>\n</div>\n</div>`
  }
}
export default loot