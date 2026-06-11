'use client'

import { useState, useEffect, useCallback } from 'react'
import { ProductCard } from '@/components/product/ProductCard'
import { api } from '@/lib/api'
import type { ProductCategory, ProductCondition } from '@shopix/shared'

const CATEGORIES: { value: ProductCategory | ''; label: string }[] = [
  { value: '', label: 'Todas' },
  { value: 'electronics', label: 'Electrónica' },
  { value: 'clothing', label: 'Ropa' },
  { value: 'home', label: 'Hogar' },
  { value: 'services', label: 'Servicios' },
  { value: 'other', label: 'Otros' },
]

const CONDITIONS: { value: ProductCondition | ''; label: string }[] = [
  { value: '', label: 'Cualquier estado' },
  { value: 'new', label: 'Nuevo' },
  { value: 'used', label: 'Usado' },
  { value: 'refurbished', label: 'Reacondicionado' },
]

const ORDER_OPTIONS = [
  { value: 'newest', label: 'Más recientes' },
  { value: 'price_asc', label: 'Precio: menor a mayor' },
  { value: 'price_desc', label: 'Precio: mayor a menor' },
  { value: 'views', label: 'Más vistos' },
]

export default function MarketplacePage() {
  const [products, setProducts] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [category, setCategory] = useState<ProductCategory | ''>('')
  const [condition, setCondition] = useState<ProductCondition | ''>('')
  const [orderBy, setOrderBy] = useState('newest')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(timer)
  }, [search])

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        orderBy,
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(category && { category }),
        ...(condition && { condition }),
        ...(minPrice && { minPrice }),
        ...(maxPrice && { maxPrice }),
      })

      const data = await api.get<{ data: any[]; total: number }>(`/products?${params}`)
      setProducts(data.data)
      setTotal(data.total)
    } catch {
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, category, condition, orderBy, minPrice, maxPrice])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, category, condition, orderBy, minPrice, maxPrice])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar de filtros */}
        <aside className="lg:w-56 flex-shrink-0">
          <div className="sticky top-24 space-y-6">
            <div>
              <h3 className="font-display font-semibold text-sm text-shopix-muted mb-3">Categoría</h3>
              <div className="space-y-1">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setCategory(cat.value)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                      category === cat.value
                        ? 'bg-accent/10 text-accent font-medium'
                        : 'text-shopix-muted hover:bg-bg-elevated hover:text-shopix-text'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-display font-semibold text-sm text-shopix-muted mb-3">Estado</h3>
              <div className="space-y-1">
                {CONDITIONS.map((cond) => (
                  <button
                    key={cond.value}
                    onClick={() => setCondition(cond.value)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                      condition === cond.value
                        ? 'bg-accent/10 text-accent font-medium'
                        : 'text-shopix-muted hover:bg-bg-elevated hover:text-shopix-text'
                    }`}
                  >
                    {cond.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-display font-semibold text-sm text-shopix-muted mb-3">Precio (USDT)</h3>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="input text-sm py-2 w-full"
                />
                <span className="text-shopix-faint">—</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="input text-sm py-2 w-full"
                />
              </div>
            </div>
          </div>
        </aside>

        {/* Grid de productos */}
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-6 flex-wrap">
            <input
              type="text"
              placeholder="Buscar productos…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input flex-1 min-w-48"
            />
            <select
              value={orderBy}
              onChange={(e) => setOrderBy(e.target.value)}
              className="input w-auto"
            >
              {ORDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="text-sm text-shopix-faint mb-4">
            {loading ? 'Cargando…' : `${total} productos encontrados`}
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="glow-card aspect-[3/4] animate-pulse bg-bg-elevated" />
              ))}
            </div>
          ) : products.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {/* Paginación */}
              {total > 20 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn-secondary py-2 px-4 text-sm disabled:opacity-40"
                  >
                    ← Anterior
                  </button>
                  <span className="text-sm text-shopix-muted px-4">
                    {page} / {Math.ceil(total / 20)}
                  </span>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={page * 20 >= total}
                    className="btn-secondary py-2 px-4 text-sm disabled:opacity-40"
                  >
                    Siguiente →
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-20 text-shopix-faint">
              <p className="text-lg">No hay productos con estos filtros</p>
              <button
                onClick={() => { setCategory(''); setCondition(''); setSearch(''); }}
                className="btn-secondary mt-4"
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
