import { useToastStore, type ToastKind } from '../stores/toastStore'
import { IconClose } from './Icons'

const kindStyles: Record<ToastKind, string> = {
  info: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300',
  success: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
  error: 'border-red-400/40 bg-red-400/10 text-red-300',
  warning: 'border-yellow-400/40 bg-yellow-400/10 text-yellow-300',
}

export default function ToastContainer() {
  const { toasts, dismiss } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl shadow-lg animate-slide-in ${kindStyles[t.kind]}`}
        >
          <span className="flex-1 text-sm leading-relaxed">{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
          >
            <IconClose className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
