"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.disputesRelations = exports.orderMessagesRelations = exports.orderEventsRelations = exports.ordersRelations = exports.productsRelations = exports.userAddressesRelations = exports.usersRelations = exports.reviews = exports.userAddresses = exports.disputes = exports.orderMessages = exports.orderEvents = exports.orders = exports.products = exports.users = exports.disputeStatusEnum = exports.orderMessageTypeEnum = exports.orderEventTypeEnum = exports.trackingCarrierEnum = exports.returnCarrierEnum = exports.orderStatusEnum = exports.userRiskLevelEnum = exports.productConditionEnum = exports.productCategoryEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
// ─── Enums ──────────────────────────────────────────────────────────
exports.productCategoryEnum = (0, pg_core_1.pgEnum)('product_category', [
    'electronics',
    'clothing',
    'home',
    'services',
    'other',
]);
exports.productConditionEnum = (0, pg_core_1.pgEnum)('product_condition', [
    'new',
    'used',
    'refurbished',
]);
exports.userRiskLevelEnum = (0, pg_core_1.pgEnum)('user_risk_level', [
    'clean',
    'warning',
    'risky',
    'banned',
]);
exports.orderStatusEnum = (0, pg_core_1.pgEnum)('order_status', [
    'pending_payment',
    'active',
    'completed',
    'disputed',
    'return_required', // Comprador ganó disputa, debe devolver el producto
    'return_in_transit', // Comprador cargó tracking de devolución
    'refunded', // Disputa resuelta, fondos devueltos
    'refunded_no_return', // Comprador no devolvió en plazo → reputación afectada
]);
exports.returnCarrierEnum = (0, pg_core_1.pgEnum)('return_carrier', [
    'andreani',
    'oca',
    'correo_argentino',
    'pickup',
]);
exports.trackingCarrierEnum = (0, pg_core_1.pgEnum)('tracking_carrier', [
    'andreani',
    'oca',
    'correo_argentino',
    'pickup',
]);
exports.orderEventTypeEnum = (0, pg_core_1.pgEnum)('order_event_type', [
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
]);
exports.orderMessageTypeEnum = (0, pg_core_1.pgEnum)('order_message_type', [
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
]);
exports.disputeStatusEnum = (0, pg_core_1.pgEnum)('dispute_status', [
    'pending',
    'evidence',
    'commit',
    'vote',
    'appeal',
    'resolved',
]);
// ─── Tables ─────────────────────────────────────────────────────────
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    walletAddress: (0, pg_core_1.text)('wallet_address').notNull(),
    username: (0, pg_core_1.text)('username'),
    avatarIpfs: (0, pg_core_1.text)('avatar_ipfs'),
    reputationScore: (0, pg_core_1.integer)('reputation_score').notNull().default(0),
    totalSales: (0, pg_core_1.integer)('total_sales').notNull().default(0),
    totalPurchases: (0, pg_core_1.integer)('total_purchases').notNull().default(0),
    disputesLost: (0, pg_core_1.integer)('disputes_lost').notNull().default(0),
    disputesWon: (0, pg_core_1.integer)('disputes_won').notNull().default(0),
    riskLevel: (0, exports.userRiskLevelEnum)('risk_level').notNull().default('clean'),
    isBanned: (0, pg_core_1.boolean)('is_banned').notNull().default(false),
    banReason: (0, pg_core_1.text)('ban_reason'),
    createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').notNull().defaultNow(),
}, (t) => [
    (0, pg_core_1.uniqueIndex)('users_wallet_address_idx').on(t.walletAddress),
    (0, pg_core_1.uniqueIndex)('users_username_idx').on(t.username),
]);
exports.products = (0, pg_core_1.pgTable)('products', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    sellerId: (0, pg_core_1.uuid)('seller_id').notNull().references(() => exports.users.id),
    title: (0, pg_core_1.text)('title').notNull(),
    description: (0, pg_core_1.text)('description').notNull(),
    priceUsdt: (0, pg_core_1.numeric)('price_usdt', { precision: 18, scale: 6 }).notNull(),
    category: (0, exports.productCategoryEnum)('category').notNull(),
    condition: (0, exports.productConditionEnum)('condition').notNull(),
    imagesIpfs: (0, pg_core_1.text)('images_ipfs').array().notNull().default([]),
    stock: (0, pg_core_1.integer)('stock').notNull().default(1),
    isActive: (0, pg_core_1.boolean)('is_active').notNull().default(true),
    viewsCount: (0, pg_core_1.integer)('views_count').notNull().default(0),
    createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').notNull().defaultNow(),
}, (t) => [
    (0, pg_core_1.index)('products_seller_id_idx').on(t.sellerId),
    (0, pg_core_1.index)('products_category_idx').on(t.category),
    (0, pg_core_1.index)('products_is_active_idx').on(t.isActive),
]);
exports.orders = (0, pg_core_1.pgTable)('orders', {
    id: (0, pg_core_1.uuid)('id').primaryKey(),
    productId: (0, pg_core_1.uuid)('product_id').notNull().references(() => exports.products.id),
    buyerId: (0, pg_core_1.uuid)('buyer_id').notNull().references(() => exports.users.id),
    sellerId: (0, pg_core_1.uuid)('seller_id').notNull().references(() => exports.users.id),
    amountUsdt: (0, pg_core_1.numeric)('amount_usdt', { precision: 18, scale: 6 }).notNull(),
    contractOrderId: (0, pg_core_1.text)('contract_order_id').notNull(),
    txHashCreate: (0, pg_core_1.text)('tx_hash_create'),
    txHashComplete: (0, pg_core_1.text)('tx_hash_complete'),
    status: (0, exports.orderStatusEnum)('status').notNull().default('pending_payment'),
    trackingNumber: (0, pg_core_1.text)('tracking_number'),
    trackingCarrier: (0, exports.trackingCarrierEnum)('tracking_carrier'),
    shippingAddress: (0, pg_core_1.jsonb)('shipping_address'),
    timeoutAt: (0, pg_core_1.timestamp)('timeout_at').notNull(),
    shippingDeadlineAt: (0, pg_core_1.timestamp)('shipping_deadline_at'),
    returnDeadlineAt: (0, pg_core_1.timestamp)('return_deadline_at'),
    returnTrackingNumber: (0, pg_core_1.text)('return_tracking_number'),
    returnCarrier: (0, exports.returnCarrierEnum)('return_carrier'),
    klerosCaseId: (0, pg_core_1.integer)('kleros_case_id'),
    createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').notNull().defaultNow(),
}, (t) => [
    (0, pg_core_1.index)('orders_buyer_id_idx').on(t.buyerId),
    (0, pg_core_1.index)('orders_seller_id_idx').on(t.sellerId),
    (0, pg_core_1.index)('orders_status_idx').on(t.status),
    (0, pg_core_1.index)('orders_timeout_idx').on(t.timeoutAt),
    (0, pg_core_1.uniqueIndex)('orders_contract_order_id_idx').on(t.contractOrderId),
]);
exports.orderEvents = (0, pg_core_1.pgTable)('order_events', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    orderId: (0, pg_core_1.uuid)('order_id').notNull().references(() => exports.orders.id),
    eventType: (0, exports.orderEventTypeEnum)('event_type').notNull(),
    actorAddress: (0, pg_core_1.text)('actor_address').notNull(),
    metadata: (0, pg_core_1.jsonb)('metadata'),
    txHash: (0, pg_core_1.text)('tx_hash'),
    createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
}, (t) => [
    (0, pg_core_1.index)('order_events_order_id_idx').on(t.orderId),
    (0, pg_core_1.index)('order_events_event_type_idx').on(t.eventType),
]);
exports.orderMessages = (0, pg_core_1.pgTable)('order_messages', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    orderId: (0, pg_core_1.uuid)('order_id').notNull().references(() => exports.orders.id),
    senderId: (0, pg_core_1.uuid)('sender_id').notNull().references(() => exports.users.id),
    messageType: (0, exports.orderMessageTypeEnum)('message_type').notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
}, (t) => [
    (0, pg_core_1.index)('order_messages_order_id_idx').on(t.orderId),
    (0, pg_core_1.index)('order_messages_sender_id_idx').on(t.senderId),
]);
exports.disputes = (0, pg_core_1.pgTable)('disputes', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    orderId: (0, pg_core_1.uuid)('order_id').notNull().references(() => exports.orders.id),
    klerosDisputeId: (0, pg_core_1.integer)('kleros_dispute_id'),
    openedBy: (0, pg_core_1.uuid)('opened_by').notNull().references(() => exports.users.id),
    buyerEvidenceIpfs: (0, pg_core_1.text)('buyer_evidence_ipfs').array(),
    sellerEvidenceIpfs: (0, pg_core_1.text)('seller_evidence_ipfs').array(),
    ruling: (0, pg_core_1.integer)('ruling'),
    status: (0, exports.disputeStatusEnum)('status').notNull().default('pending'),
    resolvedAt: (0, pg_core_1.timestamp)('resolved_at'),
    createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').notNull().defaultNow(),
}, (t) => [
    (0, pg_core_1.uniqueIndex)('disputes_order_id_idx').on(t.orderId),
    (0, pg_core_1.uniqueIndex)('disputes_kleros_dispute_id_idx').on(t.klerosDisputeId),
]);
exports.userAddresses = (0, pg_core_1.pgTable)('user_addresses', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)('user_id').notNull().references(() => exports.users.id),
    label: (0, pg_core_1.text)('label').notNull(), // "Casa", "Trabajo", etc.
    name: (0, pg_core_1.text)('name').notNull(),
    street: (0, pg_core_1.text)('street').notNull(),
    city: (0, pg_core_1.text)('city').notNull(),
    province: (0, pg_core_1.text)('province').notNull(),
    zip: (0, pg_core_1.text)('zip').notNull(),
    phone: (0, pg_core_1.text)('phone'),
    isDefault: (0, pg_core_1.boolean)('is_default').notNull().default(false),
    createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').notNull().defaultNow(),
}, (t) => [
    (0, pg_core_1.index)('user_addresses_user_id_idx').on(t.userId),
]);
exports.reviews = (0, pg_core_1.pgTable)('reviews', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    orderId: (0, pg_core_1.uuid)('order_id').notNull().references(() => exports.orders.id),
    reviewerId: (0, pg_core_1.uuid)('reviewer_id').notNull().references(() => exports.users.id),
    reviewedId: (0, pg_core_1.uuid)('reviewed_id').notNull().references(() => exports.users.id),
    rating: (0, pg_core_1.integer)('rating').notNull(),
    comment: (0, pg_core_1.text)('comment'),
    createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
}, (t) => [
    (0, pg_core_1.uniqueIndex)('reviews_order_id_idx').on(t.orderId),
    (0, pg_core_1.index)('reviews_reviewed_id_idx').on(t.reviewedId),
]);
// ─── Relations ──────────────────────────────────────────────────────
exports.usersRelations = (0, drizzle_orm_1.relations)(exports.users, ({ many }) => ({
    products: many(exports.products),
    buyerOrders: many(exports.orders, { relationName: 'buyer' }),
    sellerOrders: many(exports.orders, { relationName: 'seller' }),
    reviewsGiven: many(exports.reviews, { relationName: 'reviewer' }),
    reviewsReceived: many(exports.reviews, { relationName: 'reviewed' }),
    addresses: many(exports.userAddresses),
}));
exports.userAddressesRelations = (0, drizzle_orm_1.relations)(exports.userAddresses, ({ one }) => ({
    user: one(exports.users, { fields: [exports.userAddresses.userId], references: [exports.users.id] }),
}));
exports.productsRelations = (0, drizzle_orm_1.relations)(exports.products, ({ one, many }) => ({
    seller: one(exports.users, { fields: [exports.products.sellerId], references: [exports.users.id] }),
    orders: many(exports.orders),
}));
exports.ordersRelations = (0, drizzle_orm_1.relations)(exports.orders, ({ one, many }) => ({
    product: one(exports.products, { fields: [exports.orders.productId], references: [exports.products.id] }),
    buyer: one(exports.users, { fields: [exports.orders.buyerId], references: [exports.users.id], relationName: 'buyer' }),
    seller: one(exports.users, { fields: [exports.orders.sellerId], references: [exports.users.id], relationName: 'seller' }),
    events: many(exports.orderEvents),
    messages: many(exports.orderMessages),
    dispute: one(exports.disputes, { fields: [exports.orders.id], references: [exports.disputes.orderId] }),
    review: one(exports.reviews, { fields: [exports.orders.id], references: [exports.reviews.orderId] }),
}));
exports.orderEventsRelations = (0, drizzle_orm_1.relations)(exports.orderEvents, ({ one }) => ({
    order: one(exports.orders, { fields: [exports.orderEvents.orderId], references: [exports.orders.id] }),
}));
exports.orderMessagesRelations = (0, drizzle_orm_1.relations)(exports.orderMessages, ({ one }) => ({
    order: one(exports.orders, { fields: [exports.orderMessages.orderId], references: [exports.orders.id] }),
    sender: one(exports.users, { fields: [exports.orderMessages.senderId], references: [exports.users.id] }),
}));
exports.disputesRelations = (0, drizzle_orm_1.relations)(exports.disputes, ({ one }) => ({
    order: one(exports.orders, { fields: [exports.disputes.orderId], references: [exports.orders.id] }),
    openedByUser: one(exports.users, { fields: [exports.disputes.openedBy], references: [exports.users.id] }),
}));
