import { getJsonData, randomSort, setNumMirrors } from '../utils'

const mirrors = {
  async render(params) {
    const numMirrors = params.get('num') || 6
    const mirrorData = await getJsonData('./src/data/mirrors.json')
    const sorted = randomSort(mirrorData)

    let mirrors = `
      <article class="container border">
      <h2>
        Behind the Mirrors
        <a class="refresh" onclick="location.reload()" title="refresh...">&#8635;</a>
      </h2>
      <ol>
      `

    mirrors += sorted.slice(0, numMirrors).map(room => {
      return `<li class="room">${room}</li>`
    }).join('\n')

    return mirrors += `</ol></article>`
  }
}
export default mirrors