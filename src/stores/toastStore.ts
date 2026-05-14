import { create } from 'zustand'
import { uuid } from '../lib/uuid'

export type ToastKind = 'info' | 'success' | 'error' | 'warning'

export interface Toast {
  id: string
  kind: ToastKind
  message: string
  duration: number
}

interface ToastState {
  toasts: Toast[]
  push: (kind: ToastKind, message: string, duration?: number) => string
  dismiss: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (kind, message, duration = 4000) => {
    const id = uuid()
    set((s) => ({ toasts: [...s.toasts, { id, kind, message, duration }] }))
    if (duration > 0) {
      window.setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
      }, duration)
    }
    return id
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const toast = {
  info: (msg: string, duration?: number) => useToastStore.getState().push('info', msg, duration),
  success: (msg: string, duration?: number) => useToastStore.getState().push('success', msg, duration),
  error: (msg: string, duration?: number) => useToastStore.getState().push('error', msg, duration),
  warning: (msg: string, duration?: number) => useToastStore.getState().push('warning', msg, duration),
}
