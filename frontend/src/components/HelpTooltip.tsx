import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// One portal keeps help visible outside scrolling panels without changing control layout.
export function HelpTooltip() {
  const id = useId()
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [position, setPosition] = useState({ left: 0, top: 0 })
  const tip = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let hovered: HTMLElement | null = null
    let focused: HTMLElement | null = null
    const control = (node: EventTarget | null) => node instanceof Element
      ? node.closest<HTMLElement>('[data-tooltip]:not(:disabled):not([aria-expanded="true"])') : null
    const cancel = () => { clearTimeout(timer) }
    const show = (element: HTMLElement | null, delay = 450) => {
      cancel()
      setTarget(null)
      if (element?.matches('[data-tooltip]:not(:disabled):not([aria-expanded="true"])')) timer = setTimeout(() => {
        if (element.isConnected) setTarget(element)
      }, delay)
    }
    const dismiss = () => { cancel(); setTarget(null) }
    const interact = () => { focused = null; dismiss() }
    const over = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      if (event.target instanceof Node && tip.current?.contains(event.target)) { cancel(); return }
      const next = control(event.target)
      if (next !== hovered) { hovered = next; show(hovered || focused) }
    }
    const out = (event: PointerEvent) => {
      if (event.relatedTarget instanceof Node && tip.current?.contains(event.relatedTarget)) return
      const next = control(event.relatedTarget)
      if (next === hovered && next) return
      hovered = next
      // Allow the pointer to cross the small gap between the control and its tip.
      if (!focused && !hovered) { cancel(); timer = setTimeout(() => setTarget(null), 120) }
      else show(hovered || focused)
    }
    const focus = (event: FocusEvent) => { focused = control(event.target); show(focused, 0) }
    const blur = () => { focused = null; show(hovered) }
    const key = (event: KeyboardEvent) => { if (event.key !== 'Tab') interact() }
    const scroll = () => {
      // Tabbing can scroll a control into view after focus; keep its help positioned.
      const bounds = focused?.getBoundingClientRect()
      if (focused === document.activeElement && bounds && bounds.bottom > 0 && bounds.top < window.innerHeight) show(focused, 0)
      else dismiss()
    }
    document.addEventListener('pointerover', over)
    document.addEventListener('pointerout', out)
    document.addEventListener('focusin', focus)
    document.addEventListener('focusout', blur)
    document.addEventListener('pointerdown', interact)
    document.addEventListener('click', interact)
    document.addEventListener('keydown', key)
    document.addEventListener('scroll', scroll, true)
    window.addEventListener('resize', dismiss)
    return () => {
      cancel()
      document.removeEventListener('pointerover', over)
      document.removeEventListener('pointerout', out)
      document.removeEventListener('focusin', focus)
      document.removeEventListener('focusout', blur)
      document.removeEventListener('pointerdown', interact)
      document.removeEventListener('click', interact)
      document.removeEventListener('keydown', key)
      document.removeEventListener('scroll', scroll, true)
      window.removeEventListener('resize', dismiss)
    }
  }, [])

  useLayoutEffect(() => {
    if (!target || !tip.current) return
    const anchor = target.getBoundingClientRect()
    const bounds = tip.current.getBoundingClientRect()
    setPosition({
      left: Math.max(8, Math.min(anchor.left + (anchor.width - bounds.width) / 2, window.innerWidth - bounds.width - 8)),
      top: Math.max(8, anchor.top >= bounds.height + 16
        ? anchor.top - bounds.height - 8
        : Math.min(anchor.bottom + 8, window.innerHeight - bounds.height - 8)),
    })
    const describedBy = target.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean) ?? []
    target.setAttribute('aria-describedby', [...describedBy, id].join(' '))
    return () => {
      const remaining = target.getAttribute('aria-describedby')?.split(/\s+/).filter(value => value && value !== id) ?? []
      if (remaining.length) target.setAttribute('aria-describedby', remaining.join(' '))
      else target.removeAttribute('aria-describedby')
    }
  }, [target, id])

  return target ? createPortal(
    <div id={id} ref={tip} role="tooltip" className="help-tooltip" style={position}>
      {target.dataset.tooltip}
    </div>, document.body,
  ) : null
}
