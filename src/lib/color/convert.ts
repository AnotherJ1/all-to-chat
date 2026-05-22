/**
 * 颜色格式互转工具
 * 支持 sRGB ↔ HEX/RGB/RGBA/HSL/HSV/OKLCH/CMYK 七种格式互转
 *
 * OKLCH 实现遵循 CSS Color Module 4 标准:
 *   sRGB(gamma) → linearRGB → OKLab(XYZ via M1+nonlin) → OKLCH(L, C, H)
 *
 * 所有 RGB 通道范围 0-255；HSL/HSV 中 H 范围 0-360,S/L/V 范围 0-100。
 * OKLCH 中 L 范围 0-1,C 范围 0-0.4 量级,H 范围 0-360。
 */

export interface RGB { r: number; g: number; b: number }
export interface RGBA extends RGB { a: number } // a: 0-1
export interface HSL { h: number; s: number; l: number }
export interface HSV { h: number; s: number; v: number }
export interface OKLCH { l: number; c: number; h: number }
export interface CMYK { c: number; m: number; y: number; k: number } // 0-100

/** 将 0-255 数值钳制到合法范围并四舍五入 */
function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)))
}

/** 将 0-1 数值钳制 */
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

/** ============== HEX ↔ RGB ============== */

/** HEX 字符串 → RGBA;支持 #RGB / #RGBA / #RRGGBB / #RRGGBBAA */
export function hexToRgba(hex: string): RGBA | null {
  const m = hex.trim().replace(/^#/, '')
  let r = 0, g = 0, b = 0, a = 1
  if (/^[0-9a-f]{3}$/i.test(m)) {
    r = parseInt(m[0] + m[0], 16)
    g = parseInt(m[1] + m[1], 16)
    b = parseInt(m[2] + m[2], 16)
  } else if (/^[0-9a-f]{4}$/i.test(m)) {
    r = parseInt(m[0] + m[0], 16)
    g = parseInt(m[1] + m[1], 16)
    b = parseInt(m[2] + m[2], 16)
    a = parseInt(m[3] + m[3], 16) / 255
  } else if (/^[0-9a-f]{6}$/i.test(m)) {
    r = parseInt(m.slice(0, 2), 16)
    g = parseInt(m.slice(2, 4), 16)
    b = parseInt(m.slice(4, 6), 16)
  } else if (/^[0-9a-f]{8}$/i.test(m)) {
    r = parseInt(m.slice(0, 2), 16)
    g = parseInt(m.slice(2, 4), 16)
    b = parseInt(m.slice(4, 6), 16)
    a = parseInt(m.slice(6, 8), 16) / 255
  } else {
    return null
  }
  return { r, g, b, a }
}

/** RGB → 大写 6 位 HEX(不含 alpha) */
export function rgbToHex({ r, g, b }: RGB): string {
  const toHex = (n: number) => clamp255(n).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
}

/** RGBA → 8 位 HEX(含 alpha,2 位 hex) */
export function rgbaToHex({ r, g, b, a }: RGBA): string {
  const toHex = (n: number) => clamp255(n).toString(16).padStart(2, '0')
  const aHex = toHex(Math.round(clamp01(a) * 255))
  return `#${toHex(r)}${toHex(g)}${toHex(b)}${aHex}`.toUpperCase()
}

/** ============== RGB ↔ HSL ============== */

/** RGB(0-255) → HSL(H 0-360, S/L 0-100) */
export function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  let h = 0, s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case rn: h = ((gn - bn) / d + (gn < bn ? 6 : 0)); break
      case gn: h = ((bn - rn) / d + 2); break
      case bn: h = ((rn - gn) / d + 4); break
    }
    h *= 60
  }
  return { h: Math.round(h * 10) / 10, s: Math.round(s * 1000) / 10, l: Math.round(l * 1000) / 10 }
}

/** HSL → RGB(0-255) */
export function hslToRgb({ h, s, l }: HSL): RGB {
  const hn = ((h % 360) + 360) % 360 / 360
  const sn = clamp01(s / 100)
  const ln = clamp01(l / 100)
  if (sn === 0) {
    const v = clamp255(ln * 255)
    return { r: v, g: v, b: v }
  }
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn
  const p = 2 * ln - q
  const hue2rgb = (t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return {
    r: clamp255(hue2rgb(hn + 1 / 3) * 255),
    g: clamp255(hue2rgb(hn) * 255),
    b: clamp255(hue2rgb(hn - 1 / 3) * 255),
  }
}

/** ============== RGB ↔ HSV ============== */

export function rgbToHsv({ r, g, b }: RGB): HSV {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  const v = max
  const d = max - min
  const s = max === 0 ? 0 : d / max
  let h = 0
  if (max !== min) {
    switch (max) {
      case rn: h = ((gn - bn) / d + (gn < bn ? 6 : 0)); break
      case gn: h = ((bn - rn) / d + 2); break
      case bn: h = ((rn - gn) / d + 4); break
    }
    h *= 60
  }
  return { h: Math.round(h * 10) / 10, s: Math.round(s * 1000) / 10, v: Math.round(v * 1000) / 10 }
}

export function hsvToRgb({ h, s, v }: HSV): RGB {
  const hn = ((h % 360) + 360) % 360
  const sn = clamp01(s / 100)
  const vn = clamp01(v / 100)
  const c = vn * sn
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1))
  const m = vn - c
  let r1 = 0, g1 = 0, b1 = 0
  if (hn < 60) { r1 = c; g1 = x; b1 = 0 }
  else if (hn < 120) { r1 = x; g1 = c; b1 = 0 }
  else if (hn < 180) { r1 = 0; g1 = c; b1 = x }
  else if (hn < 240) { r1 = 0; g1 = x; b1 = c }
  else if (hn < 300) { r1 = x; g1 = 0; b1 = c }
  else { r1 = c; g1 = 0; b1 = x }
  return { r: clamp255((r1 + m) * 255), g: clamp255((g1 + m) * 255), b: clamp255((b1 + m) * 255) }
}

/** ============== RGB ↔ CMYK ============== */

export function rgbToCmyk({ r, g, b }: RGB): CMYK {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const k = 1 - Math.max(rn, gn, bn)
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 }
  const c = (1 - rn - k) / (1 - k)
  const m = (1 - gn - k) / (1 - k)
  const y = (1 - bn - k) / (1 - k)
  return {
    c: Math.round(c * 1000) / 10,
    m: Math.round(m * 1000) / 10,
    y: Math.round(y * 1000) / 10,
    k: Math.round(k * 1000) / 10,
  }
}

export function cmykToRgb({ c, m, y, k }: CMYK): RGB {
  const cn = clamp01(c / 100), mn = clamp01(m / 100), yn = clamp01(y / 100), kn = clamp01(k / 100)
  return {
    r: clamp255((1 - cn) * (1 - kn) * 255),
    g: clamp255((1 - mn) * (1 - kn) * 255),
    b: clamp255((1 - yn) * (1 - kn) * 255),
  }
}

/** ============== sRGB ↔ OKLCH (CSS Color Module 4) ============== */

/** sRGB(0-1) gamma → linear-light(0-1) */
function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** linear-light(0-1) → sRGB(0-1) gamma */
function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
}

/** RGB(0-255) → OKLab(L, a, b);标准矩阵 + 立方根非线性 */
function rgbToOklab({ r, g, b }: RGB): { L: number; a: number; b: number } {
  const lr = srgbToLinear(r / 255)
  const lg = srgbToLinear(g / 255)
  const lb = srgbToLinear(b / 255)
  // M1: linearRGB → LMS
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb
  // 立方根非线性
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s)
  // M2: LMS' → OKLab
  return {
    L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  }
}

/** OKLab → RGB(0-255) */
function oklabToRgb({ L, a, b }: { L: number; a: number; b: number }): RGB {
  // OKLab → LMS'
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b
  // 立方
  const l = l_ * l_ * l_
  const m = m_ * m_ * m_
  const s = s_ * s_ * s_
  // LMS → linearRGB
  const lr = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  return {
    r: clamp255(linearToSrgb(lr) * 255),
    g: clamp255(linearToSrgb(lg) * 255),
    b: clamp255(linearToSrgb(lb) * 255),
  }
}

/** RGB → OKLCH (L 0-1, C ~0-0.4, H 0-360) */
export function rgbToOklch(rgb: RGB): OKLCH {
  const { L, a, b } = rgbToOklab(rgb)
  const c = Math.sqrt(a * a + b * b)
  let h = Math.atan2(b, a) * 180 / Math.PI
  if (h < 0) h += 360
  return {
    l: Math.round(L * 10000) / 10000,
    c: Math.round(c * 10000) / 10000,
    h: Math.round(h * 100) / 100,
  }
}

/** OKLCH → RGB */
export function oklchToRgb({ l, c, h }: OKLCH): RGB {
  const hr = h * Math.PI / 180
  const a = c * Math.cos(hr)
  const b = c * Math.sin(hr)
  return oklabToRgb({ L: l, a, b })
}

/** ============== 字符串格式化 ============== */

export function formatRgb({ r, g, b }: RGB): string {
  return `rgb(${clamp255(r)}, ${clamp255(g)}, ${clamp255(b)})`
}

export function formatRgba({ r, g, b, a }: RGBA): string {
  const aa = Math.round(clamp01(a) * 1000) / 1000
  return `rgba(${clamp255(r)}, ${clamp255(g)}, ${clamp255(b)}, ${aa})`
}

export function formatHsl({ h, s, l }: HSL): string {
  return `hsl(${Math.round(h * 10) / 10}, ${Math.round(s * 10) / 10}%, ${Math.round(l * 10) / 10}%)`
}

export function formatHsv({ h, s, v }: HSV): string {
  return `hsv(${Math.round(h * 10) / 10}, ${Math.round(s * 10) / 10}%, ${Math.round(v * 10) / 10}%)`
}

export function formatOklch({ l, c, h }: OKLCH): string {
  // 标准 CSS 格式:oklch(L% C H);L 转百分比
  const lp = Math.round(l * 10000) / 100
  const cv = Math.round(c * 10000) / 10000
  const hv = Math.round(h * 100) / 100
  return `oklch(${lp}% ${cv} ${hv})`
}

export function formatCmyk({ c, m, y, k }: CMYK): string {
  return `cmyk(${Math.round(c * 10) / 10}%, ${Math.round(m * 10) / 10}%, ${Math.round(y * 10) / 10}%, ${Math.round(k * 10) / 10}%)`
}

/** ============== 字符串解析(松散格式) ============== */

/** 解析任意格式字符串为 RGBA;识别失败返回 null */
export function parseColor(input: string): RGBA | null {
  const s = input.trim().toLowerCase()
  if (!s) return null
  // HEX
  if (s.startsWith('#')) return hexToRgba(s)
  // rgb / rgba
  if (s.startsWith('rgb')) {
    const nums = s.match(/-?\d+\.?\d*/g)
    if (nums && nums.length >= 3) {
      const [r, g, b, a] = nums.map(Number)
      return { r: clamp255(r), g: clamp255(g), b: clamp255(b), a: a !== undefined ? clamp01(a) : 1 }
    }
  }
  // hsl
  if (s.startsWith('hsl')) {
    const nums = s.match(/-?\d+\.?\d*/g)
    if (nums && nums.length >= 3) {
      const [h, sa, l] = nums.map(Number)
      const rgb = hslToRgb({ h, s: sa, l })
      return { ...rgb, a: 1 }
    }
  }
  // hsv
  if (s.startsWith('hsv')) {
    const nums = s.match(/-?\d+\.?\d*/g)
    if (nums && nums.length >= 3) {
      const [h, sa, v] = nums.map(Number)
      const rgb = hsvToRgb({ h, s: sa, v })
      return { ...rgb, a: 1 }
    }
  }
  // oklch
  if (s.startsWith('oklch')) {
    const nums = s.match(/-?\d+\.?\d*/g)
    if (nums && nums.length >= 3) {
      const [lRaw, c, h] = nums.map(Number)
      // 容错:如果原文中 L 跟着 %,则除以 100
      const l = (lRaw > 1 && /[\d.]+%/.test(s)) ? lRaw / 100 : lRaw
      const rgb = oklchToRgb({ l, c, h })
      return { ...rgb, a: 1 }
    }
  }
  // cmyk
  if (s.startsWith('cmyk')) {
    const nums = s.match(/-?\d+\.?\d*/g)
    if (nums && nums.length >= 4) {
      const [c, mv, y, k] = nums.map(Number)
      const rgb = cmykToRgb({ c, m: mv, y, k })
      return { ...rgb, a: 1 }
    }
  }
  // 兜底:尝试当 hex 解析(无 #)
  if (/^[0-9a-f]{3,8}$/.test(s)) return hexToRgba('#' + s)
  return null
}
