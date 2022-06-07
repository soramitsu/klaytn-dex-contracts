import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect, assert } from 'chai';
import { StakingFactory__factory } from '../../typechain/factories/StakingFactory__factory';
import { KIP7Mock__factory } from '../../typechain/factories/KIP7Mock__factory';
import { StakingFactory } from '../../typechain/StakingFactory';
import { StakingInitializable } from '../../typechain/StakingInitializable';
import { KIP7Mock } from '../../typechain/KIP7Mock';
import { advanceBlockTo } from '../shared/utilities';

describe('Smart Chef Factory', () => {
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;
  let david: SignerWithAddress;
  let erin: SignerWithAddress;
  let SmartChefFactory: StakingFactory__factory;
  let MockERC20: KIP7Mock__factory;
  let blockNumber;
  let startBlock: any;
  let endBlock: any;

  const poolLimitPerUser = parseEther('0');
  const rewardPerBlock = parseEther('10');

  // Contracts
  // let fakeCake: DexKIP7Test;
  let mockCAKE: KIP7Mock;
  let mockPT: KIP7Mock;
  let smartChef: StakingInitializable;
  let smartChefFactory: StakingFactory;

  // Generic result variable
  let result: any;

  before(async () => {
    [alice, bob, carol, david, erin] = await ethers.getSigners();
    SmartChefFactory = await ethers.getContractFactory('StakingFactory');
    MockERC20 = await ethers.getContractFactory('KIP7Mock');
    blockNumber = await ethers.provider.getBlockNumber();
    startBlock = ethers.BigNumber.from(blockNumber).add(ethers.BigNumber.from(100));
    endBlock = ethers.BigNumber.from(blockNumber).add(ethers.BigNumber.from(500));

    mockCAKE = await MockERC20.deploy(parseEther('1000000'));

    mockPT = await MockERC20.deploy(parseEther('4000'));

    // Fake $Cake Token
    // fakeCake = await MockERC20.deploy(parseEther('100'));

    smartChefFactory = await SmartChefFactory.deploy();
  });

  describe('SMART CHEF #1 - NO POOL LIMIT', async () => {
    it('Deploy pool with SmartChefFactory', async () => {
      const address = await (await smartChefFactory.deployPool(
        mockCAKE.address,
        mockPT.address,
        rewardPerBlock,
        startBlock,
        endBlock,
        poolLimitPerUser,
        0,
        alice.address,
      )).wait();
      smartChef = await ethers.getContractAt('StakingInitializable', address.logs[1].address);
    });

    it('Initial parameters are correct', async () => {
      expect(await smartChef.PRECISION_FACTOR()).to.be.equal('1000000000000');
      expect(await smartChef.lastRewardBlock()).to.be.equal(startBlock);
      assert.equal(String(await smartChef.rewardPerBlock()), rewardPerBlock.toString());
      assert.equal(String(await smartChef.poolLimitPerUser()), poolLimitPerUser.toString());
      assert.equal(String(await smartChef.startBlock()), startBlock.toString());
      assert.equal(String(await smartChef.bonusEndBlock()), endBlock.toString());
      assert.equal(await smartChef.hasUserLimit(), false);
      assert.equal(await smartChef.owner(), alice.address);

      // Transfer 4000 PT token to the contract (400 blocks with 10 PT/block)
      await mockPT.transfer(smartChef.address, parseEther('4000'));
    });

    it('Users deposit', async () => {
      for (const thisUser of [bob, carol, david, erin]) {
        // eslint-disable-next-line no-await-in-loop
        await mockCAKE.transfer(thisUser.address, parseEther('1000'));
        // eslint-disable-next-line no-await-in-loop
        await mockCAKE.connect(thisUser).approve(smartChef.address, parseEther('1000'));
        // eslint-disable-next-line no-await-in-loop
        await smartChef.connect(thisUser).deposit(parseEther('100'));
        // expectEvent(result, 'Deposit', { user: thisUser, amount: String(parseEther('100')) });
        // eslint-disable-next-line no-await-in-loop
        assert.equal(String(await smartChef.pendingReward(thisUser.address)), '0');
      }
    });

    it('Advance to startBlock', async () => {
      await advanceBlockTo(startBlock.toNumber());
      assert.equal(String(await smartChef.pendingReward(bob.address)), '0');
    });

    it('Advance to startBlock + 1', async () => {
      await advanceBlockTo((startBlock.add(ethers.BigNumber.from(1))).toNumber());
      assert.equal(String(await smartChef.pendingReward(bob.address)), String(parseEther('2.5')));
    });

    it('Advance to startBlock + 10', async () => {
      await advanceBlockTo((startBlock.add(ethers.BigNumber.from(10))).toNumber());
      assert.equal(String(await smartChef.pendingReward(carol.address)), String(parseEther('25')));
    });

    it('Carol can withdraw', async () => {
      result = await smartChef.connect(carol).withdraw(parseEther('50'));
      // expectEvent(result, 'Withdraw', { user: carol, amount: String(parseEther('50')) });
      // She harvests 11 blocks --> 10/4 * 11 = 27.5 PT tokens
      assert.equal(String(await mockPT.balanceOf(carol.address)), String(parseEther('27.5')));
      assert.equal(String(await smartChef.pendingReward(carol.address)), String(parseEther('0')));
    });

    it('Can collect rewards by calling deposit with amount = 0', async () => {
      result = await smartChef.connect(carol).deposit(parseEther('0'));
      // expectEvent(result, 'Deposit', { user: carol, amount: String(parseEther('0')) });
      assert.equal(String(await mockPT.balanceOf(carol.address)), String(parseEther('28.92857142855')));
    });

    it('Can collect rewards by calling withdraw with amount = 0', async () => {
      result = await smartChef.connect(carol).withdraw(parseEther('0'));
      // expectEvent(result, 'Withdraw', { user: carol, amount: String(parseEther('0')) });
      assert.equal(String(await mockPT.balanceOf(carol.address)), String(parseEther('30.3571428571')));
    });

    it('Carol cannot withdraw more than she had', async () => {
      // await expectRevert(smartChef.withdraw(parseEther('70')), 'Amount to withdraw too high');
    });

    it('Admin cannot set a limit', async () => {
      // await expectRevert(smartChef.updatePoolLimitPerUser(true, parseEther('1')), 'Must be set');
    });

    it('Cannot change after start reward per block, nor start block or end block', async () => {
      // await expectRevert(smartChef.updateRewardPerBlock(parseEther('1')), 'Pool has started');
      // await expectRevert(smartChef.updateStartAndEndBlocks('1', '10'), 'Pool has started');
    });

    // it('Advance to end of IFO', async () => {
    //   await time.advanceBlockTo(endBlock);

    //   for (const thisUser of [bob, david, erin]) {
    //     await smartChef.withdraw(parseEther('100'), { from: thisUser });
    //   }
    //   await smartChef.withdraw(parseEther('50'), { from: carol });

    //   // 0.000000001 PT token
    //   assert.isAtMost(Number(await mockPT.balanceOf(smartChef.address)), 1000000000);
    // });

    // it('Cannot deploy a pool with SmartChefFactory if not owner', async () => {
    //   await expectRevert(
    //     smartChefFactory.deployPool(
    //       mockCAKE.address,
    //       mockPT.address,
    //       rewardPerBlock,
    //       startBlock,
    //       endBlock,
    //       poolLimitPerUser,
    //       0,
    //       pancakeProfile.address,
    //       true,
    //       0,
    //       bob,
    //       { from: bob },
    //     ),
    //     'Ownable: caller is not the owner',
    //   );
    // });

    // it('Cannot deploy a pool with wrong tokens', async () => {
    //   await expectRevert(
    //     smartChefFactory.deployPool(
    //       mockCAKE.address,
    //       mockCAKE.address,
    //       rewardPerBlock,
    //       startBlock,
    //       endBlock,
    //       poolLimitPerUser,
    //       0,
    //       pancakeProfile.address,
    //       true,
    //       0,
    //       alice,
    //       { from: alice },
    //     ),
    //     'Tokens must be be different',
    //   );

    //   await expectRevert(
    //     smartChefFactory.deployPool(
    //       mockCAKE.address,
    //       smartChef.address,
    //       rewardPerBlock,
    //       startBlock,
    //       endBlock,
    //       poolLimitPerUser,
    //       0,
    //       pancakeProfile.address,
    //       true,
    //       0,
    //       alice,
    //       { from: alice },
    //     ),
    //     "function selector was not recognized and there's no fallback function",
    //   );

    //   await expectRevert(
    //     smartChefFactory.deployPool(
    //       alice,
    //       mockCAKE.address,
    //       rewardPerBlock,
    //       startBlock,
    //       endBlock,
    //       poolLimitPerUser,
    //       0,
    //       pancakeProfile.address,
    //       true,
    //       0,
    //       alice,
    //       { from: alice },
    //     ),
    //     'function call to a non-contract account',
    //   );
    // });
  });

//   describe('Owner can use recoverToken', async () => {
//     const amount = parseEther('100').toString();

//     it('Owner can recover token', async () => {
//       await fakeCake.transfer(smartChef.address, amount, { from: alice });

//       result = await smartChef.recoverToken(fakeCake.address, { from: alice });

//       expectEvent(result, 'TokenRecovery', {
//         token: fakeCake.address,
//         amount,
//       });

//       expectEvent.inTransaction(result.receipt.transactionHash, fakeCake, 'Transfer', {
//         from: smartChef.address,
//         to: alice,
//         value: amount,
//       });
//     });

//     it('Owner cannot recover token if balance is zero', async () => {
//       await expectRevert(
//         smartChef.recoverToken(fakeCake.address, { from: alice }),
//         'Operations: Cannot recover zero balance',
//       );
//     });

//     it('Owner cannot recover staked token', async () => {
//       await expectRevert(
//         smartChef.recoverToken(mockCAKE.address, { from: alice }),
//         'Operations: Cannot recover staked token',
//       );
//     });

//     it('Owner cannot recover reward token', async () => {
//       await expectRevert(
//         smartChef.recoverToken(mockPT.address, { from: alice }),
//         'Operations: Cannot recover reward token',
//       );
//     });
//   });
});
