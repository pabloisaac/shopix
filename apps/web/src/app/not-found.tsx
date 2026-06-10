import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <h1 className="text-6xl font-display font-bold text-accent mb-4">404</h1>
      <p className="text-cripex-muted mb-6">Esta página no existe en la blockchain.</p>
      <Link href="/" className="btn-primary">
        Volver al inicio
      </Link>
    </div>
  )
}
