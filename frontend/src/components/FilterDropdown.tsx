import { useEffect, useId, useRef, useState } from 'react'
import { Icon } from './Icon'

interface Props {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}

export function FilterDropdown({ label, value, options, onChange }: Props) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const selectedIndex = options.findIndex(option => option.value === value)

  useEffect(() => {
    if (!open) return
    function closeOutside(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open])

  useEffect(() => {
    if (open) document.getElementById(`${id}-${activeIndex}`)?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex, id])

  function choose(index: number) {
    const option = options[index]
    if (!option) return
    onChange(option.value)
    setOpen(false)
    buttonRef.current?.focus()
  }

  return <div className="filter-dropdown" ref={containerRef} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
  }}>
    <span className="filter-dropdown-label" id={`${id}-label`}>{label}</span>
    <button ref={buttonRef} type="button" role="combobox" className={`filter-dropdown-trigger ${selectedIndex > 0 ? 'is-selected' : ''}`}
      aria-labelledby={`${id}-label`} aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-options`}
      aria-activedescendant={open ? `${id}-${activeIndex}` : undefined}
      onClick={() => { setActiveIndex(Math.max(0, selectedIndex)); setOpen(!open) }}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); setOpen(false) }
        else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault()
          const current = open ? activeIndex : selectedIndex >= 0 ? selectedIndex : event.key === 'ArrowUp' ? 0 : -1
          setActiveIndex(event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (current + (event.key === 'ArrowUp' ? -1 : 1) + options.length) % options.length)
          setOpen(true)
        } else if ((event.key === 'Enter' || event.key === ' ') && open) {
          event.preventDefault(); choose(activeIndex)
        } else if (event.key.length === 1 && /\S/.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const start = open ? activeIndex + 1 : Math.max(0, selectedIndex + 1)
          const match = options.map((_, index) => (start + index) % options.length)
            .find(index => options[index].label.toLowerCase().startsWith(event.key.toLowerCase()))
          if (match !== undefined) { event.preventDefault(); setActiveIndex(match); setOpen(true) }
        }
      }}>
      <span>{options[selectedIndex]?.label || label}</span><Icon name="back" />
    </button>
    {open && <div id={`${id}-options`} role="listbox" aria-labelledby={`${id}-label`} className="filter-dropdown-options">
      {options.map((option, index) => <div key={option.value} id={`${id}-${index}`} role="option" aria-selected={value === option.value}
        className={`filter-dropdown-option ${value === option.value ? 'is-selected' : ''} ${activeIndex === index ? 'is-active' : ''}`}
        onPointerMove={() => setActiveIndex(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}>
        <span>{option.label}</span>{value === option.value && <Icon name="check" />}
      </div>)}
    </div>}
  </div>
}
