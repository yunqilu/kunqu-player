export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
}

// Browser-safe SHA-256 so the pure conversion seam stays synchronous and environment-independent.
export function sha256(input) {
  const utf8 = unescape(encodeURIComponent(input))
  const words = []
  const bitLength = utf8.length * 8
  for (let i = 0; i < utf8.length; i += 1) words[i >> 2] = (words[i >> 2] || 0) | utf8.charCodeAt(i) << (24 - (i % 4) * 8)
  words[bitLength >> 5] = (words[bitLength >> 5] || 0) | 0x80 << (24 - bitLength % 32)
  words[((bitLength + 64 >> 9) << 4) + 15] = bitLength
  const k = []
  const h = []
  let prime = 2
  while (k.length < 64) {
    let isPrime = true
    for (let d = 2; d * d <= prime; d += 1) if (prime % d === 0) { isPrime = false; break }
    if (isPrime) {
      if (h.length < 8) h.push((Math.sqrt(prime) % 1 * 0x100000000) | 0)
      k.push((Math.cbrt(prime) % 1 * 0x100000000) | 0)
    }
    prime += 1
  }
  const rotr = (n, x) => x >>> n | x << 32 - n
  for (let offset = 0; offset < words.length; offset += 16) {
    const w = Array.from({ length: 64 }, (_, index) => words[offset + index] || 0)
    const old = h.slice()
    for (let i = 16; i < 64; i += 1) {
      const a = w[i - 15]
      const b = w[i - 2]
      w[i] = (w[i - 16] + (rotr(7, a) ^ rotr(18, a) ^ a >>> 3) + w[i - 7] + (rotr(17, b) ^ rotr(19, b) ^ b >>> 10)) | 0
    }
    let [a, b, c, d, e, f, g, hh] = h
    for (let i = 0; i < 64; i += 1) {
      const s1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e)
      const ch = e & f ^ ~e & g
      const t1 = (hh + s1 + ch + k[i] + w[i]) | 0
      const s0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a)
      const maj = a & b ^ a & c ^ b & c
      const t2 = (s0 + maj) | 0
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0
    }
    h[0] = (old[0] + a) | 0; h[1] = (old[1] + b) | 0
    h[2] = (old[2] + c) | 0; h[3] = (old[3] + d) | 0
    h[4] = (old[4] + e) | 0; h[5] = (old[5] + f) | 0
    h[6] = (old[6] + g) | 0; h[7] = (old[7] + hh) | 0
  }
  return h.map((n) => (n >>> 0).toString(16).padStart(8, '0')).join('')
}

export function stableId(prefix, ...parts) {
  const raw = parts.map((part) => String(part)).join('_').replace(/[^A-Za-z0-9_.-]+/g, '_')
  return `${prefix}_${raw}`.replace(/^[^A-Za-z_]/, '_$&')
}
