export type ProductCategory = 'electronics' | 'clothing' | 'home' | 'services' | 'other'

export type ProductCondition = 'new' | 'used' | 'refurbished'

export type OrderStatus =
  | 'pending_payment'
  | 'active'
  | 'completed'
  | 'disputed'
  | 'refunded'

export type TrackingCarrier = 'andreani' | 'oca' | 'correo_argentino' | 'pickup'

export type DisputeStatus =
  | 'pending'
  | 'evidence'
  | 'commit'
  | 'vote'
  | 'appeal'
  | 'resolved'

export type OrderEventType =
  | 'created'
  | 'payment_confirmed'
  | 'shipped'
  | 'delivered'
  | 'dispute_opened'
  | 'evidence_uploaded'
  | 'ruling_issued'
  | 'completed'
  | 'refunded'

export interface ShippingAddress {
  name: string
  street: string
  city: string
  province: string
  zip: string
  phone?: string
}

export interface ProductMeta {
  title: string
  description: string
  category: ProductCategory
  condition: ProductCondition
  price_usdt: string
  images: string[] // IPFS CIDs
}

export interface EvidencePackage {
  title: string
  description: string
  fileURI?: string
  fileTypeExtension?: string
  type: 'Evidence'
}

export interface MetaEvidence {
  title: string
  description: string
  question: string
  rulingOptions: {
    type: 'single-select'
    titles: [string, string]
    descriptions: [string, string]
  }
  fileURI?: string
  evidenceDisplayInterfaceURI?: string
}

// API response types
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export interface ApiError {
  error: string
  code?: string
  details?: unknown
}
