module.exports = {
    skipFiles: ['libraries/UQ112x112.sol',
                'tokens/KIP7.sol',
                'tokens/TestToken.sol',
                'tokens/WKLAY.sol',
                'utils/AccessControl.sol',
                'utils/Address.sol',
                'utils/Context.sol',
                'utils/KIP13.sol',
                'utils/Math.sol',
                'utils/Ownable.sol',
                'utils/ReentrancyGuard.sol',
                'utils/SafeCast.sol',
                'utils/Strings.sol',
                'mocks/BabylonianTest.sol',
                'mocks/BitMathTest.sol',
                'mocks/ComputeLiquidityValue.sol',
                'mocks/DeflatingKIP7.sol',
                'mocks/DexKIP7Test.sol',
                'mocks/FixedPointTest.sol',
                'mocks/FullMathTest.sol',
                'mocks/KIP7TestMock.sol',
                'mocks/OracleLibraryTest.sol',
                'farming/MultiCall.sol',
                'farming/StakingFactory.sol',
                'farming/StakingFactoryPool.sol',
                ],
    configureYulOptimizer: false,
    mocha: {
      grep: "@skip-on-coverage", // Find everything with this tag
      invert: true               // Run the grep's inverse set.
    },
    enableTimeouts: false,
  };