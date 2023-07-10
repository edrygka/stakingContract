// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.20;

interface IStaking {
    // we could use uint128 for stake and snapshot fields and prolly would save some gas
    struct StakeHolder {
        uint stake;
        uint snapshot;
    }

    event Stake(address indexed sender, uint stake);
    event Unstake(address indexed staker, uint amount);
    event Distribute(uint indexed amount);
}
