const hre = require("hardhat");
const { ethers } = require("ethers");

const totalSupply = ethers.utils.parseUnits(String(process.env.SUPPLY), 18) || "1_000_000_000_000_000_000_000_000"// 1M * 10^18 by default

async function main() {
  await hre.run('compile');

  const [ deployer ] = await hre.ethers.getSigners();
  console.log(`Deploying contracts with the account: ${deployer.address}`);
  console.log(`Account balance: ${hre.ethers.utils.formatEther((await deployer.getBalance()).toString())}`);

  // deploy token itself
  const TKNContract = await hre.ethers.getContractFactory("TKN");
  console.log("Deploying token contract...")
  const token = await TKNContract.deploy(totalSupply);

  await token.deployed();
  console.log(`Token contract deployed on the address ${token.address} with supply ${totalSupply.toString()}`);

  // deploy staking contract
  const StakingContract = await hre.ethers.getContractFactory('Staking');
  console.log("Deploying staking contract...")
  const staking = await StakingContract.deploy(token.address);
  await staking.deployed();
  console.log(`Staking contract deployed on the address ${staking.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
