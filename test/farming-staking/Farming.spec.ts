import { ethers } from 'hardhat';
import { expect } from 'chai';
import { Contract, ContractFactory } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { advanceBlockTo } from '../shared/utilities';

describe('Farming', () => {
  let minter: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let ptn: Contract;
  let chef: Contract;
  let lp1: Contract;
  let lp2: Contract;
  let lp3: Contract;
  let lpFactory: ContractFactory;
  beforeEach(async () => {
    [minter, alice, bob] = await ethers.getSigners();
    const ptnFactory = await ethers.getContractFactory('PlatformToken');
    lpFactory = await ethers.getContractFactory('DexKIP7Test');
    const farmingFactory = await ethers.getContractFactory('Farming');
    ptn = await ptnFactory.deploy('PlatformToken', 'PTN', 18);
    expect(await ptn.hasRole((await ptn.DEFAULT_ADMIN_ROLE()), minter.address)).to.be.equal(true);
    lp1 = await lpFactory.deploy('1000000');
    lp2 = await lpFactory.deploy('1000000');
    lp3 = await lpFactory.deploy('1000000');
    chef = await farmingFactory.deploy(ptn.address, 1000, 100);
    await ptn.grantRole((await ptn.MINTER_ROLE()), chef.address);
    await lp1.transfer(bob.address, '2000');
    await lp2.transfer(bob.address, '2000');
    await lp3.transfer(bob.address, '2000');

    await lp1.transfer(alice.address, '2000');
    await lp2.transfer(alice.address, '2000');
    await lp3.transfer(alice.address, '2000');
  });
  it('real case', async () => {
    const lp4 = await lpFactory.deploy(ethers.utils.parseEther('1000000'));
    const lp5 = await lpFactory.deploy(ethers.utils.parseEther('1000000'));
    const lp6 = await lpFactory.deploy(ethers.utils.parseEther('1000000'));
    const lp7 = await lpFactory.deploy(ethers.utils.parseEther('1000000'));
    const lp8 = await lpFactory.deploy(ethers.utils.parseEther('1000000'));
    const lp9 = await lpFactory.deploy(ethers.utils.parseEther('1000000'));
    const lp10 = await lpFactory.deploy(ethers.utils.parseEther('1000000'));
    const lp11 = await lpFactory.deploy(ethers.utils.parseEther('1000000'));
    const lp12 = await lpFactory.deploy(ethers.utils.parseEther('1000000'));
    const lp13 = await lpFactory.deploy(ethers.utils.parseEther('1000000'));
    const lp14 = await lpFactory.deploy(ethers.utils.parseEther('1000000'));
    const lp15 = await lpFactory.deploy(ethers.utils.parseEther('1000000'));
    const lp16 = await lpFactory.deploy(ethers.utils.parseEther('1000000'));
    const lp17 = await lpFactory.deploy(ethers.utils.parseEther('1000000'));
    const lp18 = await lpFactory.deploy(ethers.utils.parseEther('1000000'));
    const lp19 = await lpFactory.deploy(ethers.utils.parseEther('1000000'));
    const lp20 = await lpFactory.deploy(ethers.utils.parseEther('1000000'));
    const lp21 = await lpFactory.deploy(ethers.utils.parseEther('1000000'));
    const lp22 = await lpFactory.deploy(ethers.utils.parseEther('1000000'));
    const lp23 = await lpFactory.deploy(ethers.utils.parseEther('1000000'));
    const lp24 = await lpFactory.deploy(ethers.utils.parseEther('1000000'));
    const lp25 = await lpFactory.deploy(ethers.utils.parseEther('1000000'));
    const lp26 = await lpFactory.deploy(ethers.utils.parseEther('1000000'));
    const lp27 = await lpFactory.deploy(ethers.utils.parseEther('1000000'));
    await chef.add('2000', lp1.address, true, 1);
    await chef.add('1000', lp2.address, true, 1);
    await chef.add('500', lp3.address, true, 1);
    await chef.add('500', lp4.address, true, 1);
    await chef.add('500', lp5.address, true, 1);
    await chef.add('500', lp6.address, true, 1);
    await chef.add('500', lp7.address, true, 1);
    await chef.add('100', lp8.address, true, 1);
    await chef.add('100', lp9.address, true, 1);
    await chef.add('2000', lp10.address, true, 1);
    await chef.add('1000', lp11.address, true, 1);
    await chef.add('500', lp12.address, true, 1);
    await chef.add('500', lp13.address, true, 1);
    await chef.add('500', lp14.address, true, 1);
    await chef.add('500', lp15.address, true, 1);
    await chef.add('500', lp16.address, true, 1);
    await chef.add('100', lp17.address, true, 1);
    await chef.add('100', lp18.address, true, 1);
    await chef.add('2000', lp19.address, true, 1);
    await chef.add('1000', lp20.address, true, 1);
    await chef.add('500', lp21.address, true, 1);
    await chef.add('500', lp22.address, true, 1);
    await chef.add('500', lp23.address, true, 1);
    await chef.add('500', lp24.address, true, 1);
    await chef.add('500', lp25.address, true, 1);
    await chef.add('100', lp26.address, true, 1);
    await chef.add('100', lp27.address, true, 1);
    expect(await chef.poolLength()).to.be.equal(28);

    await expect(chef.add('100', lp2.address, false, 1))
      .to.be.revertedWith('Token already added');
    await advanceBlockTo(170);
    await lp1.connect(alice).approve(chef.address, '1000');
    expect(await ptn.balanceOf(alice.address)).to.be.equal(0);
    await chef.connect(alice).deposit(1, '20');
    await chef.connect(alice).withdraw(1, '20');
    expect(await ptn.balanceOf(alice.address)).to.be.equal('87');

    await ptn.connect(alice).approve(chef.address, '1000');
    await chef.connect(alice).enterStaking('20');
    await chef.connect(alice).enterStaking(0);
    await chef.connect(alice).enterStaking(0);
    await chef.connect(alice).enterStaking(0);
    expect((await ptn.balanceOf(alice.address)).toString()).to.be.equal('817');
  });

  it('deposit/withdraw', async () => {
    await chef.add(1000, lp1.address, true, 1);
    await chef.add(1000, lp2.address, true, 1);
    await chef.add(1000, lp3.address, true, 1);

    await lp1.connect(alice).approve(chef.address, '100');
    await chef.connect(alice).deposit(1, '20');
    await chef.connect(alice).deposit(1, '0');
    await chef.connect(alice).deposit(1, '40');
    await chef.connect(alice).deposit(1, '0');
    expect(await lp1.balanceOf(alice.address)).to.be.equal('1940');
    await chef.connect(alice).withdraw(1, '10');
    expect(await lp1.balanceOf(alice.address)).to.be.equal('1950');
    expect(await ptn.balanceOf(alice.address)).to.be.equal('999');

    await lp1.connect(bob).approve(chef.address, '100');
    expect(await lp1.balanceOf(bob.address)).to.be.equal('2000');
    await chef.connect(bob).deposit(1, '50');
    expect(await lp1.balanceOf(bob.address)).to.be.equal('1950');
    await chef.connect(bob).deposit(1, '0');
    expect(await ptn.balanceOf(bob.address)).to.be.equal('125');
    await chef.connect(bob).emergencyWithdraw(1);
    expect(await lp1.balanceOf(bob.address)).to.be.equal('2000');
  });

  it('deposit/withdraw:fail', async () => {
    await chef.add(1000, lp1.address, true, 1);
    await lp1.connect(alice).approve(chef.address, '100');

    await chef.connect(alice).deposit(1, '20');
    await expect(chef.connect(alice).deposit(0, '40'))
      .to.be.revertedWith('deposit PTN by staking');

    await chef.connect(alice).withdraw(1, '10');
    await expect(chef.connect(alice).withdraw(0, '10'))
      .to.be.revertedWith('withdraw PTN by unstaking');
    await expect(chef.connect(alice).withdraw(1, '60'))
      .to.be.revertedWith('withdraw: not good');
    await chef.connect(alice).withdraw(1, '0');
  });

  it('staking/unstaking', async () => {
    await chef.add('1000', lp1.address, true, 1);
    await chef.add('1000', lp2.address, true, 1);
    await chef.add('1000', lp3.address, true, 1);

    await advanceBlockTo(300);

    await lp1.connect(alice).approve(chef.address, '10');
    await chef.connect(alice).deposit(1, '2'); // 0
    await chef.connect(alice).withdraw(1, '2'); // 1

    await ptn.connect(alice).approve(chef.address, '250');
    await chef.connect(alice).enterStaking('240'); // 3
    expect(await ptn.balanceOf(alice.address)).to.be.equal('10');
    await chef.connect(alice).enterStaking('10'); // 4
    expect((await ptn.balanceOf(alice.address)).toString()).to.be.equal('249');
    await chef.connect(alice).leaveStaking('250');
    expect((await ptn.balanceOf(alice.address)).toString()).to.be.equal('748');
    await expect(chef.connect(alice).leaveStaking('260'))
      .to.be.revertedWith('withdraw: not good');
  });

  it('update multiplier', async () => {
    await chef.add('1000', lp1.address, true, 2);
    await chef.add('1000', lp2.address, true, 2);
    await chef.add('1000', lp3.address, true, 2);

    await advanceBlockTo(400);

    await chef.updateMultiplier(0, 0);
    await chef.updateMultiplier(1, 0);

    await lp1.connect(alice).approve(chef.address, '100');
    await lp1.connect(bob).approve(chef.address, '100');
    await chef.connect(alice).deposit(1, '100');
    await chef.connect(bob).deposit(1, '100');
    await chef.connect(alice).deposit(1, 0);
    await chef.connect(bob).deposit(1, 0);

    await ptn.connect(alice).approve(chef.address, '100');
    await ptn.connect(bob).approve(chef.address, '100');

    await chef.connect(alice).enterStaking('50');
    await chef.connect(bob).enterStaking('100');

    await chef.updatePtnPerBlock(0);

    await chef.connect(alice).enterStaking(0);
    await chef.connect(bob).enterStaking(0);
    await chef.connect(alice).deposit(1, '0');
    await chef.connect(bob).deposit(1, '0');

    expect(await ptn.balanceOf(alice.address)).to.be.equal('1083');
    expect(await ptn.balanceOf(bob.address)).to.be.equal('783');

    await advanceBlockTo(500);

    await chef.connect(alice).enterStaking(0);
    await chef.connect(bob).enterStaking(0);

    await chef.connect(alice).deposit(1, 0);
    await chef.connect(bob).deposit(1, 0);
    expect(await ptn.balanceOf(alice.address)).to.be.equal('1083');
    expect(await ptn.balanceOf(bob.address)).to.be.equal('783');

    await chef.connect(alice).leaveStaking('50');
    await chef.connect(bob).leaveStaking('100');
    await chef.connect(alice).withdraw(1, '100');
    await chef.connect(bob).withdraw(1, '100');
  });
});
