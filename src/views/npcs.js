import { getJsonData, d6, getRandom } from '../utils'

const npc = {
  async render(params) {
    const npcData = await getJsonData('./src/data/npcs.json')

    let view = `
      <div class="container">
      <div class="npc border">
      `

    for(let i = 0; i < 10; i++) {
      const roll = d6()
      const pronoun = (roll > 3) ? "He" : "She" // flip coin
      const first = (roll > 3) ? getRandom(npcData.male) : getRandom(npcData.female)
      const last = getRandom(npcData.last)
      const looks = getRandom(npcData.looks)
      const traits = getRandom(npcData.traits)
      const wants = getRandom(npcData.wants)
      const and = getRandom(npcData.and)
      view += `
        <span class="names">${first} ${last}</span>
        <blockquote class="space">
        <div class="description">
          ${pronoun} ${looks}. ${pronoun} ${traits} and wants ${wants}. ${pronoun} ${and}.
        </div>
        </blockquote>
      `
    }

    return view += `</div>\n</div>`
  }
}
export default npc