//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IStaking} from "./interfaces/IStaking.sol";

contract Staking is IStaking, Ownable {
    using SafeERC20 for IERC20;

    uint public constant FACTOR = 1e18;

    IERC20 public stakingToken;

    uint public allActiveStakes;
    uint public rewardPerStakeUnit;

    mapping(address => StakeHolder) public stakeHolders;

    /**
     * @dev Initializes interface to token we are going to interact with
     * @param _stakingToken its token address to stake
     */
    constructor(IERC20 _stakingToken) {
        stakingToken = _stakingToken;
    }

    /**
     * @dev Stake specific amount (`amount`) of tokens from caller address to contract address
     * User can't stae twice
     * @param _amount amount of tokens to stake
     */
    function stake(uint _amount) external {
        require(_amount != 0, "Staking: NOT ZERO");
        StakeHolder storage holder = stakeHolders[msg.sender];
        require(holder.stake == 0, "Staking: ALREADY EXIST");

        holder.stake = _amount;
        holder.snapshot = rewardPerStakeUnit;

        allActiveStakes += _amount;
        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);
        emit Stake(msg.sender, _amount);
    }

    /**
     * @dev Returns reward for the particular stake holder (`StakeHolder`)
     * using decimals to bring values back to normal format
     */
    function _calculateReward(
        StakeHolder memory _stakeHolder
    ) private view returns (uint) {
        return
            _stakeHolder.stake +
            (_stakeHolder.stake *
                (rewardPerStakeUnit - _stakeHolder.snapshot)) /
            FACTOR;
    }

    /**
     * @dev Distributes reward (`reward`) proportionally to all stakers
     * multiply float value by decimals to not to lose fractional part
     * @param _reward amount of tokens to be distributed
     */
    function distribute(uint _reward) external onlyOwner {
        require(allActiveStakes != 0, "Staking: NO STAKERS");

        rewardPerStakeUnit += (_reward * FACTOR) / allActiveStakes;
        stakingToken.safeTransferFrom(msg.sender, address(this), _reward);

        emit Distribute(_reward);
    }

    /**
     * @dev Unstake all tokens the user received during staking period
     */
    function unstake() public {
        StakeHolder storage holder = stakeHolders[msg.sender];
        require(holder.stake != 0, "Staking: NOT EXIST");

        allActiveStakes -= holder.stake;
        uint amount = _calculateReward(holder);
        holder.stake = 0;
        stakingToken.safeTransfer(msg.sender, amount);
        emit Unstake(msg.sender, amount);
    }
}
