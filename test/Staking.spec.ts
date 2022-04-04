import { ethers } from 'hardhat';
import { expect } from 'chai';
import { Contract, ContractFactory } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { advanceBlockTo } from './shared/utilities';

describe('Staking', () => {
  let minter: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;
  let Staking: ContractFactory;
  let PTN: ContractFactory;
  let KIP7LP: ContractFactory;
  let ptn: Contract;
  let staking: Contract;
  let lp: Contract;
  let lp2: Contract;
  before(async () => {
    [minter, alice, bob, carol] = await ethers.getSigners();
    Staking = await ethers.getContractFactory('Staking');
    PTN = await ethers.getContractFactory('PlatformToken');
    KIP7LP = await ethers.getContractFactory('KIP7Mock');
  });

  beforeEach(async () => {
    ptn = await PTN.deploy();
    await ptn.deployed();
  });

  it('should set correct state variables', async () => {
    staking = await Staking.deploy(ptn.address, '1000', '0');
    await staking.deployed();

    await ptn.transferOwnership(staking.address);

    const ptnAddress = await staking.ptn();
    const owner = await ptn.owner();

    expect(ptnAddress).to.equal(ptn.address);
    expect(owner).to.equal(staking.address);
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
      // 100 per block staking rate starting at block 100 with bonus until block 1000
      staking = await Staking.deploy(ptn.address, '100', '100');
      await staking.deployed();

      await staking.add('100', lp.address, true);

      await lp.connect(bob).approve(staking.address, '1000');

      await staking.connect(bob).deposit(0, '100');

      expect(await lp.balanceOf(bob.address)).to.equal('900');

      await staking.connect(bob).emergencyWithdraw(0);

      expect(await lp.balanceOf(bob.address)).to.equal('1000');
    });

    it('should give out PTNs only after staking time', async () => {
      // 100 per block staking rate starting at block 100
      staking = await Staking.deploy(ptn.address, '100', '100');
      await staking.deployed();
      await ptn.transferOwnership(staking.address);

      await staking.add('100', lp.address, true);

      expect(await staking.poolLength()).to.be.equal(1);

      await lp.connect(bob).approve(staking.address, '1000');
      await staking.connect(bob).deposit(0, '20');
      await advanceBlockTo(89);

      await staking.connect(bob).deposit(0, '0'); // block 90
      expect(await ptn.balanceOf(bob.address)).to.equal('0');
      await advanceBlockTo(94);

      await staking.connect(bob).deposit(0, '0'); // block 95
      expect(await ptn.balanceOf(bob.address)).to.equal('0');
      await advanceBlockTo(99);

      await staking.connect(bob).deposit(0, '0'); // block 100
      expect(await ptn.balanceOf(bob.address)).to.equal('0');
      await advanceBlockTo(100);

      await staking.connect(bob).deposit(0, '0'); // block 101
      expect(await ptn.balanceOf(bob.address)).to.equal('1000');

      await advanceBlockTo(104);
      await staking.connect(bob).deposit(0, '0'); // block 105

      expect(await ptn.balanceOf(bob.address)).to.equal('5000');
      expect(await ptn.totalSupply()).to.equal('5000');
    });

    it('should not distribute ptns if no one deposit', async () => {
      // 100 per block staking rate starting at block 200
      staking = await Staking.deploy(ptn.address, '100', '200');
      const lp3 = await KIP7LP.deploy('10000000000');
      await staking.deployed();
      await ptn.transferOwnership(staking.address);
      await staking.add('1000', lp.address, true);
      await staking.add('1000', lp2.address, true);
      await staking.add('1000', lp3.address, true);
      await lp.connect(bob).approve(staking.address, '1000');
      await advanceBlockTo(199);
      expect(await ptn.totalSupply()).to.equal('0');
      await advanceBlockTo(204);
      expect(await ptn.totalSupply()).to.equal('0');
      await advanceBlockTo(209);
      await staking.connect(bob).deposit(0, '20'); // block 210
      expect(await ptn.totalSupply()).to.equal('0');
      expect(await ptn.balanceOf(bob.address)).to.equal('0');
      expect(await lp.balanceOf(bob.address)).to.equal('980');
      await advanceBlockTo(219);
      await staking.connect(bob).withdraw(0, '10'); // block 220
      expect(await ptn.totalSupply()).to.equal('3333');
      expect(await ptn.balanceOf(bob.address)).to.equal('3333');
      expect(await lp.balanceOf(bob.address)).to.equal('990');
    });

    it('should distribute ptns properly for each staker', async () => {
      // 100 per block staking rate starting at block 300
      staking = await Staking.deploy(ptn.address, '100', '300');
      await staking.deployed();
      await ptn.transferOwnership(staking.address);
      await staking.add('100', lp.address, true);
      await lp.connect(alice).approve(staking.address, '1000');
      await lp.connect(bob).approve(staking.address, '1000');
      await lp.connect(carol).approve(staking.address, '1000');
      // Alice deposits 10 LPs at block 310
      await advanceBlockTo(309);
      await staking.connect(alice).deposit(0, '10');
      // Bob deposits 20 LPs at block 314
      await advanceBlockTo(313);
      await staking.connect(bob).deposit(0, '20');
      // Carol deposits 30 LPs at block 318
      await advanceBlockTo(317);
      await staking.connect(carol).deposit(0, '30');
      // Alice deposits 10 more LPs at block 320. At this point:
      await advanceBlockTo(319);
      await staking.connect(alice).deposit(0, '10');
      expect(await ptn.totalSupply()).to.equal('10000');
      expect(await ptn.balanceOf(alice.address)).to.equal('5666');
      expect(await ptn.balanceOf(bob.address)).to.equal('0');
      expect(await ptn.balanceOf(carol.address)).to.equal('0');
      expect(await ptn.balanceOf(staking.address)).to.equal('4334');
      // Bob withdraws 5 LPs at block 330. At this point:
      await advanceBlockTo(329);
      await staking.connect(bob).withdraw(0, '5', { from: bob.address });
      expect(await ptn.totalSupply()).to.equal('20000');
      expect(await ptn.balanceOf(alice.address)).to.equal('5666');
      expect(await ptn.balanceOf(bob.address)).to.equal('6190');
      expect(await ptn.balanceOf(carol.address)).to.equal('0');
      expect(await ptn.balanceOf(staking.address)).to.equal('8144');
      // Alice withdraws 20 LPs at block 340.
      // Bob withdraws 15 LPs at block 350.
      // Carol withdraws 30 LPs at block 360.
      await advanceBlockTo(339);
      await staking.connect(alice).withdraw(0, '20');
      await advanceBlockTo(349);
      await staking.connect(bob).withdraw(0, '15');
      await advanceBlockTo(359);
      await staking.connect(carol).withdraw(0, '30', { from: carol.address });
      expect(await ptn.totalSupply()).to.equal('50000');
      expect(await ptn.balanceOf(alice.address)).to.equal('11600');
      expect(await ptn.balanceOf(bob.address)).to.equal('11831');
      expect(await ptn.balanceOf(carol.address)).to.equal('26568');
      // All of them should have 1000 LPs back.
      expect(await lp.balanceOf(alice.address)).to.equal('1000');
      expect(await lp.balanceOf(bob.address)).to.equal('1000');
      expect(await lp.balanceOf(carol.address)).to.equal('1000');
    });

    it('should give proper ptns allocation to each pool', async () => {
      // 100 per block staking rate starting at block 400
      staking = await Staking.deploy(ptn.address, '100', '400');
      await ptn.transferOwnership(staking.address);
      await lp.connect(alice).approve(staking.address, '1000');
      await lp2.connect(bob).approve(staking.address, '1000');
      // Add first LP to the pool with allocation 1
      await staking.add('10', lp.address, true);
      // Alice deposits 10 LPs at block 410
      await advanceBlockTo(409);
      await staking.connect(alice).deposit(0, '10');
      // Add LP2 to the pool with allocation 2 at block 420
      await advanceBlockTo(419);
      await staking.add('20', lp2.address, true);
      // Alice should have 10*1000 pending reward
      expect(await staking.pendingPtn(0, alice.address)).to.equal('10000');
      // Bob deposits 10 LP2s at block 425
      await advanceBlockTo(424);
      await staking.connect(bob).deposit(1, '5');
      // Alice should have 10000 + 5*1/3*1000 = 11666 pending reward
      expect(await staking.pendingPtn(0, alice.address)).to.equal('11666');
      await advanceBlockTo(430);
      // At block 430. Bob should get 5*2/3*1000 = 3333. Alice should get ~1666 more.
      expect(await staking.pendingPtn(0, alice.address)).to.equal('13333');
      expect(await staking.pendingPtn(1, bob.address)).to.equal('3333');
    });
  });
});
