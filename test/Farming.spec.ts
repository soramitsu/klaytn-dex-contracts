import { ethers } from 'hardhat';
import { expect } from 'chai';
import { Contract, ContractFactory } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { advanceBlockTo } from './shared/utilities';

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
  let bn: number;
  beforeEach(async () => {
    [minter, alice, bob] = await ethers.getSigners();
    bn = (await ethers.provider.getBlock('latest')).number;
    const ptnFactory = await ethers.getContractFactory('PlatformToken');
    lpFactory = await ethers.getContractFactory('DexKIP7Test');
    const farmingFactory = await ethers.getContractFactory('Farming');
    ptn = await ptnFactory.deploy();
    lp1 = await lpFactory.deploy('1000000');
    lp2 = await lpFactory.deploy('1000000');
    lp3 = await lpFactory.deploy('1000000');
    chef = await farmingFactory.deploy(ptn.address, 1000, bn);
    await ptn.transferOwnership(chef.address);
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
    await chef.add('2000', lp1.address, true);
    await chef.add('1000', lp2.address, true);
    await chef.add('500', lp3.address, true);
    await chef.add('500', lp4.address, true);
    await chef.add('500', lp5.address, true);
    await chef.add('500', lp6.address, true);
    await chef.add('500', lp7.address, true);
    await chef.add('100', lp8.address, true);
    await chef.add('100', lp9.address, true);
    expect(await chef.poolLength()).to.be.equal(10);

    await advanceBlockTo(bn + 70);
    await lp1.connect(alice).approve(chef.address, '1000');
    expect(await ptn.balanceOf(alice.address)).to.be.equal(0);
    await chef.connect(alice).deposit(1, '20');
    await chef.connect(alice).withdraw(1, '20');
    expect(await ptn.balanceOf(alice.address)).to.be.equal('263');

    await ptn.connect(alice).approve(chef.address, '1000');
    await chef.connect(alice).enterStaking('20');
    await chef.connect(alice).enterStaking(0);
    await chef.connect(alice).enterStaking(0);
    await chef.connect(alice).enterStaking(0);
    expect((await ptn.balanceOf(alice.address)).toString()).to.be.equal('993');
  });

  it('deposit/withdraw', async () => {
    await chef.add(1000, lp1.address, true);
    await chef.add(1000, lp2.address, true);
    await chef.add(1000, lp3.address, true);

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

  it('staking/unstaking', async () => {
    await chef.add('1000', lp1.address, true);
    await chef.add('1000', lp2.address, true);
    await chef.add('1000', lp3.address, true);

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
  });

  it('updaate multiplier', async () => {
    await chef.add('1000', lp1.address, true);
    await chef.add('1000', lp2.address, true);
    await chef.add('1000', lp3.address, true);

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
    await chef.updateMultiplier('0');

    await chef.connect(alice).enterStaking(0);
    await chef.connect(bob).enterStaking(0);
    await chef.connect(alice).deposit(1, '0');
    await chef.connect(bob).deposit(1, '0');
    expect(await ptn.balanceOf(alice.address)).to.be.equal('455');
    expect(await ptn.balanceOf(bob.address)).to.be.equal('150');

    await advanceBlockTo(bn + 165);

    await chef.connect(alice).enterStaking(0);
    await chef.connect(bob).enterStaking(0);
    await chef.connect(alice).deposit(1, 0);
    await chef.connect(bob).deposit(1, 0);
    expect(await ptn.balanceOf(alice.address)).to.be.equal('455');
    expect(await ptn.balanceOf(bob.address)).to.be.equal('150');

    await chef.connect(alice).leaveStaking('50');
    await chef.connect(bob).leaveStaking('100');
    await chef.connect(alice).withdraw(1, '100');
    await chef.connect(bob).withdraw(1, '100');
  });
});
