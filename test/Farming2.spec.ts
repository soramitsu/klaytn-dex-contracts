import { ethers } from 'hardhat';
import { expect } from 'chai';
import { Contract, ContractFactory } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { advanceBlockTo } from './shared/utilities';

describe('Farming2', () => {
  let minter: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;
  let Farming: ContractFactory;
  let PTN: ContractFactory;
  let KIP7LP: ContractFactory;
  let ptn: Contract;
  let farming: Contract;
  let lp: Contract;
  let lp2: Contract;
  before(async () => {
    [minter, alice, bob, carol] = await ethers.getSigners();
    Farming = await ethers.getContractFactory('Farming');
    PTN = await ethers.getContractFactory('PlatformToken');
    KIP7LP = await ethers.getContractFactory('DexKIP7Test');
  });

  beforeEach(async () => {
    ptn = await PTN.deploy();
    await ptn.deployed();
  });

  it('should set correct state variables', async () => {
    farming = await Farming.deploy(ptn.address, '1000', '0');
    await farming.deployed();

    await ptn.transferOwnership(farming.address);

    const ptnAddress = await farming.ptn();
    const owner = await ptn.owner();

    expect(ptnAddress).to.equal(ptn.address);
    expect(owner).to.equal(farming.address);
  });

  context('With ERC/LP token added to the field', () => {
    beforeEach(async () => {
      lp = await KIP7LP.deploy('10000000000');

      await lp.transfer(alice.address, '1000');

      await lp.transfer(bob.address, '1000');

      await lp.transfer(carol.address, '1000');

      lp2 = await KIP7LP.deploy('10000000000');

      await lp2.transfer(alice.address, '1000');

      await lp2.transfer(bob.address, '1000');

      await lp2.transfer(carol.address, '1000');
    });

    it('should allow emergency withdraw', async () => {
      // 100 per block farming rate starting at block 100 with bonus until block 1000
      farming = await Farming.deploy(ptn.address, '100', '100');
      await farming.deployed();

      await farming.add('100', lp.address, true);

      await lp.connect(bob).approve(farming.address, '1000');

      await farming.connect(bob).deposit(1, '100');

      expect(await lp.balanceOf(bob.address)).to.equal('900');

      await farming.connect(bob).emergencyWithdraw(1);

      expect(await lp.balanceOf(bob.address)).to.equal('1000');
    });

    it('should give out PTNs only after farming time', async () => {
      // 100 per block farming rate starting at block 100
      farming = await Farming.deploy(ptn.address, '1000', '100');
      await farming.deployed();
      await ptn.transferOwnership(farming.address);

      const lp3 = await KIP7LP.deploy('10000000000');
      const lp4 = await KIP7LP.deploy('10000000000');
      const lp5 = await KIP7LP.deploy('10000000000');
      const lp6 = await KIP7LP.deploy('10000000000');
      const lp7 = await KIP7LP.deploy('10000000000');
      const lp8 = await KIP7LP.deploy('10000000000');
      const lp9 = await KIP7LP.deploy('10000000000');

      await farming.add('2000', lp.address, true);
      await farming.add('1000', lp2.address, true);
      await farming.add('500', lp3.address, true);
      await farming.add('500', lp4.address, true);
      await farming.add('500', lp5.address, true);
      await farming.add('500', lp6.address, true);
      await farming.add('500', lp7.address, true);
      await farming.add('100', lp8.address, true);
      await farming.add('100', lp9.address, true);

      expect(await farming.poolLength()).to.be.equal(10);

      await lp.connect(bob).approve(farming.address, '1000');
      await farming.connect(bob).deposit(1, '20');
      await advanceBlockTo(89);

      await farming.connect(bob).deposit(1, '0'); // block 90
      expect(await ptn.balanceOf(bob.address)).to.equal('0');
      await advanceBlockTo(94);

      await farming.connect(bob).deposit(1, '0'); // block 95
      expect(await ptn.balanceOf(bob.address)).to.equal('0');
      await advanceBlockTo(99);

      await farming.connect(bob).deposit(1, '0'); // block 100
      expect(await ptn.balanceOf(bob.address)).to.equal('0');
      await advanceBlockTo(100);

      await farming.connect(bob).deposit(1, '0'); // block 101
      expect(await ptn.balanceOf(bob.address)).to.equal('263');

      await advanceBlockTo(104);
      await farming.connect(bob).deposit(1, '0'); // block 105

      expect(await ptn.balanceOf(bob.address)).to.equal('1315');
      expect(await ptn.totalSupply()).to.equal('1315');
    });

    it('should not distribute ptns if no one deposit', async () => {
      // 100 per block farming rate starting at block 200
      farming = await Farming.deploy(ptn.address, '1000', '200');
      const lp3 = await KIP7LP.deploy('10000000000');
      await farming.deployed();
      await ptn.transferOwnership(farming.address);
      await farming.add('1000', lp.address, true);
      await farming.add('1000', lp2.address, true);
      await farming.add('1000', lp3.address, true);
      await lp.connect(bob).approve(farming.address, '1000');
      await advanceBlockTo(199);
      expect(await ptn.totalSupply()).to.equal('0');
      await advanceBlockTo(204);
      expect(await ptn.totalSupply()).to.equal('0');
      await advanceBlockTo(209);
      await farming.connect(bob).deposit(1, '20'); // block 210
      expect(await ptn.totalSupply()).to.equal('0');
      expect(await ptn.balanceOf(bob.address)).to.equal('0');
      expect(await lp.balanceOf(bob.address)).to.equal('980');
      await advanceBlockTo(219);
      await farming.connect(bob).withdraw(1, '10'); // block 220
      expect(await ptn.totalSupply()).to.equal('2500');
      expect(await ptn.balanceOf(bob.address)).to.equal('2500');
      expect(await lp.balanceOf(bob.address)).to.equal('990');
    });

    it('should distribute ptns properly for each staker', async () => {
      // 100 per block farming rate starting at block 300
      farming = await Farming.deploy(ptn.address, '100', '300');
      await farming.deployed();
      await ptn.transferOwnership(farming.address);
      await farming.add('100', lp.address, true);
      await lp.connect(alice).approve(farming.address, '1000');
      await lp.connect(bob).approve(farming.address, '1000');
      await lp.connect(carol).approve(farming.address, '1000');
      // Alice deposits 10 LPs at block 310
      await advanceBlockTo(309);
      await farming.connect(alice).deposit(1, '10');
      // Bob deposits 20 LPs at block 314
      await advanceBlockTo(313);
      await farming.connect(bob).deposit(1, '20');
      // Carol deposits 30 LPs at block 318
      await advanceBlockTo(317);
      await farming.connect(carol).deposit(1, '30');
      // Alice deposits 10 more LPs at block 320. At this point:
      await advanceBlockTo(319);
      await farming.connect(alice).deposit(1, '10');
      expect(await ptn.totalSupply()).to.equal('750');
      expect(await ptn.balanceOf(alice.address)).to.equal('425');
      expect(await ptn.balanceOf(bob.address)).to.equal('0');
      expect(await ptn.balanceOf(carol.address)).to.equal('0');
      expect(await ptn.balanceOf(farming.address)).to.equal('325');
      // Bob withdraws 5 LPs at block 330. At this point:
      await advanceBlockTo(329);
      await farming.connect(bob).withdraw(1, '5', { from: bob.address });
      expect(await ptn.totalSupply()).to.equal('1501');
      expect(await ptn.balanceOf(alice.address)).to.equal('425');
      expect(await ptn.balanceOf(bob.address)).to.equal('464');
      expect(await ptn.balanceOf(carol.address)).to.equal('0');
      expect(await ptn.balanceOf(farming.address)).to.equal('612');
      // Alice withdraws 20 LPs at block 340.
      // Bob withdraws 15 LPs at block 350.
      // Carol withdraws 30 LPs at block 360.
      await advanceBlockTo(339);
      await farming.connect(alice).withdraw(1, '20', { from: alice.address });
      await advanceBlockTo(349);
      await farming.connect(bob).withdraw(1, '15', { from: bob.address });
      await advanceBlockTo(359);
      await farming.connect(carol).withdraw(1, '30', { from: carol.address });
      expect(await ptn.totalSupply()).to.equal('3754');
      expect(await ptn.balanceOf(alice.address)).to.equal('870');
      expect(await ptn.balanceOf(bob.address)).to.equal('888');
      expect(await ptn.balanceOf(carol.address)).to.equal('1995');
      // All of them should have 1000 LPs back.
      expect(await lp.balanceOf(alice.address)).to.equal('1000');
      expect(await lp.balanceOf(bob.address)).to.equal('1000');
      expect(await lp.balanceOf(carol.address)).to.equal('1000');
    });

    it('should give proper ptns allocation to each pool', async () => {
      // 100 per block farming rate starting at block 400
      farming = await Farming.deploy(ptn.address, '100', '400');
      await ptn.transferOwnership(farming.address);
      await lp.connect(alice).approve(farming.address, '1000');
      await lp2.connect(bob).approve(farming.address, '1000');
      // Add first LP to the pool with allocation 1
      await farming.add('10', lp.address, true);
      // Alice deposits 10 LPs at block 410
      await advanceBlockTo(409);
      await farming.connect(alice).deposit(1, '10');
      // Add LP2 to the pool with allocation 2 at block 420
      await advanceBlockTo(419);
      await farming.add('20', lp2.address, true);
      // (1010-1000 + 10/3) = 13
      // (10 * 10 * 100) / 13 = 769
      // (769 * 1e12 / 10) = 769 00000000000
      // 10 * (769 00000000000) / 1e12 = 769
      // Alice should have 76900000000000 or 769 pending reward
      expect(await farming.pendingPtn(1, alice.address)).to.equal('769');
      // Bob deposits 10 LP2s at block 425
      await advanceBlockTo(424);
      await farming.connect(bob).deposit(2, '5');
      // (33-3 + 30/3) = 40
      // (5 * 10 * 100) / 40 = 125
      // (125 * 1e12 / 10) = 125 00000000000
      // 10 * (125 00000000000) / 1e12 = 125 00000000000
      // Alice should have 769 + 125 = 894 pending reward
      expect(await farming.pendingPtn(1, alice.address)).to.equal('894');
      await advanceBlockTo(430);
      // (33-3 + 30/3) = 40
      // (10 * 10 * 100) / 40 = 250
      // 250 * 1e12 / 10 = 125
      // Alice should have 769 + 250 = 1019 pending reward
      expect(await farming.pendingPtn(1, alice.address)).to.equal('1019');
      // (33-3 + 30/3) = 40
      // (5 * 20 * 100) / 40 = 250
      // 5 * (250 * 1e12 / 5) = 50
      // Bob should have 250 pending reward
      expect(await farming.pendingPtn(2, bob.address)).to.equal('250');
    });
  });
});
