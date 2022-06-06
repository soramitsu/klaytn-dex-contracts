import { ethers } from 'hardhat';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { MultiSigWallet__factory } from '../typechain/factories/MultiSigWallet__factory';
import { MultiSigWallet } from '../typechain/MultiSigWallet';

describe('Multisig', () => {
  let owner: SignerWithAddress;
  let owner2: SignerWithAddress;
  let owner3: SignerWithAddress;
  let owner4: SignerWithAddress;
  let owner5: SignerWithAddress;
  let wallet: MultiSigWallet;
  let Wallet: MultiSigWallet__factory;
  // let chainId: number;

  before(async () => {
    [owner, owner2, owner3, owner4, owner5] = await ethers.getSigners();
    Wallet = await ethers.getContractFactory('MultiSigWallet');
  });

  describe('Should remove owner', () => {
    before(async () => {
      wallet = await Wallet.deploy([owner.address, owner2.address,
        owner3.address, owner4.address, owner5.address], 3);
      await wallet.deployed();
    });
    it('should submit transaction', async () => {
      const transaction = wallet.interface.encodeFunctionData('removeOwner', [owner5.address]);
      expect(await wallet.submitTransaction(wallet.address, 0, transaction))
        .to.emit(wallet, 'Submission')
        .withArgs(0)
        .to.emit(wallet, 'Confirmation')
        .withArgs(0);
      expect(await wallet.getTransactionInfo(0))
        .to.be.deep.equal([wallet.address, BigNumber.from(0),
          transaction, false, BigNumber.from(1)]);
      expect(await wallet.getTransactionCount(true, false))
        .to.be.equal(1);
    });
    it('should confirm transaction', async () => {
      const transaction = wallet.interface.encodeFunctionData('removeOwner', [owner5.address]);
      expect(await wallet.connect(owner3).confirmTransaction(0))
        .to.emit(wallet, 'Confirmation')
        .withArgs(0);
      expect(await wallet.getTransactionInfo(0))
        .to.be.deep.equal([wallet.address, BigNumber.from(0),
          transaction, false, BigNumber.from(2)]);
      expect(await wallet.getConfirmations(0)).to.be.deep.equal([owner.address, owner3.address]);
    });
    it('should reject if owner confirmed', async () => {
      await expect(wallet.connect(owner3).confirmTransaction(0)).to.be.revertedWith('Already confirmed');
      expect(await wallet.getConfirmations(0)).to.be.deep.equal([owner.address, owner3.address]);
    });
    it('should execute transaction', async () => {
      const transaction = wallet.interface.encodeFunctionData('removeOwner', [owner5.address]);
      expect(await wallet.getTransactionCount(true, false))
        .to.be.equal(1);
      const ownersBefore: string[] = await wallet.getOwners();

      expect(await wallet.connect(owner4).confirmTransaction(0))
        .to.emit(wallet, 'Confirmation')
        .withArgs(0)
        .to.emit(wallet, 'Execution')
        .withArgs(0)
        .to.emit(wallet, 'OwnerRemoval')
        .withArgs(owner5.address);

      const ownersAfter: string[] = await wallet.getOwners();
      expect(await wallet.getTransactionInfo(0))
        .to.be.deep.equal([wallet.address, BigNumber.from(0),
          transaction, true, BigNumber.from(3)]);
      expect(await wallet.getConfirmations(0))
        .to.be.deep.equal([owner.address, owner3.address, owner4.address]);
      expect(await wallet.getTransactionCount(false, true))
        .to.be.equal(1);
      expect(ownersAfter)
        .to.be.deep.equal(ownersBefore.filter((a) => a !== owner5.address));
    });
  });
});
