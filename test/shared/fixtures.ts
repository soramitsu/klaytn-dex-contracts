import { Contract } from 'ethers';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

interface FactoryFixture {
  factory: Contract
}

interface PairFixture extends FactoryFixture {
  factory: Contract
  token0: Contract
  token1: Contract
  pair: Contract
}

interface RouterFixture {
  token0: Contract
  token1: Contract
  WKLAY: Contract
  WKLAYPartner: Contract
  factoryV2: Contract
  router02: Contract
  router: Contract
  pair: Contract
  WKLAYPair: Contract
}

export async function factoryFixture(deployer: SignerWithAddress): Promise<Contract> {
  const Factory = await ethers.getContractFactory('DexFactory');
  const factory = await Factory.deploy(await deployer.getAddress());
  // const factory = await deployContract(wallet, UniswapV2Factory, [wallet.address], overrides);
  return factory;
}

export async function pairFixture(
  deployer: SignerWithAddress,
): Promise<PairFixture> {
  const factory = await factoryFixture(deployer);
  const tokenFactory = await ethers.getContractFactory('KIP7');
  const tokenA = await tokenFactory.deploy(ethers.utils.parseEther('10000'));
  const tokenB = await tokenFactory.deploy(ethers.utils.parseEther('10000'));
  await factory.createPair(tokenA.address, tokenB.address); // overrides
  const pairAddress = await factory.getPair(tokenA.address, tokenB.address);
  const pair = await ethers.getContractAt('DexPair', pairAddress);

  const token0Address = (await pair.token0());
  const token0 = tokenA.address === token0Address ? tokenA : tokenB;
  const token1 = tokenA.address === token0Address ? tokenB : tokenA;

  return {
    factory, token0, token1, pair,
  };
}

export async function routerFixture(deployer: SignerWithAddress): Promise<RouterFixture> {
  // deploy tokens
  const tokenFactory = await ethers.getContractFactory('KIP7');
  const WKLAY9Factory = await ethers.getContractFactory('WETH9');
  const tokenA = await tokenFactory.deploy(ethers.utils.parseEther('10000'));
  const tokenB = await tokenFactory.deploy(ethers.utils.parseEther('10000'));
  const WKLAY = await WKLAY9Factory.deploy();
  const WKLAYPartner = await tokenFactory.deploy(ethers.utils.parseEther('10000'));

  // deploy V2
  const Factory = await ethers.getContractFactory('DexFactory');
  const factoryV2 = await Factory.deploy(await deployer.getAddress());

  // deploy router
  const routerFactory = await ethers.getContractFactory('DexRouter');
  const router02 = await routerFactory.deploy(factoryV2.address, WKLAY.address);

  // initialize V2
  await factoryV2.createPair(tokenA.address, tokenB.address);
  const pairAddress = await factoryV2.getPair(tokenA.address, tokenB.address);
  const pair = await ethers.getContractAt('DexPair', pairAddress);

  const token0Address = await pair.token0();
  const token0 = tokenA.address === token0Address ? tokenA : tokenB;
  const token1 = tokenA.address === token0Address ? tokenB : tokenA;

  await factoryV2.createPair(WKLAY.address, WKLAYPartner.address);
  const WKLAYPairAddress = await factoryV2.getPair(WKLAY.address, WKLAYPartner.address);
  const WKLAYPair = await ethers.getContractAt('DexPair', WKLAYPairAddress);

  return {
    token0,
    token1,
    WKLAY,
    WKLAYPartner,
    factoryV2,
    router02,
    router: router02, // the default router, 01 had a minor bug
    pair,
    WKLAYPair,
  };
}
