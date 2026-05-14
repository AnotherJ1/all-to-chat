import { useToastStore, type ToastKind } from '../../stores/toastStore'
import { IconClose } from './Icons'

const kindColors: Record<ToastKind, { border: string; bg: string; text: string }> = {
  info: { border: 'var(--accent-1)', bg: 'color-mix(in srgb, var(--accent-1) 10%, transparent)', text: 'var(--accent-1)' },
  success: { border: '#34d399', bg: 'rgba(52, 211, 153, 0.1)', text: '#34d399' },
  error: { border: '#f87171', bg: 'rgba(248, 113, 113, 0.1)', text: '#f87171' },
  warning: { border: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)', text: '#fbbf24' },
}

export default function ToastContainer() {
  const { toasts, dismiss } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map((t) => {
        const colors = kindColors[t.kind]
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 px-4 py-3 animate-slide-in"
            style={{
              background: colors.bg,
              border: `var(--border-width) solid ${colors.border}`,
              borderRadius: 'var(--radius-sm)',
              boxShadow: 'var(--shadow-md)',
              color: colors.text,
            }}
          >
            <span className="flex-1 text-sm leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="flex-shrink-0 opacity-60 hover:opacity-100 cursor-pointer"
              style={{ transition: 'var(--transition)' }}
            >
              <IconClose className="w-4 h-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
