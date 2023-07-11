# Staking implementation(non-upgradeable)

Users stake different quantities of ERC-20 token named “TKN”. Assume that an external caller would periodically transfer reward TKNs to a staking smart contract (no need to implement this logic). Rewards are proportionally distributed based on staked TKN.

Contract caller can:
- Stake
- Unstake (would be a plus if caller can unstake part of stake)
- See how many tokens each user can unstake

## Contract philosophy
It was decided to create separate token in order to let staking contract interact with both exist or still non exist tokens. Only owner can distribute rewards but everyone can deposit any amount of tokens and withdraw their funds finally, so there is no whitelisting mechanism here.

##### **stake**(uint `_amount`)
User can deposit tokens but it requires **approve** operation from token contract itself. Simply saying you need to approve for staking contract address specific amount of tokens you are going to stake.
*NOTE*: You can't pass zero amount and you can't stake more than 1 time
If you want deposit another token value, you need unstake all funds first, than you can stake any value you would like to.

##### **distribute**(uint `_reward`)
Contract owner is able to distribute reward proportionally to all active stakers.
*NOTE*: To let that happen owner need **approve** amount of tokens for staking contract address he is going to distribute. Also owner can't distribute any value if there are no active stake holders.

##### **unstake**(uint `_amount`)
Stake holder can claim all his reward. Also its possible unstake a part of the stake.
*NOTE*: If you are not stake holder call will be reverted, also if you have no active stake you can't withdraw anything.

#### Get started
To run solhint go:
```shell
npm run solhint
```

To check coverage go:
```shell
npm run coverage
```

To run tests just go:
```shell
npm test
```

To deploy contracts to goerli network run:
```sh
SUPPLY=1000 GAS_PRICE=10000000000 GAS_LIMIT=3000000 npx hardhat run --network goerli scripts/deploy.js
```
By default supply equals to `1 000 000 * 10^18`

To verify contract run:
```sh
npx hardhat verify --network goerli STAKING_ADDRESS "TOKEN_ADDRESS"
```

### Next enhancements
* claim reward function
* view reward function
* permit(to avoid approve operation from the user)
* proxy implementation
* split deploy script for each contract
* add more tests for TKN contract
* set up linter to standardize code style