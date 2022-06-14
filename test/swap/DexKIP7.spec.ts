import { expect } from 'chai';
import { ethers } from 'hardhat';
import * as dotenv from 'dotenv';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  keccak256, defaultAbiCoder, toUtf8Bytes, hexlify,
} from 'ethers/lib/utils';
import { constants } from 'ethers';
import { ecsign } from 'ethereumjs-util';
import { getApprovalDigest } from '../shared/utilities';
import { factoryFixture } from '../shared/fixtures';
import { DexKIP7Test } from '../../typechain/mocks/DexKIP7Test';
import { DexKIP7Test__factory } from '../../typechain/factories/mocks/DexKIP7Test__factory';

dotenv.config();

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
    expect(name).to.eq('DEXswap');
    expect(await token.symbol()).to.eq('KlayLP');
    expect(await token.decimals()).to.eq(18);
    expect(await token.totalSupply()).to.eq(TOTAL_SUPPLY);
    expect(await token.balanceOf(wallet.address)).to.eq(TOTAL_SUPPLY);
    expect(await token.DOMAIN_SEPARATOR()).to.eq(
      keccak256(
        defaultAbiCoder.encode(
          ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
          [
            keccak256(
              toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'),
            ),
            keccak256(toUtf8Bytes(name)),
            keccak256(toUtf8Bytes('1')),
            31337,
            token.address,
          ],
        ),
      ),
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
      .to.be.revertedWith("Transaction reverted: function selector was not recognized and there's no fallback function");
  });

  it('transfer:fail', async () => {
    await expect(token.transfer(
      other.address,
      TOTAL_SUPPLY.add(1),
    )).to.be.reverted; // ds-math-sub-underflow
    await expect(token.connect(other)
      .transfer(wallet.address, 1)).to.be.reverted; // ds-math-sub-underflow
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

  it('safeTransferFrom:fail', async () => {
    await expect(token['safeTransferFrom(address,address,uint256)'](wallet.address, other.address, TEST_AMOUNT))
      .to.be.revertedWith('KIP7: insufficient allowance');
    await expect(token['safeTransferFrom(address,address,uint256)'](constants.AddressZero, other.address, TEST_AMOUNT))
      .to.be.revertedWith('KIP7: transfer from the zero address');
    await expect(token['safeTransferFrom(address,address,uint256)'](wallet.address, constants.AddressZero, TEST_AMOUNT))
      .to.be.revertedWith('KIP7: transfer to the zero address');
  });

  it('permit', async () => {
    const nonce = await token.nonces(wallet.address);
    const deadline = constants.MaxUint256;
    const digest = await getApprovalDigest(
      token,
      { owner: wallet.address, spender: other.address, value: TEST_AMOUNT },
      nonce.toNumber(),
      deadline,
      31337,
    );
    const signer = new ethers.Wallet(process.env.HH_PIVATE_KEY as string);
    const { v, r, s } = ecsign(
      Buffer.from(digest.slice(2), 'hex'),
      Buffer.from(signer.privateKey.slice(2), 'hex'),
    );
    // 0xFe22AB221aDD716D6CBB1a153E6f20B30F9cde69
    await expect(token.permit(
      wallet.address,
      other.address,
      TEST_AMOUNT,
      deadline,
      v,
      hexlify(r),
      hexlify(s),
    ))
      .to.emit(token, 'Approval')
      .withArgs(wallet.address, other.address, TEST_AMOUNT);
    expect(await token.allowance(wallet.address, other.address)).to.eq(TEST_AMOUNT);
    expect(await token.nonces(wallet.address)).to.eq(1);
  });

  it('permit:fail expired', async () => {
    const nonce = await token.nonces(wallet.address);
    const blockNumBefore = await ethers.provider.getBlockNumber();
    const deadline = (await ethers.provider.getBlock(blockNumBefore)).timestamp - 1;
    const digest = await getApprovalDigest(
      token,
      { owner: wallet.address, spender: other.address, value: TEST_AMOUNT },
      nonce.toNumber(),
      deadline,
      31337,
    );
    const signer = new ethers.Wallet(process.env.HH_PIVATE_KEY as string);
    const { v, r, s } = ecsign(
      Buffer.from(digest.slice(2), 'hex'),
      Buffer.from(signer.privateKey.slice(2), 'hex'),
    );
    // 0xFe22AB221aDD716D6CBB1a153E6f20B30F9cde69
    await expect(token.permit(
      wallet.address,
      other.address,
      TEST_AMOUNT,
      deadline,
      v,
      hexlify(r),
      hexlify(s),
    )).to.be.revertedWith('DEX: EXPIRED');
  });

  it('permit:fail invalid signature', async () => {
    const nonce = await token.nonces(wallet.address);
    const deadline = constants.MaxUint256;
    const digest = await getApprovalDigest(
      token,
      { owner: wallet.address, spender: other.address, value: TEST_AMOUNT },
      nonce.toNumber(),
      deadline,
      31335,
    );
    const signer = new ethers.Wallet(process.env.HH_PIVATE_KEY as string);
    const { v, r, s } = ecsign(
      Buffer.from(digest.slice(2), 'hex'),
      Buffer.from(signer.privateKey.slice(2), 'hex'),
    );
    // 0xFe22AB221aDD716D6CBB1a153E6f20B30F9cde69
    await expect(token.permit(
      wallet.address,
      other.address,
      TEST_AMOUNT,
      deadline,
      v,
      hexlify(r),
      hexlify(s),
    )).to.be.revertedWith('DEX: INVALID_SIGNATURE');
  });
});
