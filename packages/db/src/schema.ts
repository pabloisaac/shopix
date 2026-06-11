import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ─── Enums ──────────────────────────────────────────────────────────

export const productCategoryEnum = pgEnum('product_category', [
  'electronics',
  'clothing',
  'home',
  'services',
  'other',
])

export const productConditionEnum = pgEnum('product_condition', [
  'new',
  'used',
  'refurbished',
])

export const userRiskLevelEnum = pgEnum('user_risk_level', [
  'clean',
  'warning',
  'risky',
  'banned',
])

export const orderStatusEnum = pgEnum('order_status', [
  'awaiting_payment',  // dirección de depósito generada, esperando transferencia
  'pending_payment',
  'active',
  'completed',
  'disputed',
  'return_required',   // Comprador ganó disputa, debe devolver el producto
  'return_in_transit', // Comprador cargó tracking de devolución
  'refunded',          // Disputa resuelta, fondos devueltos
  'refunded_no_return', // Comprador no devolvió en plazo → reputación afectada
])

export const returnCarrierEnum = pgEnum('return_carrier', [
  'andreani',
  'oca',
  'correo_argentino',
  'pickup',
])

export const trackingCarrierEnum = pgEnum('tracking_carrier', [
  'andreani',
  'oca',
  'correo_argentino',
  'pickup',
])

export const orderEventTypeEnum = pgEnum('order_event_type', [
  'created',
  'payment_confirmed',
  'shipped',
  'delivered',
  'dispute_opened',
  'evidence_uploaded',
  'ruling_issued',
  'return_required',
  'return_tracking_uploaded',
  'return_received',
  'return_deadline_missed',
  'completed',
  'refunded',
  'shipping_deadline_warning',
  'auto_cancelled',
])

export const orderMessageTypeEnum = pgEnum('order_message_type', [
  // Buyer messages
  'buyer_asking_shipping_date',
  'buyer_asking_status',
  'buyer_asking_delay',
  'buyer_received_damaged',
  // Seller messages
  'seller_shipped',
  'seller_shipping_delayed',
  'seller_problem_stock',
  'seller_pickup_ready',
  'seller_shipped_late_warning',
])

export const disputeStatusEnum = pgEnum('dispute_status', [
  'pending',
  'evidence',
  'commit',
  'vote',
  'appeal',
  'resolved',
])

// ─── Tables ─────────────────────────────────────────────────────────

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Auth clásica (email + password) — reemplaza SIWE
    email: text('email'),
    passwordHash: text('password_hash'),
    emailVerified: boolean('email_verified').notNull().default(false),
    // Wallet opcional (solo si el usuario quiere vincularla)
    walletAddress: text('wallet_address'),
    username: text('username'),
    avatarIpfs: text('avatar_ipfs'),
    reputationScore: integer('reputation_score').notNull().default(0),
    totalSales: integer('total_sales').notNull().default(0),
    totalPurchases: integer('total_purchases').notNull().default(0),
    disputesLost: integer('disputes_lost').notNull().default(0),
    disputesWon: integer('disputes_won').notNull().default(0),
    riskLevel: userRiskLevelEnum('risk_level').notNull().default('clean'),
    isBanned: boolean('is_banned').notNull().default(false),
    banReason: text('ban_reason'),
    payoutAddress: text('payout_address'),   // dirección de cobro (Nexo, BingX, etc.) — vendedor
    refundAddress: text('refund_address'),   // dirección de reembolso — comprador
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('users_email_idx').on(t.email),
    uniqueIndex('users_wallet_address_idx').on(t.walletAddress),
    uniqueIndex('users_username_idx').on(t.username),
  ]
)

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sellerId: uuid('seller_id').notNull().references(() => users.id),
    title: text('title').notNull(),
    description: text('description').notNull(),
    priceUsdt: numeric('price_usdt', { precision: 18, scale: 6 }).notNull(),
    category: productCategoryEnum('category').notNull(),
    condition: productConditionEnum('condition').notNull(),
    imagesIpfs: text('images_ipfs').array().notNull().default([]),
    stock: integer('stock').notNull().default(1),
    isActive: boolean('is_active').notNull().default(true),
    viewsCount: integer('views_count').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('products_seller_id_idx').on(t.sellerId),
    index('products_category_idx').on(t.category),
    index('products_is_active_idx').on(t.isActive),
  ]
)

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey(),
    productId: uuid('product_id').notNull().references(() => products.id),
    buyerId: uuid('buyer_id').notNull().references(() => users.id),
    sellerId: uuid('seller_id').notNull().references(() => users.id),
    amountUsdt: numeric('amount_usdt', { precision: 18, scale: 6 }).notNull(),
    contractOrderId: text('contract_order_id').notNull(),
    txHashCreate: text('tx_hash_create'),
    txHashComplete: text('tx_hash_complete'),
    status: orderStatusEnum('status').notNull().default('pending_payment'),
    trackingNumber: text('tracking_number'),
    trackingCarrier: trackingCarrierEnum('tracking_carrier'),
    shippingAddress: jsonb('shipping_address'),
    timeoutAt: timestamp('timeout_at').notNull(),
    shippingDeadlineAt: timestamp('shipping_deadline_at'),
    returnDeadlineAt: timestamp('return_deadline_at'),
    returnTrackingNumber: text('return_tracking_number'),
    returnCarrier: returnCarrierEnum('return_carrier'),
    klerosCaseId: integer('kleros_case_id'),
    // Modelo híbrido: direcciones de depósito y destino (pueden ser exchanges)
    depositAddress:      text('deposit_address'),       // dirección temporal generada por Shopix
    depositEncryptedKey: text('deposit_encrypted_key'), // clave privada encriptada de la dirección de depósito
    sellerPayoutAddress: text('seller_payout_address'), // Nexo/BingX del vendedor
    buyerRefundAddress:  text('buyer_refund_address'),  // Nexo/BingX del comprador
    buyerEmail:          text('buyer_email'),           // para notificaciones sin wallet
    confirmationToken:   text('confirmation_token'),    // token para confirmar recepción por link
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('orders_buyer_id_idx').on(t.buyerId),
    index('orders_seller_id_idx').on(t.sellerId),
    index('orders_status_idx').on(t.status),
    index('orders_timeout_idx').on(t.timeoutAt),
    uniqueIndex('orders_contract_order_id_idx').on(t.contractOrderId),
  ]
)

export const orderEvents = pgTable(
  'order_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id').notNull().references(() => orders.id),
    eventType: orderEventTypeEnum('event_type').notNull(),
    actorAddress: text('actor_address').notNull(),
    metadata: jsonb('metadata'),
    txHash: text('tx_hash'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('order_events_order_id_idx').on(t.orderId),
    index('order_events_event_type_idx').on(t.eventType),
  ]
)

export const orderMessages = pgTable(
  'order_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id').notNull().references(() => orders.id),
    senderId: uuid('sender_id').notNull().references(() => users.id),
    messageType: orderMessageTypeEnum('message_type').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('order_messages_order_id_idx').on(t.orderId),
    index('order_messages_sender_id_idx').on(t.senderId),
  ]
)

export const disputes = pgTable(
  'disputes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id').notNull().references(() => orders.id),
    klerosDisputeId: integer('kleros_dispute_id'),
    openedBy: uuid('opened_by').notNull().references(() => users.id),
    buyerEvidenceIpfs: text('buyer_evidence_ipfs').array(),
    sellerEvidenceIpfs: text('seller_evidence_ipfs').array(),
    ruling: integer('ruling'),
    status: disputeStatusEnum('status').notNull().default('pending'),
    resolvedAt: timestamp('resolved_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('disputes_order_id_idx').on(t.orderId),
    uniqueIndex('disputes_kleros_dispute_id_idx').on(t.klerosDisputeId),
  ]
)

export const userAddresses = pgTable(
  'user_addresses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id),
    label: text('label').notNull(), // "Casa", "Trabajo", etc.
    name: text('name').notNull(),
    street: text('street').notNull(),
    city: text('city').notNull(),
    province: text('province').notNull(),
    zip: text('zip').notNull(),
    phone: text('phone'),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('user_addresses_user_id_idx').on(t.userId),
  ]
)

export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id').notNull().references(() => orders.id),
    reviewerId: uuid('reviewer_id').notNull().references(() => users.id),
    reviewedId: uuid('reviewed_id').notNull().references(() => users.id),
    rating: integer('rating').notNull(),
    comment: text('comment'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('reviews_order_id_idx').on(t.orderId),
    index('reviews_reviewed_id_idx').on(t.reviewedId),
  ]
)

// ─── Relations ──────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  products: many(products),
  buyerOrders: many(orders, { relationName: 'buyer' }),
  sellerOrders: many(orders, { relationName: 'seller' }),
  reviewsGiven: many(reviews, { relationName: 'reviewer' }),
  reviewsReceived: many(reviews, { relationName: 'reviewed' }),
  addresses: many(userAddresses),
}))

export const userAddressesRelations = relations(userAddresses, ({ one }) => ({
  user: one(users, { fields: [userAddresses.userId], references: [users.id] }),
}))

export const productsRelations = relations(products, ({ one, many }) => ({
  seller: one(users, { fields: [products.sellerId], references: [users.id] }),
  orders: many(orders),
}))

export const ordersRelations = relations(orders, ({ one, many }) => ({
  product: one(products, { fields: [orders.productId], references: [products.id] }),
  buyer: one(users, { fields: [orders.buyerId], references: [users.id], relationName: 'buyer' }),
  seller: one(users, { fields: [orders.sellerId], references: [users.id], relationName: 'seller' }),
  events: many(orderEvents),
  messages: many(orderMessages),
  dispute: one(disputes, { fields: [orders.id], references: [disputes.orderId] }),
  review: one(reviews, { fields: [orders.id], references: [reviews.orderId] }),
}))

export const orderEventsRelations = relations(orderEvents, ({ one }) => ({
  order: one(orders, { fields: [orderEvents.orderId], references: [orders.id] }),
}))

export const orderMessagesRelations = relations(orderMessages, ({ one }) => ({
  order: one(orders, { fields: [orderMessages.orderId], references: [orders.id] }),
  sender: one(users, { fields: [orderMessages.senderId], references: [users.id] }),
}))

export const disputesRelations = relations(disputes, ({ one }) => ({
  order: one(orders, { fields: [disputes.orderId], references: [orders.id] }),
  openedByUser: one(users, { fields: [disputes.openedBy], references: [users.id] }),
}))

// ─── Types ──────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Product = typeof products.$inferSelect
export type NewProduct = typeof products.$inferInsert
export type Order = typeof orders.$inferSelect
export type NewOrder = typeof orders.$inferInsert
export type OrderEvent = typeof orderEvents.$inferSelect
export type NewOrderEvent = typeof orderEvents.$inferInsert
export type Dispute = typeof disputes.$inferSelect
export type NewDispute = typeof disputes.$inferInsert
export type Review = typeof reviews.$inferSelect
export type NewReview = typeof reviews.$inferInsert
export type OrderMessage = typeof orderMessages.$inferSelect
export type NewOrderMessage = typeof orderMessages.$inferInsert
export type UserAddress = typeof userAddresses.$inferSelect
export type NewUserAddress = typeof userAddresses.$inferInsert
