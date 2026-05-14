/**
 * Tool Hub Logo — 俏皮的工具箱 + 闪电组合
 * SVG 内联，主题感知颜色
 */
export default function Logo({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Tool Hub Logo"
    >
      {/* 圆角方形底座 */}
      <rect
        x="4" y="12" width="56" height="44" rx="10"
        fill="var(--bg-surface)"
        stroke="var(--border-color)"
        strokeWidth="3"
      />
      {/* 提手 */}
      <path
        d="M22 12V8a10 10 0 0 1 20 0v4"
        stroke="var(--accent-1)"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      {/* 中间分割线 */}
      <line x1="4" y1="28" x2="60" y2="28" stroke="var(--border-color)" strokeWidth="2" />
      {/* 闪电 ⚡ */}
      <path
        d="M36 22L28 34h8l-4 12 12-14h-8l4-10z"
        fill="var(--accent-1)"
        stroke="var(--border-color)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* 左侧小圆点装饰 */}
      <circle cx="16" cy="42" r="4" fill="var(--accent-2)" opacity="0.7" />
      {/* 右侧小圆点装饰 */}
      <circle cx="48" cy="42" r="4" fill="var(--accent-3)" opacity="0.7" />
    </svg>
  )
}
