import { db } from './client'
import { users, products, orders, orderEvents, reviews } from './schema'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { randomUUID } from 'crypto'

dotenv.config({ path: path.resolve(__dirname, '../../../.env') })

const WALLETS = [
  '0x1234567890abcdef1234567890abcdef12345678',
  '0x2345678901bcdef12345678901bcdef123456789',
  '0x3456789012cdef123456789012cdef1234567890',
  '0x4567890123def1234567890123def12345678901',
  '0x5678901234ef12345678901234ef123456789012',
  '0x6789012345f123456789012345f1234567890123',
  '0x789012345601234567890123456012345678901a',
  '0x890123456712345678901234560123456789012b',
  '0x90123456782345678901234560123456789012ab',
  '0xa0123456893456789012345601234567890123bc',
]

async function main() {
  console.log('Seeding database...')

  await db.delete(reviews)
  await db.delete(orderEvents)
  await db.delete(orders)
  await db.delete(products)
  await db.delete(users)

  // ─── 10 Users ────────────────────────────────────────────────
  const userRecords = await db.insert(users).values(
    WALLETS.map((wallet, i) => ({
      id: randomUUID(),
      walletAddress: wallet,
      username: `usuario${i + 1}`,
      reputationScore: Math.floor(Math.random() * 100),
      totalSales: Math.floor(Math.random() * 20),
      totalPurchases: Math.floor(Math.random() * 15),
    }))
  ).returning()

  console.log(`Created ${userRecords.length} users`)

  // ─── 30 Products ─────────────────────────────────────────────
  const categories = ['electronics', 'clothing', 'home', 'services', 'other'] as const
  const conditions = ['new', 'used', 'refurbished'] as const

  const productData = [
    { title: 'iPhone 14 Pro 256GB', desc: 'En excelente estado, 6 meses de uso. Incluye cargador original.', price: '850', cat: 'electronics', cond: 'used' },
    { title: 'MacBook Air M2', desc: 'Sin uso, sellado de fábrica. Garantía de 1 año.', price: '1200', cat: 'electronics', cond: 'new' },
    { title: 'Samsung Galaxy S23', desc: 'Usado 3 meses, pantalla perfecta. Con caja original.', price: '650', cat: 'electronics', cond: 'used' },
    { title: 'Sony WH-1000XM5', desc: 'Auriculares noise cancelling. Nuevo, sin uso.', price: '320', cat: 'electronics', cond: 'new' },
    { title: 'iPad Air 5ta gen', desc: 'Con Apple Pencil 2da gen incluido. Perfecto estado.', price: '700', cat: 'electronics', cond: 'used' },
    { title: 'Nike Air Max 270', desc: 'Talle 42. Usadas 2 veces. Como nuevas.', price: '120', cat: 'clothing', cond: 'used' },
    { title: 'Campera The North Face', desc: 'Talle L. Nueva con etiqueta. Impermeable.', price: '280', cat: 'clothing', cond: 'new' },
    { title: 'Remeras Lacoste x5', desc: 'Pack 5 remeras talle M. Sin uso.', price: '150', cat: 'clothing', cond: 'new' },
    { title: 'Zapatillas Adidas Ultraboost', desc: 'Talle 41. Refabricadas certificadas.', price: '180', cat: 'clothing', cond: 'refurbished' },
    { title: 'Reloj Casio G-Shock', desc: 'Modelo DW-5600. Usado, funciona perfecto.', price: '95', cat: 'clothing', cond: 'used' },
    { title: 'Cafetera Nespresso Vertuo', desc: 'Nueva en caja. Incluye 40 cápsulas.', price: '210', cat: 'home', cond: 'new' },
    { title: 'Robot Aspiradora Roomba 694', desc: 'Revisada y certificada. Con 6 meses garantía.', price: '280', cat: 'home', cond: 'refurbished' },
    { title: 'Silla Gamer Secretlab Titan', desc: 'En perfecto estado. Espuma sin deformaciones.', price: '450', cat: 'home', cond: 'used' },
    { title: 'Monitor LG 27" 4K', desc: 'Sin pixeles muertos. Con soporte VESA.', price: '380', cat: 'home', cond: 'used' },
    { title: 'Teclado Mecánico Keychron K2', desc: 'Switch Red. Nuevo.', price: '130', cat: 'electronics', cond: 'new' },
    { title: 'Diseño Web - Landing Page', desc: 'Diseño y desarrollo de landing page responsive. Entrega en 5 días.', price: '300', cat: 'services', cond: 'new' },
    { title: 'Consultoría DeFi / Cripto', desc: '1 hora de consultoría personalizada sobre inversiones en DeFi y cripto.', price: '80', cat: 'services', cond: 'new' },
    { title: 'Desarrollo Smart Contract', desc: 'Auditoría y desarrollo de contratos Solidity. Por hora.', price: '150', cat: 'services', cond: 'new' },
    { title: 'Community Manager Web3', desc: 'Gestión de redes sociales para proyectos crypto. 1 mes.', price: '400', cat: 'services', cond: 'new' },
    { title: 'Traducción ES/EN Cripto', desc: 'Traducción de whitepaper o documentos técnicos. Por página.', price: '25', cat: 'services', cond: 'new' },
    { title: 'RTX 4070 Ti Super', desc: 'Placa de video. Usada para gaming, nunca para minería.', price: '680', cat: 'electronics', cond: 'used' },
    { title: 'Nintendo Switch OLED', desc: 'Con 10 juegos digitales incluidos. Perfecto estado.', price: '380', cat: 'electronics', cond: 'used' },
    { title: 'PS5 Digital Edition', desc: 'Sin uso, comprada hace 2 meses. Con 3 juegos físicos.', price: '520', cat: 'electronics', cond: 'used' },
    { title: 'DJI Mini 3 Pro', desc: 'Dron con cámara 4K. 2 vuelos. Incluye extra batteries.', price: '680', cat: 'electronics', cond: 'used' },
    { title: 'Kindle Paperwhite 11va', desc: 'Con estuche incluido. 300 libros ya cargados.', price: '110', cat: 'electronics', cond: 'used' },
    { title: 'Alfombra Persa 2x3m', desc: 'Original iraní. Excelente estado. Años 90.', price: '850', cat: 'home', cond: 'used' },
    { title: 'Mesa de trabajo IKEA BEKANT', desc: 'Con regulación de altura eléctrica. Sin rayaduras.', price: '290', cat: 'home', cond: 'used' },
    { title: 'Proyector Epson EpiqVision', desc: 'Full HD, 2800 lúmenes. Poco uso.', price: '480', cat: 'home', cond: 'used' },
    { title: 'Cámara Sony A7 III', desc: 'Body only. 15k disparos. Con batería extra.', price: '1600', cat: 'electronics', cond: 'used' },
    { title: 'Lente Canon 50mm f/1.4', desc: 'Para Canon EF. Mínimo uso. Vidrios perfectos.', price: '280', cat: 'electronics', cond: 'used' },
  ]

  const productRecords = await db.insert(products).values(
    productData.map((p, i) => ({
      id: randomUUID(),
      sellerId: userRecords[i % userRecords.length].id,
      title: p.title,
      description: p.desc,
      priceUsdt: p.price,
      category: p.cat as typeof categories[number],
      condition: p.cond as typeof conditions[number],
      imagesIpfs: [`Qm${randomUUID().replace(/-/g, '').slice(0, 44)}`],
      stock: Math.floor(Math.random() * 3) + 1,
      isActive: true,
      viewsCount: Math.floor(Math.random() * 200),
    }))
  ).returning()

  console.log(`Created ${productRecords.length} products`)

  // ─── 5 Orders in different states ────────────────────────────
  const now = new Date()
  const ordersData = [
    {
      id: randomUUID(),
      status: 'active' as const,
      productIdx: 0,
      buyerIdx: 3,
      sellerIdx: 0,
      daysAgo: 2,
    },
    {
      id: randomUUID(),
      status: 'completed' as const,
      productIdx: 1,
      buyerIdx: 4,
      sellerIdx: 1,
      daysAgo: 10,
    },
    {
      id: randomUUID(),
      status: 'disputed' as const,
      productIdx: 2,
      buyerIdx: 5,
      sellerIdx: 2,
      daysAgo: 5,
    },
    {
      id: randomUUID(),
      status: 'pending_payment' as const,
      productIdx: 3,
      buyerIdx: 6,
      sellerIdx: 3,
      daysAgo: 0,
    },
    {
      id: randomUUID(),
      status: 'refunded' as const,
      productIdx: 4,
      buyerIdx: 7,
      sellerIdx: 4,
      daysAgo: 15,
    },
  ]

  const orderRecords = await db.insert(orders).values(
    ordersData.map((o) => {
      const product = productRecords[o.productIdx]
      const createdAt = new Date(now.getTime() - o.daysAgo * 24 * 60 * 60 * 1000)
      return {
        id: o.id,
        productId: product.id,
        buyerId: userRecords[o.buyerIdx].id,
        sellerId: userRecords[o.sellerIdx].id,
        amountUsdt: product.priceUsdt,
        contractOrderId: `0x${randomUUID().replace(/-/g, '').padEnd(64, '0').slice(0, 64)}`,
        status: o.status,
        shippingAddress: {
          name: 'Juan Pérez',
          street: 'Av. Corrientes 1234',
          city: 'Buenos Aires',
          province: 'CABA',
          zip: 'C1043AAZ',
          phone: '+5491112345678',
        },
        timeoutAt: new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000),
        createdAt,
        updatedAt: createdAt,
      }
    })
  ).returning()

  console.log(`Created ${orderRecords.length} orders`)

  // ─── Order events ─────────────────────────────────────────────
  const eventValues = orderRecords.flatMap((order) => [
    {
      orderId: order.id,
      eventType: 'created' as const,
      actorAddress: WALLETS[3],
      metadata: { amount: order.amountUsdt },
    },
    ...(order.status !== 'pending_payment' ? [{
      orderId: order.id,
      eventType: 'payment_confirmed' as const,
      actorAddress: WALLETS[3],
      metadata: { txHash: `0x${randomUUID().replace(/-/g, '')}` },
    }] : []),
  ])

  await db.insert(orderEvents).values(eventValues)
  console.log(`Created ${eventValues.length} order events`)

  // ─── Review for completed order ───────────────────────────────
  const completedOrder = orderRecords.find(o => o.status === 'completed')
  if (completedOrder) {
    await db.insert(reviews).values({
      orderId: completedOrder.id,
      reviewerId: completedOrder.buyerId,
      reviewedId: completedOrder.sellerId,
      rating: 5,
      comment: 'Excelente vendedor, producto llegó en tiempo y forma. 100% recomendable.',
    })
    console.log('Created 1 review')
  }

  console.log('\nSeed complete!')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
