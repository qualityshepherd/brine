export const THRESHOLD = 5
export const WINDOW = 600

export const is404Bot = (count) => count >= THRESHOLD
export const increment404 = (count) => count + 1
