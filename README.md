# Staking implementation(non-upgradeable)

Users stake different quantities of ERC-20 token named “TKN”. Assume that an external caller would periodically transfer reward TKNs to a staking smart contract (no need to implement this logic). Rewards are proportionally distributed based on staked TKN.

Contract caller can:
- Stake
- Unstake (would be a plus if caller can unstake part of stake)
- See how many tokens each user can unstake

## Contract philosophy
It was decided to create separate token in order to let staking contract interact with both exist or still non exist tokens. Only owner can distribute rewards but everyone can deposit any amount of tokens and withdraw their funds finally, so there is no whitelisting mechanism here.

##### **stake**(uint `amount`)
User can deposit tokens but it requires **approve** operation from token contract itself. Simply saying you need to approve for staking contract address specific amount of tokens you are going to stake.
*NOTE*: You can't pass zero amount and you can't stake more than 1 time
If you want deposit another token value, you need unstake all funds first, than you can stake any value you would like to.

##### **distribute**(uint `reward`)
Contract owner is able to distribute reward proportionally to all active stakers.
*NOTE*: To let that happen owner need **approve** amount of tokens for staking contract address he is going to distribute. Also owner can't distribute any value if there are no active stake holders.

##### **unstake**()
Stake holder can withdraw all his funds by calling this function.
*NOTE*: If you are not stake holder call will be reverted, also if you have no active stake you can't withdraw anything.

#### Get started

To run tests just go:
```shell
npm test
```

To deploy contracts to local network run:
```sh
SUPPLY=1000 GAS_PRICE=10000000000 GAS_LIMIT=3000000 npx hardhat run --network goerli scripts/deploy.js
```
By default supply equals to `1 000 000 * 10^18`

To verify contract run:
```sh
npx hardhat verify --network goerli 0xd95842d35D684e0aF6d4aFf917eD232935CA507a "0x8F046CE5Af73628fF2E9528dD819B2c195928Cc9"
```

### Next enhancements
* unstake a part of stake for each user
* proxy implementation
* split deploy script for each contract
* add more tests for TKN contract
* set up linter to standardize code style