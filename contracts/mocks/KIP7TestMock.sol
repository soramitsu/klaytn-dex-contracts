// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import '../DexKIP7.sol';

contract KIP7 is DexKIP7 {
    constructor(uint _totalSupply) {
        _mint(msg.sender, _totalSupply);
    }
}
