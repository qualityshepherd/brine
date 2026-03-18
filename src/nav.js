export const buildNav = (config) => ({
  showFeeds: !!config.separateFeeds,
  showPods: !!config.separatePods
})
