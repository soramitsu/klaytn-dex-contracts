import { expect } from 'chai';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  keccak256, toUtf8Bytes,
} from 'ethers/lib/utils';
import { constants } from 'ethers';
import { getPermitSignature, getDomainSeparator } from '../shared/utilities';
import { factoryFixture } from '../shared/fixtures';
import { DexKIP7Test } from '../../typechain/contracts/mocks/DexKIP7Test';
import { DexKIP7Test__factory } from '../../typechain/factories/contracts/mocks/DexKIP7Test__factory';

const TOTAL_SUPPLY = ethers.utils.parseEther('10000');
const TEST_AMOUNT = ethers.utils.parseEther('10');

describe('DexKIP7', () => {
  let tokenFactory: DexKIP7Test__factory;
  let token: DexKIP7Test;
  let wallet: SignerWithAddress;
  let other: SignerWithAddress;
  beforeEach(async () => {
    [wallet, other] = await ethers.getSigners();
    tokenFactory = await ethers.getContractFactory('DexKIP7Test');
    token = await tokenFactory.deploy(TOTAL_SUPPLY);
  });

  it('name, symbol, decimals, totalSupply, balanceOf, DOMAIN_SEPARATOR, PERMIT_TYPEHASH', async () => {
    const name = await token.name();
    const separator = getDomainSeparator(name, '1', 31337, token.address);
    expect(name).to.eq('DEXswap');
    expect(await token.symbol()).to.eq('KlayLP');
    expect(await token.decimals()).to.eq(18);
    expect(await token.totalSupply()).to.eq(TOTAL_SUPPLY);
    expect(await token.balanceOf(wallet.address)).to.eq(TOTAL_SUPPLY);
    expect(await token.DOMAIN_SEPARATOR()).to.eq(
      separator,
    );
    expect(await token.PERMIT_TYPEHASH()).to.eq(
      keccak256(toUtf8Bytes('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)')),
    );
  });

  it('approve', async () => {
    await expect(token.approve(other.address, TEST_AMOUNT))
      .to.emit(token, 'Approval')
      .withArgs(wallet.address, other.address, TEST_AMOUNT);
    expect(await token.allowance(wallet.address, other.address)).to.eq(TEST_AMOUNT);
  });

  it('supportInterface', async () => {
    // KIP-13 Identifiers can be found https://kips.klaytn.foundation/KIPs/kip-7
    expect(await token.supportsInterface('0x65787371')).to.eq(true); // 0x65787371 is IKIP7 interfaceID
    expect(await token.supportsInterface('0xa219a025')).to.eq(true); // 0xa219a025 is IKIP7Metadata interfaceID
    expect(await token.supportsInterface('0x9d188c22')).to.eq(false); // 0x9d188c22 is IKIP7TokenReceiver interfaceID
  });

  it('transfer', async () => {
    await expect(token.transfer(other.address, TEST_AMOUNT))
      .to.emit(token, 'Transfer')
      .withArgs(wallet.address, other.address, TEST_AMOUNT);
    expect(await token.balanceOf(wallet.address)).to.eq(TOTAL_SUPPLY.sub(TEST_AMOUNT));
    expect(await token.balanceOf(other.address)).to.eq(TEST_AMOUNT);
  });

  it('safeTransfer:fail', async () => {
    await expect(token['safeTransfer(address,uint256)'](constants.AddressZero, TEST_AMOUNT))
      .to.be.revertedWith('KIP7: transfer to the zero address');
    const { factory } = await factoryFixture(wallet);
    await expect(token['safeTransfer(address,uint256)'](factory.address, TEST_AMOUNT))
      .to.be.rejectedWith("Transaction reverted: function selector was not recognized and there's no fallback function");
  });

  it('safeTransfer:to the contract', async () => {
    const kip7Holder = await (await ethers.getContractFactory('KIP7Holder')).deploy();
    await token['safeTransfer(address,uint256)'](kip7Holder.address, TEST_AMOUNT);
    expect(await token.balanceOf(wallet.address)).to.eq(TOTAL_SUPPLY.sub(TEST_AMOUNT));
    expect(await token.balanceOf(kip7Holder.address)).to.eq(TEST_AMOUNT);
  });

  it('transfer:fail', async () => {
    await expect(token.transfer(
      other.address,
      TOTAL_SUPPLY.add(1),
    )).to.be.reverted; // ds-math-sub-underflow
    await expect(token.connect(other)
      .transfer(wallet.address, 1)).to.be.reverted; // ds-math-sub-underflow
    await expect(token.transfer(
      constants.AddressZero,
      TEST_AMOUNT,
    )).to.be.revertedWith('KIP7: transfer to the zero address');
  });

  it('transferFrom', async () => {
    await token.approve(other.address, TEST_AMOUNT);
    await expect(token.connect(other).transferFrom(wallet.address, other.address, TEST_AMOUNT))
      .to.emit(token, 'Transfer')
      .withArgs(wallet.address, other.address, TEST_AMOUNT);
    expect(await token.allowance(wallet.address, other.address)).to.eq(0);
    expect(await token.balanceOf(wallet.address)).to.eq(TOTAL_SUPPLY.sub(TEST_AMOUNT));
    expect(await token.balanceOf(other.address)).to.eq(TEST_AMOUNT);
  });

  it('transferFrom:max', async () => {
    await token.approve(other.address, constants.MaxUint256);
    await expect(token.connect(other).transferFrom(wallet.address, other.address, TEST_AMOUNT))
      .to.emit(token, 'Transfer')
      .withArgs(wallet.address, other.address, TEST_AMOUNT);
    expect(await token.allowance(wallet.address, other.address)).to.eq(constants.MaxUint256);
    expect(await token.balanceOf(wallet.address)).to.eq(TOTAL_SUPPLY.sub(TEST_AMOUNT));
    expect(await token.balanceOf(other.address)).to.eq(TEST_AMOUNT);
  });

  it('transferFrom:fail', async () => {
    await token.approve(other.address, TEST_AMOUNT);
    await expect(token.connect(other).transferFrom(
      constants.AddressZero,
      other.address,
      TEST_AMOUNT,
    )).to.be.revertedWith('KIP7: insufficient allowance');
  });

  it('safeTransferFrom', async () => {
    await token.approve(other.address, TEST_AMOUNT);
    await expect(token.connect(other)['safeTransferFrom(address,address,uint256)'](wallet.address, other.address, TEST_AMOUNT))
      .to.emit(token, 'Transfer')
      .withArgs(wallet.address, other.address, TEST_AMOUNT);
    expect(await token.allowance(wallet.address, other.address)).to.eq(0);
    expect(await token.balanceOf(wallet.address)).to.eq(TOTAL_SUPPLY.sub(TEST_AMOUNT));
    expect(await token.balanceOf(other.address)).to.eq(TEST_AMOUNT);
  });

  it('safeTransferFrom:max', async () => {
    await token.approve(other.address, constants.MaxUint256);
    await expect(token.connect(other)['safeTransferFrom(address,address,uint256)'](wallet.address, other.address, TEST_AMOUNT))
      .to.emit(token, 'Transfer')
      .withArgs(wallet.address, other.address, TEST_AMOUNT);
    expect(await token.allowance(wallet.address, other.address)).to.eq(constants.MaxUint256);
    expect(await token.balanceOf(wallet.address)).to.eq(TOTAL_SUPPLY.sub(TEST_AMOUNT));
    expect(await token.balanceOf(other.address)).to.eq(TEST_AMOUNT);
  });

  it('safeTransferFrom:fail', async () => {
    await expect(token['safeTransferFrom(address,address,uint256)'](wallet.address, other.address, TEST_AMOUNT))
      .to.be.revertedWith('KIP7: insufficient allowance');
    await expect(token['safeTransferFrom(address,address,uint256)'](constants.AddressZero, other.address, TEST_AMOUNT))
      .to.be.revertedWith('KIP7: insufficient allowance');
    await token.approve(other.address, constants.MaxUint256);
    await expect(token.connect(other)['safeTransferFrom(address,address,uint256)'](wallet.address, constants.AddressZero, TEST_AMOUNT))
      .to.be.revertedWith('KIP7: transfer to the zero address');
    await expect(token.connect(other)['safeTransferFrom(address,address,uint256)'](wallet.address, token.address, TEST_AMOUNT))
      .to.be.rejectedWith("Transaction reverted: function selector was not recognized and there's no fallback function");
  });

  it('permit', async () => {
    const nonce = await token.nonces(wallet.address);
    const deadline = constants.MaxUint256;
    const signature = await getPermitSignature(
      wallet,
      token,
      31337,
      {
        owner: wallet.address, spender: other.address, value: TEST_AMOUNT, nonce, deadline,
      },
    );
    const sigSplit = ethers.utils.splitSignature(
      ethers.utils.arrayify(signature),
    );

    await expect(token.permit(
      wallet.address,
      other.address,
      TEST_AMOUNT,
      deadline,
      sigSplit.v,
      sigSplit.r,
      sigSplit.s,
    ))
      .to.emit(token, 'Approval')
      .withArgs(wallet.address, other.address, TEST_AMOUNT);
    expect(await token.allowance(wallet.address, other.address)).to.eq(TEST_AMOUNT);
    expect(await token.nonces(wallet.address)).to.eq(1);
  });

  it('permit:fail expired', async () => {
    const nonce = await token.nonces(wallet.address);
    const blockNumBefore = await ethers.provider.getBlockNumber();
    const deadline = ethers.BigNumber.from((
      await ethers.provider.getBlock(blockNumBefore)).timestamp - 1);
    const signature = await getPermitSignature(
      wallet,
      token,
      31337,
      {
        owner: wallet.address, spender: other.address, value: TEST_AMOUNT, nonce, deadline,
      },
    );
    const sigSplit = ethers.utils.splitSignature(
      ethers.utils.arrayify(signature),
    );

    await expect(token.permit(
      wallet.address,
      other.address,
      TEST_AMOUNT,
      deadline,
      sigSplit.v,
      sigSplit.r,
      sigSplit.s,
    )).to.be.revertedWith('DEX: EXPIRED');
  });

  it('permit:fail invalid signature', async () => {
    const nonce = await token.nonces(wallet.address);
    const deadline = constants.MaxUint256;
    const signature = await getPermitSignature(
      wallet,
      token,
      31335,
      {
        owner: wallet.address, spender: other.address, value: TEST_AMOUNT, nonce, deadline,
      },
    );
    const sigSplit = ethers.utils.splitSignature(
      ethers.utils.arrayify(signature),
    );

    await expect(token.permit(
      wallet.address,
      other.address,
      TEST_AMOUNT,
      deadline,
      sigSplit.v,
      sigSplit.r,
      sigSplit.s,
    )).to.be.revertedWith('DEX: INVALID_SIGNATURE');
  });
});
