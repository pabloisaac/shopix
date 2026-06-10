import { clsx } from 'clsx'

interface GlowCardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
  as?: keyof JSX.IntrinsicElements
  hover?: boolean
}

export function GlowCard({ children, className, onClick, as: Tag = 'div', hover = false }: GlowCardProps) {
  return (
    <Tag
      className={clsx(
        'bg-white rounded-2xl border border-bg-border shadow-card',
        hover && 'hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {children}
    </Tag>
  )
}
