import { DexFactory } from '../../typechain/DexFactory';
import { DexPair } from '../../typechain/DexPair';
import { KIP7Mock } from '../../typechain/KIP7Mock';
import { DexRouter } from '../../typechain/DexRouter';
import { WETH9 } from '../../typechain/WETH9';

export interface FactoryFixture {
    factory: DexFactory
}

export interface PairFixture extends FactoryFixture {
    token0: KIP7Mock
    token1: KIP7Mock
    pair: DexPair
}

export interface RouterFixture {
    token0: KIP7Mock
    token1: KIP7Mock
    WKLAY: WETH9
    WKLAYPartner: KIP7Mock
    factory: DexFactory
    router: DexRouter
    pair: DexPair
    WKLAYPair: DexPair
}

export interface Operation
{
  id: string
  target: string
  value: string | number
  data: string;
  predecessor: string
  salt: string
}

export interface BatchOperation
{
  id: string
  targets: string[]
  values: string[] | number[]
  datas: string[];
  predecessor: string
  salt: string
}
