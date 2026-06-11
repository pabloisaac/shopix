import { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { parseAbi } from 'viem'
import { db } from '../lib/db'
import { orders, disputes, orderEvents, users } from '@shopix/db'
import { uploadEvidence, uploadMetaEvidence } from '../services/ipfs.service'
import { publicClient, getAdminWalletClient } from '../lib/viem'
import { recordDisputeLost, recordDisputeWon } from '../services/reputation.service'
import type { EvidencePackage, MetaEvidence } from '@shopix/shared'

const MOCK_KLEROS_ABI = parseAbi([
  'function giveRuling(uint256 disputeId, uint256 ruling) external',
])
const ESCROW_DEV_ABI = parseAbi([
  'function devForceRuling(bytes32 orderId, uint256 ruling) external',
])

// Leídos en runtime para evitar problemas de orden con dotenv
function getMockKlerosAddress() {
  return (process.env.MOCK_KLEROS_ADDRESS || '0x0') as `0x${string}`
}
function getEscrowAddress() {
  return (process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x0') as `0x${string}`
}

export async function disputeRoutes(app: FastifyInstance) {
  // POST /disputes/:orderId — abrir disputa
  app.post('/:orderId', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { orderId } = request.params as { orderId: string }
    const { userId } = request.user

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: { product: true },
    })
    if (!order) return reply.status(404).send({ error: 'Orden no encontrada' })
    if (order.buyerId !== userId) return reply.status(403).send({ error: 'Solo el comprador puede abrir disputa' })
    if (order.status !== 'active') return reply.status(400).send({ error: 'La orden debe estar activa' })

    // Verificar que no haya disputa existente
    const existing = await db.query.disputes.findFirst({
      where: eq(disputes.orderId, orderId),
    })
    if (existing) return reply.status(400).send({ error: 'Ya existe una disputa para esta orden' })

    // Construir MetaEvidence para Kleros (ERC-1497)
    const metaEvidence: MetaEvidence = {
      title: `Disputa: ${order.product.title}`,
      description: `Orden ${order.contractOrderId}. Monto: ${order.amountUsdt} USDT.`,
      question: '¿Debe el comprador recibir el reembolso?',
      rulingOptions: {
        type: 'single-select',
        titles: ['Reembolsar al comprador', 'Pagar al vendedor'],
        descriptions: [
          'El comprador no recibió el producto o recibió algo diferente a lo acordado.',
          'El vendedor cumplió con el envío según lo pactado.',
        ],
      },
    }

    // Si no hay credenciales de Pinata (entorno local), usar CID placeholder
    let metaEvidenceCid: string
    try {
      metaEvidenceCid = await uploadMetaEvidence(metaEvidence)
    } catch {
      metaEvidenceCid = 'QmLocalPlaceholderMetaEvidence000000000000000000'
    }

    const [dispute] = await db.insert(disputes).values({
      orderId,
      openedBy: userId,
      status: 'pending',
    }).returning()

    await db.update(orders)
      .set({ status: 'disputed', updatedAt: new Date() })
      .where(eq(orders.id, orderId))

    await db.insert(orderEvents).values({
      orderId,
      eventType: 'dispute_opened',
      actorAddress: (await db.query.users.findFirst({ where: eq(users.id, userId) }))?.walletAddress || '',
      metadata: { metaEvidenceCid },
    })

    return reply.status(201).send({
      dispute,
      metaEvidenceCid,
      // El frontend usará este CID como metaEvidenceHash al llamar abrirDisputa() en el contrato
      contractCallData: {
        metaEvidenceHash: `0x${Buffer.from(metaEvidenceCid).toString('hex').padEnd(64, '0').slice(0, 64)}`,
      },
    })
  })

  // POST /disputes/:orderId/evidence — subir evidencia
  app.post('/:orderId/evidence', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { orderId } = request.params as { orderId: string }
    const { userId } = request.user

    const schema = z.object({
      title: z.string().min(5).max(100),
      description: z.string().min(10).max(2000),
      fileIpfsCid: z.string().optional(),
      fileType: z.string().optional(),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.issues })
    }

    const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) })
    if (!order) return reply.status(404).send({ error: 'Orden no encontrada' })
    if (order.buyerId !== userId && order.sellerId !== userId) {
      return reply.status(403).send({ error: 'Solo las partes pueden subir evidencia' })
    }
    if (order.status !== 'disputed') {
      return reply.status(400).send({ error: 'La orden no está en disputa' })
    }

    const dispute = await db.query.disputes.findFirst({
      where: eq(disputes.orderId, orderId),
    })
    if (!dispute) return reply.status(404).send({ error: 'Disputa no encontrada' })

    const evidencePackage: EvidencePackage = {
      title: parsed.data.title,
      description: parsed.data.description,
      type: 'Evidence',
      ...(parsed.data.fileIpfsCid && {
        fileURI: `ipfs://${parsed.data.fileIpfsCid}`,
        fileTypeExtension: parsed.data.fileType || 'jpg',
      }),
    }

    let evidenceCid: string
    try {
      evidenceCid = await uploadEvidence(evidencePackage)
    } catch {
      evidenceCid = `QmLocalEvidence${Date.now()}`
    }

    const isBuyer = order.buyerId === userId
    if (isBuyer) {
      await db.update(disputes)
        .set({
          buyerEvidenceIpfs: [...(dispute.buyerEvidenceIpfs || []), evidenceCid],
          updatedAt: new Date(),
        })
        .where(eq(disputes.id, dispute.id))
    } else {
      await db.update(disputes)
        .set({
          sellerEvidenceIpfs: [...(dispute.sellerEvidenceIpfs || []), evidenceCid],
          updatedAt: new Date(),
        })
        .where(eq(disputes.id, dispute.id))
    }

    await db.insert(orderEvents).values({
      orderId,
      eventType: 'evidence_uploaded',
      actorAddress: (await db.query.users.findFirst({ where: eq(users.id, userId) }))?.walletAddress || '',
      metadata: { evidenceCid, role: isBuyer ? 'buyer' : 'seller' },
    })

    return reply.send({
      evidenceCid,
      ipfsUri: `ipfs://${evidenceCid}`,
    })
  })

  // POST /disputes/:orderId/upload — subir archivo de evidencia
  app.post('/:orderId/upload', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { orderId } = request.params as { orderId: string }
    const { userId } = request.user

    const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) })
    if (!order) return reply.status(404).send({ error: 'Orden no encontrada' })
    if (order.buyerId !== userId && order.sellerId !== userId) {
      return reply.status(403).send({ error: 'Sin permisos' })
    }

    try {
      const data = await request.file()
      if (!data) return reply.status(400).send({ error: 'No se recibió archivo' })

      const buffer = await data.toBuffer()
      if (buffer.length > 10 * 1024 * 1024) {
        return reply.status(400).send({ error: 'Archivo demasiado grande (máx 10MB)' })
      }

      let cid: string
      try {
        cid = await uploadImage(buffer, data.filename)
      } catch {
        // Sin Pinata en local: usar hash del buffer como CID placeholder
        cid = `QmLocal${Buffer.from(buffer).subarray(0, 8).toString('hex')}${Date.now()}`
      }

      return reply.send({ cid, filename: data.filename })
    } catch (err: any) {
      return reply.status(500).send({ error: err.message })
    }
  })

  // POST /disputes/:orderId/dev/advance — simular avance de estados Kleros (solo DEV)
  app.post('/:orderId/dev/advance', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    if (process.env.NODE_ENV === 'production') {
      return reply.status(404).send({ error: 'Not found' })
    }

    const { orderId } = request.params as { orderId: string }
    const schema = z.object({
      ruling: z.number().int().min(0).max(2).optional(), // 0=refused, 1=refund buyer, 2=pay seller
    })
    const parsed = schema.safeParse(request.body)

    const dispute = await db.query.disputes.findFirst({ where: eq(disputes.orderId, orderId) })
    if (!dispute) return reply.status(404).send({ error: 'Disputa no encontrada' })

    const FLOW: Record<string, string> = {
      pending: 'evidence',
      evidence: 'commit',
      commit: 'vote',
      vote: 'appeal',
      appeal: 'resolved',
    }

    const next = FLOW[dispute.status]
    if (!next) return reply.status(400).send({ error: 'Disputa ya resuelta' })

    const updateData: any = { status: next, updatedAt: new Date() }

    if (next === 'resolved') {
      const ruling = parsed.success && parsed.data.ruling !== undefined ? parsed.data.ruling : 1
      updateData.ruling = ruling
      updateData.resolvedAt = new Date()

      const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) })
      if (order) {
        try {
          const walletClient = getAdminWalletClient()
          if (dispute.klerosDisputeId) {
            // Disputa abierta on-chain → usar giveRuling en MockKleros
            const hash = await walletClient.writeContract({
              address: getMockKlerosAddress(),
              abi: MOCK_KLEROS_ABI,
              functionName: 'giveRuling',
              args: [BigInt(dispute.klerosDisputeId), BigInt(ruling)],
            })
            await publicClient.waitForTransactionReceipt({ hash })
          } else {
            // Disputa simulada en DB (sin abrirDisputa on-chain) → devForceRuling directo en escrow
            const contractOrderId = order.contractOrderId as `0x${string}`
            const hash = await walletClient.writeContract({
              address: getEscrowAddress(),
              abi: ESCROW_DEV_ABI,
              functionName: 'devForceRuling',
              args: [contractOrderId, BigInt(ruling)],
            })
            await publicClient.waitForTransactionReceipt({ hash })
            console.log('[dev] devForceRuling ejecutado on-chain, tx:', hash)
          }
          updateData.ruling = ruling
        } catch (e: any) {
          console.warn('[dev] on-chain ruling falló, actualizando solo DB:', e.message)
        }
      }

      // Actualizar estado en DB + reputación
      const order2 = await db.query.orders.findFirst({ where: eq(orders.id, orderId) })
      if (order2) {
        if (ruling === 1) {
          // Comprador gana → inicia fase de devolución (5 días para devolver)
          const returnDeadlineAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
          await db.update(orders).set({
            status: 'return_required',
            returnDeadlineAt,
            updatedAt: new Date(),
          }).where(eq(orders.id, orderId))
          await db.insert(orderEvents).values({
            orderId,
            eventType: 'return_required',
            actorAddress: '0x0000000000000000000000000000000000000000',
            metadata: { ruling, returnDeadlineAt: returnDeadlineAt.toISOString() },
          })
          await recordDisputeLost(order2.sellerId)
          await recordDisputeWon(order2.buyerId)
        } else if (ruling === 2) {
          // Vendedor gana → fondos al vendedor, disputa cerrada
          await db.update(orders).set({ status: 'completed', updatedAt: new Date() }).where(eq(orders.id, orderId))
          await recordDisputeLost(order2.buyerId)
          await recordDisputeWon(order2.sellerId)
        }
      }
      await db.insert(orderEvents).values({
        orderId,
        eventType: 'ruling_issued',
        actorAddress: '0x0000000000000000000000000000000000000000',
        metadata: { ruling, source: 'dev_simulation' },
      })
    }

    await db.update(disputes).set(updateData).where(eq(disputes.orderId, orderId))
    const updated = await db.query.disputes.findFirst({ where: eq(disputes.orderId, orderId) })
    return reply.send({ ok: true, dispute: updated })
  })

  // GET /disputes/:orderId — estado de disputa
  app.get('/:orderId', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { orderId } = request.params as { orderId: string }
    const { userId } = request.user

    const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) })
    if (!order) return reply.status(404).send({ error: 'Orden no encontrada' })
    if (order.buyerId !== userId && order.sellerId !== userId) {
      return reply.status(403).send({ error: 'Sin permisos' })
    }

    const dispute = await db.query.disputes.findFirst({
      where: eq(disputes.orderId, orderId),
      with: { openedByUser: { columns: { id: true, walletAddress: true, username: true } } },
    })
    if (!dispute) return reply.status(404).send({ error: 'No hay disputa para esta orden' })

    return reply.send(dispute)
  })
}
