import { expect } from 'chai'
import { ethers } from 'hardhat'
import { time, loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { MarketplaceEscrow, MockUSDT, MockKleros } from '../typechain-types'
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'

const USDT_AMOUNT = ethers.parseUnits('100', 6) // 100 USDT
const ARB_COST = ethers.parseEther('0.01')

function randomOrderId(): string {
  return ethers.keccak256(ethers.randomBytes(32))
}

async function deployFixture() {
  const [owner, buyer, seller, stranger] = await ethers.getSigners()

  const MockUSDT = await ethers.getContractFactory('MockUSDT')
  const usdt = await MockUSDT.deploy() as MockUSDT

  const MockKleros = await ethers.getContractFactory('MockKleros')
  const kleros = await MockKleros.deploy() as MockKleros

  const Escrow = await ethers.getContractFactory('MarketplaceEscrow')
  const escrow = await Escrow.deploy(
    await usdt.getAddress(),
    await kleros.getAddress()
  ) as MarketplaceEscrow

  // Mintear USDT al comprador
  await usdt.mint(buyer.address, ethers.parseUnits('10000', 6))

  return { escrow, usdt, kleros, owner, buyer, seller, stranger }
}

describe('MarketplaceEscrow', function () {

  // ─── crearOrden ────────────────────────────────────────────────────

  describe('crearOrden', function () {
    it('happy path: crea orden y retiene USDT en escrow', async function () {
      const { escrow, usdt, buyer, seller } = await loadFixture(deployFixture)
      const orderId = randomOrderId()
      const metaHash = ethers.keccak256(ethers.toUtf8Bytes('producto'))

      await usdt.connect(buyer).approve(await escrow.getAddress(), USDT_AMOUNT)
      await escrow.connect(buyer).crearOrden(orderId, seller.address, USDT_AMOUNT, 7, metaHash)

      const orden = await escrow.ordenes(orderId)
      expect(orden.comprador).to.equal(buyer.address)
      expect(orden.vendedor).to.equal(seller.address)
      expect(orden.monto).to.equal(USDT_AMOUNT)
      expect(orden.estado).to.equal(0) // Estado.Activo

      const escrowBalance = await usdt.balanceOf(await escrow.getAddress())
      expect(escrowBalance).to.equal(USDT_AMOUNT)
    })

    it('error: orden duplicada con mismo orderId', async function () {
      const { escrow, usdt, buyer, seller } = await loadFixture(deployFixture)
      const orderId = randomOrderId()
      const metaHash = ethers.keccak256(ethers.toUtf8Bytes('producto'))

      await usdt.connect(buyer).approve(await escrow.getAddress(), USDT_AMOUNT * 2n)
      await escrow.connect(buyer).crearOrden(orderId, seller.address, USDT_AMOUNT, 7, metaHash)

      await expect(
        escrow.connect(buyer).crearOrden(orderId, seller.address, USDT_AMOUNT, 7, metaHash)
      ).to.be.revertedWith('Orden ya existe')
    })

    it('error: monto 0', async function () {
      const { escrow, usdt, buyer, seller } = await loadFixture(deployFixture)
      const orderId = randomOrderId()
      const metaHash = ethers.keccak256(ethers.toUtf8Bytes('x'))

      await usdt.connect(buyer).approve(await escrow.getAddress(), USDT_AMOUNT)
      await expect(
        escrow.connect(buyer).crearOrden(orderId, seller.address, 0, 7, metaHash)
      ).to.be.revertedWith('Monto debe ser positivo')
    })

    it('error: vendedor es el mismo comprador', async function () {
      const { escrow, usdt, buyer } = await loadFixture(deployFixture)
      const orderId = randomOrderId()
      const metaHash = ethers.keccak256(ethers.toUtf8Bytes('x'))

      await usdt.connect(buyer).approve(await escrow.getAddress(), USDT_AMOUNT)
      await expect(
        escrow.connect(buyer).crearOrden(orderId, buyer.address, USDT_AMOUNT, 7, metaHash)
      ).to.be.revertedWith('Vendedor invalido')
    })

    it('error: vendedor address(0)', async function () {
      const { escrow, usdt, buyer } = await loadFixture(deployFixture)
      const orderId = randomOrderId()
      const metaHash = ethers.keccak256(ethers.toUtf8Bytes('x'))

      await usdt.connect(buyer).approve(await escrow.getAddress(), USDT_AMOUNT)
      await expect(
        escrow.connect(buyer).crearOrden(orderId, ethers.ZeroAddress, USDT_AMOUNT, 7, metaHash)
      ).to.be.revertedWith('Vendedor invalido')
    })

    it('error: timeout fuera de rango', async function () {
      const { escrow, usdt, buyer, seller } = await loadFixture(deployFixture)
      const orderId = randomOrderId()
      const metaHash = ethers.keccak256(ethers.toUtf8Bytes('x'))

      await usdt.connect(buyer).approve(await escrow.getAddress(), USDT_AMOUNT)
      await expect(
        escrow.connect(buyer).crearOrden(orderId, seller.address, USDT_AMOUNT, 31, metaHash)
      ).to.be.revertedWith('Timeout: 1-30 dias')
    })
  })

  // ─── confirmarRecepcion ────────────────────────────────────────────

  describe('confirmarRecepcion', function () {
    async function createActiveOrder(fixture: Awaited<ReturnType<typeof deployFixture>>) {
      const { escrow, usdt, buyer, seller, owner } = fixture
      const orderId = randomOrderId()
      const metaHash = ethers.keccak256(ethers.toUtf8Bytes('producto'))
      await usdt.connect(buyer).approve(await escrow.getAddress(), USDT_AMOUNT)
      await escrow.connect(buyer).crearOrden(orderId, seller.address, USDT_AMOUNT, 7, metaHash)
      return { orderId, owner, buyer, seller }
    }

    it('libera fondos con fee correcto al vendedor y owner', async function () {
      const fixture = await loadFixture(deployFixture)
      const { orderId, buyer, seller, owner } = await createActiveOrder(fixture)
      const { escrow, usdt } = fixture

      const sellerBefore = await usdt.balanceOf(seller.address)
      const ownerBefore = await usdt.balanceOf(owner.address)

      await escrow.connect(buyer).confirmarRecepcion(orderId)

      const fee = (USDT_AMOUNT * 150n) / 10000n
      const sellerAmount = USDT_AMOUNT - fee

      expect(await usdt.balanceOf(seller.address)).to.equal(sellerBefore + sellerAmount)
      expect(await usdt.balanceOf(owner.address)).to.equal(ownerBefore + fee)

      const orden = await escrow.ordenes(orderId)
      expect(orden.estado).to.equal(1) // CompletadoComprador
    })

    it('error: solo el comprador puede confirmar', async function () {
      const fixture = await loadFixture(deployFixture)
      const { orderId, seller } = await createActiveOrder(fixture)
      const { escrow } = fixture

      await expect(
        escrow.connect(seller).confirmarRecepcion(orderId)
      ).to.be.revertedWith('Solo el comprador')
    })

    it('error: doble confirmación', async function () {
      const fixture = await loadFixture(deployFixture)
      const { orderId, buyer } = await createActiveOrder(fixture)
      const { escrow } = fixture

      await escrow.connect(buyer).confirmarRecepcion(orderId)
      await expect(
        escrow.connect(buyer).confirmarRecepcion(orderId)
      ).to.be.revertedWith('Orden no activa')
    })
  })

  // ─── autoRelease ───────────────────────────────────────────────────

  describe('autoRelease', function () {
    it('falla si el timeout no alcanzó', async function () {
      const fixture = await loadFixture(deployFixture)
      const { escrow, usdt, buyer, seller } = fixture
      const orderId = randomOrderId()
      const metaHash = ethers.keccak256(ethers.toUtf8Bytes('x'))

      await usdt.connect(buyer).approve(await escrow.getAddress(), USDT_AMOUNT)
      await escrow.connect(buyer).crearOrden(orderId, seller.address, USDT_AMOUNT, 7, metaHash)

      await expect(escrow.autoRelease(orderId)).to.be.revertedWith('Timeout no alcanzado')
    })

    it('funciona después del timeout y libera al vendedor', async function () {
      const fixture = await loadFixture(deployFixture)
      const { escrow, usdt, buyer, seller } = fixture
      const orderId = randomOrderId()
      const metaHash = ethers.keccak256(ethers.toUtf8Bytes('x'))

      await usdt.connect(buyer).approve(await escrow.getAddress(), USDT_AMOUNT)
      await escrow.connect(buyer).crearOrden(orderId, seller.address, USDT_AMOUNT, 7, metaHash)

      await time.increase(7 * 24 * 60 * 60 + 1)

      const sellerBefore = await usdt.balanceOf(seller.address)
      await escrow.autoRelease(orderId)

      const fee = (USDT_AMOUNT * 150n) / 10000n
      expect(await usdt.balanceOf(seller.address)).to.equal(sellerBefore + USDT_AMOUNT - fee)

      const orden = await escrow.ordenes(orderId)
      expect(orden.estado).to.equal(2) // CompletadoAutoRelease
    })

    it('cualquiera puede llamar autoRelease (no solo el vendedor)', async function () {
      const fixture = await loadFixture(deployFixture)
      const { escrow, usdt, buyer, seller, stranger } = fixture
      const orderId = randomOrderId()
      const metaHash = ethers.keccak256(ethers.toUtf8Bytes('x'))

      await usdt.connect(buyer).approve(await escrow.getAddress(), USDT_AMOUNT)
      await escrow.connect(buyer).crearOrden(orderId, seller.address, USDT_AMOUNT, 7, metaHash)

      await time.increase(7 * 24 * 60 * 60 + 1)
      await expect(escrow.connect(stranger).autoRelease(orderId)).to.not.be.reverted
    })
  })

  // ─── abrirDisputa ──────────────────────────────────────────────────

  describe('abrirDisputa', function () {
    async function createActive(fixture: Awaited<ReturnType<typeof deployFixture>>) {
      const { escrow, usdt, buyer, seller } = fixture
      const orderId = randomOrderId()
      const metaHash = ethers.keccak256(ethers.toUtf8Bytes('x'))
      await usdt.connect(buyer).approve(await escrow.getAddress(), USDT_AMOUNT)
      await escrow.connect(buyer).crearOrden(orderId, seller.address, USDT_AMOUNT, 7, metaHash)
      return orderId
    }

    it('abre disputa con MATIC correcto', async function () {
      const fixture = await loadFixture(deployFixture)
      const orderId = await createActive(fixture)
      const { escrow, buyer } = fixture

      await escrow.connect(buyer).abrirDisputa(orderId, { value: ARB_COST })
      const orden = await escrow.ordenes(orderId)
      expect(orden.estado).to.equal(3) // Disputado
    })

    it('error: MATIC insuficiente', async function () {
      const fixture = await loadFixture(deployFixture)
      const orderId = await createActive(fixture)
      const { escrow, buyer } = fixture

      await expect(
        escrow.connect(buyer).abrirDisputa(orderId, { value: ARB_COST - 1n })
      ).to.be.revertedWith('MATIC insuficiente para Kleros')
    })

    it('devuelve exceso de MATIC al comprador', async function () {
      const fixture = await loadFixture(deployFixture)
      const orderId = await createActive(fixture)
      const { escrow, buyer } = fixture

      const excess = ethers.parseEther('0.05')
      const buyerBefore = await ethers.provider.getBalance(buyer.address)
      const tx = await escrow.connect(buyer).abrirDisputa(orderId, { value: ARB_COST + excess })
      const receipt = await tx.wait()
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice

      const buyerAfter = await ethers.provider.getBalance(buyer.address)
      // Pagó ARB_COST + gas, recibió excess de vuelta
      expect(buyerBefore - buyerAfter).to.be.closeTo(ARB_COST + gasUsed, ethers.parseEther('0.001'))
    })

    it('error: solo el comprador puede abrir disputa', async function () {
      const fixture = await loadFixture(deployFixture)
      const orderId = await createActive(fixture)
      const { escrow, seller } = fixture

      await expect(
        escrow.connect(seller).abrirDisputa(orderId, { value: ARB_COST })
      ).to.be.revertedWith('Solo el comprador')
    })

    it('error: no se puede abrir disputa después del timeout', async function () {
      const fixture = await loadFixture(deployFixture)
      const orderId = await createActive(fixture)
      const { escrow, buyer } = fixture

      await time.increase(7 * 24 * 60 * 60 + 1)
      await expect(
        escrow.connect(buyer).abrirDisputa(orderId, { value: ARB_COST })
      ).to.be.revertedWith('Timeout expirado, usar autoRelease')
    })
  })

  // ─── rule (Kleros ruling) ──────────────────────────────────────────

  describe('rule', function () {
    async function createDisputedOrder(fixture: Awaited<ReturnType<typeof deployFixture>>) {
      const { escrow, usdt, buyer, seller } = fixture
      const orderId = randomOrderId()
      const metaHash = ethers.keccak256(ethers.toUtf8Bytes('x'))
      await usdt.connect(buyer).approve(await escrow.getAddress(), USDT_AMOUNT)
      await escrow.connect(buyer).crearOrden(orderId, seller.address, USDT_AMOUNT, 7, metaHash)
      await escrow.connect(buyer).abrirDisputa(orderId, { value: ARB_COST })
      const orden = await escrow.ordenes(orderId)
      return { orderId, klerosId: orden.klerosCaseId }
    }

    it('ruling=1: reembolsa 100% al comprador (sin fee)', async function () {
      const fixture = await loadFixture(deployFixture)
      const { orderId, klerosId } = await createDisputedOrder(fixture)
      const { escrow, usdt, kleros, buyer } = fixture

      const buyerBefore = await usdt.balanceOf(buyer.address)
      await kleros.giveRuling(klerosId, 1)

      expect(await usdt.balanceOf(buyer.address)).to.equal(buyerBefore + USDT_AMOUNT)
      const orden = await escrow.ordenes(orderId)
      expect(orden.estado).to.equal(4) // ResueltoPorKleros
    })

    it('ruling=2: libera al vendedor con fee de plataforma', async function () {
      const fixture = await loadFixture(deployFixture)
      const { orderId, klerosId } = await createDisputedOrder(fixture)
      const { escrow, usdt, kleros, seller, owner } = fixture

      const sellerBefore = await usdt.balanceOf(seller.address)
      const ownerBefore = await usdt.balanceOf(owner.address)
      await kleros.giveRuling(klerosId, 2)

      const fee = (USDT_AMOUNT * 150n) / 10000n
      expect(await usdt.balanceOf(seller.address)).to.equal(sellerBefore + USDT_AMOUNT - fee)
      expect(await usdt.balanceOf(owner.address)).to.equal(ownerBefore + fee)
    })

    it('ruling=0 (sin consenso): libera al vendedor', async function () {
      const fixture = await loadFixture(deployFixture)
      const { klerosId } = await createDisputedOrder(fixture)
      const { kleros, usdt, seller } = fixture

      const sellerBefore = await usdt.balanceOf(seller.address)
      await kleros.giveRuling(klerosId, 0)

      const fee = (USDT_AMOUNT * 150n) / 10000n
      expect(await usdt.balanceOf(seller.address)).to.equal(sellerBefore + USDT_AMOUNT - fee)
    })

    it('error: solo Kleros puede llamar rule()', async function () {
      const fixture = await loadFixture(deployFixture)
      const { orderId, klerosId } = await createDisputedOrder(fixture)
      const { escrow, stranger } = fixture

      await expect(
        escrow.connect(stranger).rule(klerosId, 1)
      ).to.be.revertedWith('Solo Kleros')
    })
  })

  // ─── subirEvidencia ────────────────────────────────────────────────

  describe('subirEvidencia', function () {
    it('comprador y vendedor pueden subir evidencia en estado Disputado', async function () {
      const fixture = await loadFixture(deployFixture)
      const { escrow, usdt, buyer, seller } = fixture
      const orderId = randomOrderId()
      const metaHash = ethers.keccak256(ethers.toUtf8Bytes('x'))

      await usdt.connect(buyer).approve(await escrow.getAddress(), USDT_AMOUNT)
      await escrow.connect(buyer).crearOrden(orderId, seller.address, USDT_AMOUNT, 7, metaHash)
      await escrow.connect(buyer).abrirDisputa(orderId, { value: ARB_COST })

      await expect(
        escrow.connect(buyer).subirEvidencia(orderId, 'ipfs://Qm123buyer')
      ).to.emit(escrow, 'EvidenciaSubida').withArgs(orderId, buyer.address, 'ipfs://Qm123buyer')

      await expect(
        escrow.connect(seller).subirEvidencia(orderId, 'ipfs://Qm456seller')
      ).to.emit(escrow, 'EvidenciaSubida').withArgs(orderId, seller.address, 'ipfs://Qm456seller')
    })

    it('error: tercero no puede subir evidencia', async function () {
      const fixture = await loadFixture(deployFixture)
      const { escrow, usdt, buyer, seller, stranger } = fixture
      const orderId = randomOrderId()
      const metaHash = ethers.keccak256(ethers.toUtf8Bytes('x'))

      await usdt.connect(buyer).approve(await escrow.getAddress(), USDT_AMOUNT)
      await escrow.connect(buyer).crearOrden(orderId, seller.address, USDT_AMOUNT, 7, metaHash)
      await escrow.connect(buyer).abrirDisputa(orderId, { value: ARB_COST })

      await expect(
        escrow.connect(stranger).subirEvidencia(orderId, 'ipfs://hack')
      ).to.be.revertedWith('Solo las partes')
    })

    it('error: no se puede subir evidencia en orden activa (no disputada)', async function () {
      const fixture = await loadFixture(deployFixture)
      const { escrow, usdt, buyer, seller } = fixture
      const orderId = randomOrderId()
      const metaHash = ethers.keccak256(ethers.toUtf8Bytes('x'))

      await usdt.connect(buyer).approve(await escrow.getAddress(), USDT_AMOUNT)
      await escrow.connect(buyer).crearOrden(orderId, seller.address, USDT_AMOUNT, 7, metaHash)

      await expect(
        escrow.connect(buyer).subirEvidencia(orderId, 'ipfs://early')
      ).to.be.revertedWith('Orden no en disputa')
    })
  })

  // ─── Admin ─────────────────────────────────────────────────────────

  describe('Admin', function () {
    it('owner puede actualizar fee hasta 5%', async function () {
      const { escrow, owner } = await loadFixture(deployFixture)
      await escrow.connect(owner).actualizarFee(500)
      expect(await escrow.platformFeeBps()).to.equal(500)
    })

    it('error: fee mayor a 5% revertido', async function () {
      const { escrow, owner } = await loadFixture(deployFixture)
      await expect(escrow.connect(owner).actualizarFee(501)).to.be.revertedWith('Max 5%')
    })

    it('error: non-owner no puede cambiar fee', async function () {
      const { escrow, stranger } = await loadFixture(deployFixture)
      await expect(escrow.connect(stranger).actualizarFee(200))
        .to.be.revertedWithCustomError(escrow, 'OwnableUnauthorizedAccount')
    })
  })
})
