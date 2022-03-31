import { ethers } from 'hardhat';
import { expect } from 'chai';
import { advanceBlockTo } from './shared/utilities';

describe('Farming2', () => {
  before(async function () {
    [this.minter, this.alice, this.bob, this.carol] = await ethers.getSigners();
    this.Farming = await ethers.getContractFactory('Farming');
    this.PTN = await ethers.getContractFactory('PlatformToken');
    this.KIP7LP = await ethers.getContractFactory('DexKIP7Test');
  });

  beforeEach(async function () {
    this.ptn = await this.PTN.deploy();
    await this.ptn.deployed();
  });

  it('should set correct state variables', async function () {
    this.farming = await this.Farming.deploy(this.ptn.address, '1000', '0');
    await this.farming.deployed();

    await this.ptn.transferOwnership(this.farming.address);

    const ptn = await this.farming.ptn();
    const owner = await this.ptn.owner();

    expect(ptn).to.equal(this.ptn.address);
    expect(owner).to.equal(this.farming.address);
  });

  context('With ERC/LP token added to the field', () => {
    beforeEach(async function () {
      this.lp = await this.KIP7LP.deploy('10000000000');

      await this.lp.transfer(this.alice.address, '1000');

      await this.lp.transfer(this.bob.address, '1000');

      await this.lp.transfer(this.carol.address, '1000');

      this.lp2 = await this.KIP7LP.deploy('10000000000');

      await this.lp2.transfer(this.alice.address, '1000');

      await this.lp2.transfer(this.bob.address, '1000');

      await this.lp2.transfer(this.carol.address, '1000');
    });

    it('should allow emergency withdraw', async function () {
      // 100 per block farming rate starting at block 100 with bonus until block 1000
      this.farming = await this.Farming.deploy(this.ptn.address, '100', '100');
      await this.farming.deployed();

      await this.farming.add('100', this.lp.address, true);

      await this.lp.connect(this.bob).approve(this.farming.address, '1000');

      await this.farming.connect(this.bob).deposit(1, '100');

      expect(await this.lp.balanceOf(this.bob.address)).to.equal('900');

      await this.farming.connect(this.bob).emergencyWithdraw(1);

      expect(await this.lp.balanceOf(this.bob.address)).to.equal('1000');
    });

    it('should give out PTNs only after farming time', async function () {
      // 100 per block farming rate starting at block 100
      this.farming = await this.Farming.deploy(this.ptn.address, '1000', '100');
      await this.farming.deployed();
      await this.ptn.transferOwnership(this.farming.address);

      this.lp3 = await this.KIP7LP.deploy('10000000000');
      this.lp4 = await this.KIP7LP.deploy('10000000000');
      this.lp5 = await this.KIP7LP.deploy('10000000000');
      this.lp6 = await this.KIP7LP.deploy('10000000000');
      this.lp7 = await this.KIP7LP.deploy('10000000000');
      this.lp8 = await this.KIP7LP.deploy('10000000000');
      this.lp9 = await this.KIP7LP.deploy('10000000000');

      await this.farming.add('2000', this.lp.address, true);
      await this.farming.add('1000', this.lp2.address, true);
      await this.farming.add('500', this.lp3.address, true);
      await this.farming.add('500', this.lp4.address, true);
      await this.farming.add('500', this.lp5.address, true);
      await this.farming.add('500', this.lp6.address, true);
      await this.farming.add('500', this.lp7.address, true);
      await this.farming.add('100', this.lp8.address, true);
      await this.farming.add('100', this.lp9.address, true);

      expect(await this.farming.poolLength()).to.be.equal(10);

      await this.lp.connect(this.bob).approve(this.farming.address, '1000');
      await this.farming.connect(this.bob).deposit(1, '20');
      await advanceBlockTo(89);

      await this.farming.connect(this.bob).deposit(1, '0'); // block 90
      expect(await this.ptn.balanceOf(this.bob.address)).to.equal('0');
      await advanceBlockTo(94);

      await this.farming.connect(this.bob).deposit(1, '0'); // block 95
      expect(await this.ptn.balanceOf(this.bob.address)).to.equal('0');
      await advanceBlockTo(99);

      await this.farming.connect(this.bob).deposit(1, '0'); // block 100
      expect(await this.ptn.balanceOf(this.bob.address)).to.equal('0');
      await advanceBlockTo(100);

      await this.farming.connect(this.bob).deposit(1, '0'); // block 101
      expect(await this.ptn.balanceOf(this.bob.address)).to.equal('263');

      await advanceBlockTo(104);
      await this.farming.connect(this.bob).deposit(1, '0'); // block 105

      expect(await this.ptn.balanceOf(this.bob.address)).to.equal('1315');
      expect(await this.ptn.totalSupply()).to.equal('1315');
    });

    it('should not distribute ptns if no one deposit', async function () {
      // 100 per block farming rate starting at block 200
      this.farming = await this.Farming.deploy(this.ptn.address, '1000', '200');
      await this.farming.deployed();
      await this.ptn.transferOwnership(this.farming.address);
      await this.farming.add('1000', this.lp.address, true);
      await this.farming.add('1000', this.lp2.address, true);
      await this.farming.add('1000', this.lp3.address, true);
      await this.lp.connect(this.bob).approve(this.farming.address, '1000');
      await advanceBlockTo(199);
      expect(await this.ptn.totalSupply()).to.equal('0');
      await advanceBlockTo(204);
      expect(await this.ptn.totalSupply()).to.equal('0');
      await advanceBlockTo(209);
      await this.farming.connect(this.bob).deposit(1, '20'); // block 210
      expect(await this.ptn.totalSupply()).to.equal('0');
      expect(await this.ptn.balanceOf(this.bob.address)).to.equal('0');
      expect(await this.lp.balanceOf(this.bob.address)).to.equal('980');
      await advanceBlockTo(219);
      await this.farming.connect(this.bob).withdraw(1, '10'); // block 220
      expect(await this.ptn.totalSupply()).to.equal('2500');
      expect(await this.ptn.balanceOf(this.bob.address)).to.equal('2500');
      expect(await this.lp.balanceOf(this.bob.address)).to.equal('990');
    });

    it('should distribute ptns properly for each staker', async function () {
      // 100 per block farming rate starting at block 300
      this.farming = await this.Farming.deploy(this.ptn.address, '100', '300');
      await this.farming.deployed();
      await this.ptn.transferOwnership(this.farming.address);
      await this.farming.add('100', this.lp.address, true);
      await this.lp.connect(this.alice).approve(this.farming.address, '1000', {
        from: this.alice.address,
      });
      await this.lp.connect(this.bob).approve(this.farming.address, '1000', {
        from: this.bob.address,
      });
      await this.lp.connect(this.carol).approve(this.farming.address, '1000', {
        from: this.carol.address,
      });
      // Alice deposits 10 LPs at block 310
      await advanceBlockTo(309);
      await this.farming.connect(this.alice).deposit(1, '10');
      // Bob deposits 20 LPs at block 314
      await advanceBlockTo(313);
      await this.farming.connect(this.bob).deposit(1, '20');
      // Carol deposits 30 LPs at block 318
      await advanceBlockTo(317);
      await this.farming.connect(this.carol).deposit(1, '30');
      // Alice deposits 10 more LPs at block 320. At this point:
      await advanceBlockTo(319);
      await this.farming.connect(this.alice).deposit(1, '10');
      expect(await this.ptn.totalSupply()).to.equal('750');
      expect(await this.ptn.balanceOf(this.alice.address)).to.equal('425');
      expect(await this.ptn.balanceOf(this.bob.address)).to.equal('0');
      expect(await this.ptn.balanceOf(this.carol.address)).to.equal('0');
      expect(await this.ptn.balanceOf(this.farming.address)).to.equal('325');
      // Bob withdraws 5 LPs at block 330. At this point:
      await advanceBlockTo(329);
      await this.farming.connect(this.bob).withdraw(1, '5', { from: this.bob.address });
      expect(await this.ptn.totalSupply()).to.equal('1501');
      expect(await this.ptn.balanceOf(this.alice.address)).to.equal('425');
      expect(await this.ptn.balanceOf(this.bob.address)).to.equal('464');
      expect(await this.ptn.balanceOf(this.carol.address)).to.equal('0');
      expect(await this.ptn.balanceOf(this.farming.address)).to.equal('612');
      // Alice withdraws 20 LPs at block 340.
      // Bob withdraws 15 LPs at block 350.
      // Carol withdraws 30 LPs at block 360.
      await advanceBlockTo(339);
      await this.farming.connect(this.alice).withdraw(1, '20', { from: this.alice.address });
      await advanceBlockTo(349);
      await this.farming.connect(this.bob).withdraw(1, '15', { from: this.bob.address });
      await advanceBlockTo(359);
      await this.farming.connect(this.carol).withdraw(1, '30', { from: this.carol.address });
      expect(await this.ptn.totalSupply()).to.equal('3754');
      expect(await this.ptn.balanceOf(this.alice.address)).to.equal('870');
      expect(await this.ptn.balanceOf(this.bob.address)).to.equal('888');
      expect(await this.ptn.balanceOf(this.carol.address)).to.equal('1995');
      // All of them should have 1000 LPs back.
      expect(await this.lp.balanceOf(this.alice.address)).to.equal('1000');
      expect(await this.lp.balanceOf(this.bob.address)).to.equal('1000');
      expect(await this.lp.balanceOf(this.carol.address)).to.equal('1000');
    });

    it('should give proper ptns allocation to each pool', async function () {
      // 100 per block farming rate starting at block 400
      this.farming = await this.Farming.deploy(this.ptn.address, '100', '400');
      await this.ptn.transferOwnership(this.farming.address);
      await this.lp.connect(this.alice).approve(this.farming.address, '1000');
      await this.lp2.connect(this.bob).approve(this.farming.address, '1000');
      // Add first LP to the pool with allocation 1
      await this.farming.add('10', this.lp.address, true);
      // Alice deposits 10 LPs at block 410
      await advanceBlockTo(409);
      await this.farming.connect(this.alice).deposit(1, '10');
      // Add LP2 to the pool with allocation 2 at block 420
      await advanceBlockTo(419);
      await this.farming.add('20', this.lp2.address, true);
      // (1010-1000 + 10/3) = 13
      // (10 * 10 * 100) / 13 = 769
      // (769 * 1e12 / 10) = 769 00000000000
      // 10 * (769 00000000000) / 1e12 = 769
      // Alice should have 76900000000000 or 769 pending reward
      expect(await this.farming.pendingPtn(1, this.alice.address)).to.equal('769');
      // Bob deposits 10 LP2s at block 425
      await advanceBlockTo(424);
      await this.farming.connect(this.bob).deposit(2, '5');
      // (33-3 + 30/3) = 40
      // (5 * 10 * 100) / 40 = 125
      // (125 * 1e12 / 10) = 125 00000000000
      // 10 * (125 00000000000) / 1e12 = 125 00000000000
      // Alice should have 769 + 125 = 894 pending reward
      expect(await this.farming.pendingPtn(1, this.alice.address)).to.equal('894');
      await advanceBlockTo(430);
      // (33-3 + 30/3) = 40
      // (10 * 10 * 100) / 40 = 250
      // 250 * 1e12 / 10 = 125
      // Alice should have 769 + 250 = 1019 pending reward
      expect(await this.farming.pendingPtn(1, this.alice.address)).to.equal('1019');
      // (33-3 + 30/3) = 40
      // (5 * 20 * 100) / 40 = 250
      // 5 * (250 * 1e12 / 5) = 50
      // Bob should have 250 pending reward
      expect(await this.farming.pendingPtn(2, this.bob.address)).to.equal('250');
    });
  });
});
