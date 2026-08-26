const fmtDate = str => str ? str.slice(0, 10) : ''

const BREAK = '<break>'

export const postsTemplate = post => {
  const parts = post.html.split(BREAK)
  const preview = parts[0]
  const truncated = parts.length > 1
  return `
  <div class="post" data-slug="${post.meta.slug}">
    <h2 class="post-title">
      <a href="/posts/${post.meta.slug}">${post.meta.title}</a>
      <button class="post-edit-btn" title="Edit">✎</button>
    </h2>
    ${post.meta.page ? '' : `<div class="date">${fmtDate(post.meta.date)}</div>`}
    <div>${preview}</div>
    ${truncated ? `<div class="post-break"><a class="read-more" href="/posts/${post.meta.slug}">read more</a></div>` : ''}
  </div>
`
}

export const singlePostTemplate = post => `
  <article class="post" data-slug="${post.meta.slug}">
    <h2 class="single-title">${post.meta.title}<button class="post-edit-btn" title="Edit">✎</button></h2>
    ${post.meta.page ? '' : `<div class="date">${fmtDate(post.meta.date)}</div>`}
    <div class="post-content">${post.html.replaceAll(BREAK, '')}</div>
  </article>
`

export const notFoundTemplate = (message = 'No results found.') => `
  <h2 class="not-found">${message}</h2>
`

export const archiveTemplate = (post, isOwner = false) => `
  <p${post.meta.audioUrl ? ' class="archive-pod"' : ''} data-slug="${post.meta.slug}">
    <a href="/posts/${post.meta.slug}"><span class="archive">${post.meta.title}</span></a>
    <span class="date">${fmtDate(post.meta.date)}</span>${isOwner ? ' <button class="post-edit-btn" title="Edit">✎</button>' : ''}
  </p>
`
