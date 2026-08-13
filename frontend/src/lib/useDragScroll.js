import { useCallback, useRef } from 'react'

// Pointer-driven drag-to-scroll for horizontal strips (risk cards, hourly
// forecast). Suppresses the click that follows a real drag so dragging a
// card doesn't also trigger its onClick (opening a modal).
export function useDragScroll() {
  const ref = useRef(null)
  const state = useRef({ dragging: false, startX: 0, scrollLeft: 0, moved: false, pointerId: null })

  const onPointerDown = useCallback((e) => {
    const el = ref.current
    if (!el) return
    state.current = { dragging: true, startX: e.clientX, scrollLeft: el.scrollLeft, moved: false, pointerId: e.pointerId }
  }, [])

  const onPointerMove = useCallback((e) => {
    const el = ref.current
    if (!el || !state.current.dragging) return
    const dx = e.clientX - state.current.startX
    if (Math.abs(dx) > 5 && !state.current.moved) {
      state.current.moved = true
      // Only capture once a real drag is confirmed — capturing on every
      // pointerdown (even a plain tap) retargets the eventual click to
      // this container instead of the card underneath, silently breaking
      // taps on the cards.
      el.setPointerCapture?.(state.current.pointerId)
    }
    if (state.current.moved) el.scrollLeft = state.current.scrollLeft - dx
  }, [])

  const onPointerUp = useCallback((e) => {
    const el = ref.current
    if (el && state.current.moved) el.releasePointerCapture?.(state.current.pointerId)
    state.current.dragging = false
  }, [])

  const onClickCapture = useCallback((e) => {
    if (state.current.moved) {
      e.preventDefault()
      e.stopPropagation()
      state.current.moved = false
    }
  }, [])

  return { ref, onPointerDown, onPointerMove, onPointerUp, onPointerLeave: onPointerUp, onClickCapture }
}
