import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Contract, BigNumber, constants } from 'ethers';

describe('Babylonian', async () => {
  let babylonian: Contract;

  before('deploy BabylonianTest', async () => {
    const babylonianFactoty = await ethers.getContractFactory('BabylonianTest');
    babylonian = await babylonianFactoty.deploy();
  });

  describe('#sqrt', () => {
    it('works for 0-99', async () => {
      // eslint-disable-next-line no-plusplus
      for (let i = 0; i < 100; i++) {
        // eslint-disable-next-line no-await-in-loop
        expect(await babylonian.sqrt(i)).to.eq(Math.floor(Math.sqrt(i)));
      }
    });

    it('product of numbers close to max uint112', async () => {
      const max = BigNumber.from(2).pow(112).sub(1);
      expect(await babylonian.sqrt(max.mul(max))).to.eq(max);
      const maxMinus1 = max.sub(1);
      expect(await babylonian.sqrt(maxMinus1.mul(maxMinus1))).to.eq(maxMinus1);
      const maxMinus2 = max.sub(2);
      expect(await babylonian.sqrt(maxMinus2.mul(maxMinus2))).to.eq(maxMinus2);

      expect(await babylonian.sqrt(max.mul(maxMinus1))).to.eq(maxMinus1);
      expect(await babylonian.sqrt(max.mul(maxMinus2))).to.eq(maxMinus2);
      expect(await babylonian.sqrt(maxMinus1.mul(maxMinus2))).to.eq(maxMinus2);
    });

    it('max uint256', async () => {
      const expected = BigNumber.from(2).pow(128).sub(1);
      expect(await babylonian.sqrt(constants.MaxUint256)).to.eq(expected);
    });

    it('gas cost', async () => {
      expect(await babylonian.getGasCostOfSqrt(150)).to.eq(1388);
    });

    it('gas cost of large number', async () => {
      expect(await babylonian.getGasCostOfSqrt(BigNumber.from(2).pow(150))).to.eq(1430);
    });

    it('gas cost of max uint', async () => {
      expect(await babylonian.getGasCostOfSqrt(BigNumber.from(2).pow(256).sub(1))).to.eq(1508);
    });
  });
});
