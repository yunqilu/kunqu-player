export function gcd(left, right) {
  let a = Math.abs(Math.trunc(left))
  let b = Math.abs(Math.trunc(right))
  while (b) [a, b] = [b, a % b]
  return a || 1
}

export function lcm(left, right) {
  if (!left || !right) return 0
  return Math.abs(left * right) / gcd(left, right)
}

export function reduce(numerator, denominator = 1) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    throw new TypeError('Invalid rational number')
  }
  const sign = denominator < 0 ? -1 : 1
  const divisor = gcd(numerator, denominator)
  return { numerator: sign * numerator / divisor, denominator: Math.abs(denominator) / divisor }
}

export function fromNumber(value, maximumDenominator = 4096) {
  if (!Number.isFinite(value)) throw new TypeError('Invalid numeric duration')
  if (Number.isInteger(value)) return { numerator: value, denominator: 1 }
  let bestNumerator = Math.round(value)
  let bestDenominator = 1
  let bestError = Math.abs(value - bestNumerator)
  for (let denominator = 2; denominator <= maximumDenominator; denominator += 1) {
    const numerator = Math.round(value * denominator)
    const error = Math.abs(value - numerator / denominator)
    if (error < bestError - Number.EPSILON) {
      bestNumerator = numerator
      bestDenominator = denominator
      bestError = error
      if (error < 1e-12) break
    }
  }
  return reduce(bestNumerator, bestDenominator)
}

export function valueOf(fieldOrRational) {
  const rational = fieldOrRational?.value || fieldOrRational
  return rational.numerator / rational.denominator
}
