import { renderTags } from './ui.js'

export const postsTemplate = post => {
  const [preview, fullContent] = post.html.split('<break>')
  const hasBreak = fullContent !== undefined
  return `
    <div class="post">
      <a href="#post?s=${post.meta.slug}" role="button" aria-label="post-title">
        <h2 class="post-title">${post.meta.title}</h2>
      </a>
      <div class="date">${post.meta.date}</div>
      <div class="post-content">
        ${hasBreak ? preview : post.html}
        ${hasBreak ? `<div class="post-break"><div class="read-more"><a href="#post?s=${post.meta.slug}">Read more...</a></div></div>` : ''}
      </div>
      <div class="tags">${renderTags(post.meta.tags)}</div>
    </div>
  `
}

export const singlePostTemplate = post => `
  <article class="post">
    <h2>${post.meta.title}</h2>
    <div class="date">${post.meta.date}</div>
    <div class="post-content">${post.html}</div>
    <div class="tags">${renderTags(post.meta.tags)}</div>
  </article>
`

export const notFoundTemplate = () => '<p>Post not found.</p>'

export const aboutPageTemplate = () => `
  <h2>About</h2>
  <div class="center">
    I'm a blabby nerd that lives in the desert.
    <div class="social">
      <a href='&#109;a&#105;l&#116;o&#58;m%65%4&#48;b&#114;&#105;n%65&#46;%64e&#118;' title="email"><img src="assets/images/social/email.png" alt="email"></a>
      <a href="https://casadeocio.itch.io/" title="games on itch"><img src="assets/images/social/itch-io.png" alt="my publications on itch"></a>
      <a href="https://podcasts.apple.com/au/podcast/play-worlds-podcast/id1722152993" title="Play Worlds Podcast"><img src="assets/images/social/podcast.png" alt="Play Worlds Podcast"></a>
      <a href="https://www.youtube.com/channel/UCy0_3iGguFBabUOdQ2o_ZUQ" title="youtube"><img src="assets/images/social/youtube.png" alt="youtube"></a>
      <a href="/assets/rss/blog.xml"><img src="assets/images/social/rss.png" title="blog rss" alt="blog rss"></a>
    </div>
  </div>
`

export const archiveTemplate = post => `
  <p>
    <a href="#post?s=${post.meta.slug}"><span class="archive">${post.meta.title}</span></a>
    <span class="date">${post.meta.date}</span>
  </p>
`
