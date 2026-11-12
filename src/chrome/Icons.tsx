import type { ReactNode } from 'react'
import type { Tool } from '../scene/store'
import { Eyes } from '../scene/Eyes'

const S = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <svg viewBox="0 0 20 20" className={`ico ${className}`} aria-hidden="true" focusable="false">
    {children}
  </svg>
)

export function MomoMark() {
  return (
    <span className="momo-mark" aria-hidden="true">
      <svg viewBox="0 0 100 94">
        <path d="M50 4C75 3 96 20 95 47c-1 27-19 44-45 43C23 89 4 73 5 46 6 20 25 5 50 4Z" fill="#5B4BFF" stroke="#16131D" strokeWidth="6" />
      </svg>
      <Eyes x={50} y={47} size={11} gap={0.32} />
    </span>
  )
}

export const ToolIcon: Record<Tool, () => ReactNode> = {
  move: () => (
    <S>
      <path d="M5 3.5 15.5 9l-4.6 1.3L8.6 15 5 3.5Z" />
    </S>
  ),
  frame: () => (
    <S>
      <path d="M7 3v14M13 3v14M3 7h14M3 13h14" />
    </S>
  ),
  shape: () => (
    <S>
      <rect x="3" y="3" width="8" height="8" rx="2.5" />
      <circle cx="13" cy="13" r="4.2" />
    </S>
  ),
  pen: () => (
    <S>
      <path d="M10 3 15 11l-5 6-5-6 5-8Z" />
      <circle cx="10" cy="11" r="1.4" />
    </S>
  ),
  text: () => (
    <S>
      <path d="M4.5 5V3.8h11V5M10 3.8V16.5M7.5 16.5h5" />
    </S>
  ),
  hand: () => (
    <S>
      <path d="M7 10V4.8a1.3 1.3 0 0 1 2.6 0V9m0-.5V3.6a1.3 1.3 0 0 1 2.6 0V9m0-4a1.3 1.3 0 0 1 2.6 0v6c0 3.5-2.2 6-5.5 6-2.6 0-3.9-1.1-5.1-2.9L3.5 12a1.4 1.4 0 0 1 2.2-1.7L7 11.6" />
    </S>
  ),
  comment: () => (
    <S>
      <path d="M3.5 16.5V7.5a4 4 0 0 1 4-4h5a4 4 0 0 1 4 4v1.5a4 4 0 0 1-4 4h-5l-4 3.5Z" />
    </S>
  ),
}

export const LayerIcon = {
  frame: () => (
    <S className="ico-sm">
      <path d="M7 3v14M13 3v14M3 7h14M3 13h14" />
    </S>
  ),
  text: () => (
    <S className="ico-sm">
      <path d="M5 5.5V4h10v1.5M10 4v12M8 16h4" />
    </S>
  ),
  component: () => (
    <S className="ico-sm ico-comp">
      <path d="M10 2.8 13 5.8 10 8.8 7 5.8ZM10 11.2l3 3-3 3-3-3ZM5.8 7l3 3-3 3-3-3ZM14.2 7l3 3-3 3-3-3Z" />
    </S>
  ),
  note: () => (
    <S className="ico-sm">
      <path d="M4 4h12v8l-4 4H4ZM12 16v-4h4" />
    </S>
  ),
  organism: () => (
    <S className="ico-sm ico-org">
      <path d="M10 3c4 0 7 2.4 7 6.6 0 4.4-3 7.4-7 7.4s-7-2.6-7-7C3 5.6 6 3 10 3Z" />
    </S>
  ),
  auto: () => (
    <S className="ico-sm">
      <rect x="3.5" y="3.5" width="13" height="3.2" rx="1" />
      <rect x="3.5" y="8.4" width="13" height="3.2" rx="1" />
      <rect x="3.5" y="13.3" width="13" height="3.2" rx="1" />
    </S>
  ),
  image: () => (
    <S className="ico-sm">
      <rect x="3" y="4" width="14" height="12" rx="2.5" />
      <path d="m4 14 4-4 3 3 2-2 3 3" />
      <circle cx="13" cy="7.6" r="1.2" />
    </S>
  ),
}

export function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 10 10" className={`chev${open ? ' is-open' : ''}`} aria-hidden="true">
      <path d="M3.5 2 6.5 5l-3 3" />
    </svg>
  )
}
