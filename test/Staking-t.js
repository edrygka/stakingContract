const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Staking", () => {
    let owner;
    let staking;
    let token;
    const aliceTotalBalance = 1_000_000;
    const bobTotalBalance = 1000;
    const totalSupply = ethers.utils.parseUnits("1000", 18);

    beforeEach(async () => {
        [owner, alice, bob] = await ethers.getSigners();
        // deploy token to test network
        const TKNContract = await ethers.getContractFactory("TKN");
        token = await TKNContract.deploy(totalSupply);

        // deploy staking contract
        const StakingContract = await ethers.getContractFactory("Staking");
        staking = await StakingContract.deploy(token.address);

        // transfer a bit tokens to Alice and approve them to the staking contract
        await token.transfer(alice.address, aliceTotalBalance);
        await token.connect(alice).approve(staking.address, aliceTotalBalance);

        // transfer a bit tokens to Bob and approve them to the staking contract
        await token.transfer(bob.address, bobTotalBalance);
        await token.connect(bob).approve(staking.address, bobTotalBalance);

        // admin approve tokens to the staking contract
        await token.approve(staking.address, totalSupply);
    });

    describe("stake", () => {
        it("should stake specific token amount", async () => {
            const amount = 1000;
            await expect(staking.connect(alice).stake(amount))
                .to.emit(staking, "Stake")
                .withArgs(alice.address, amount);
            
            expect(await token.balanceOf(staking.address)).to.equal(amount);
            expect(await token.balanceOf(alice.address)).to.equal(aliceTotalBalance - amount);
            const stakeHolder = await staking.stakeHolders(alice.address);
            expect(stakeHolder.stake).to.equal(amount)
            expect(stakeHolder.snapshot).to.equal(0)
        });

        it("should revert if user stake twice", async () => {
          const amount = 1000;
          await expect(staking.connect(alice).stake(amount))
              .to.emit(staking, "Stake")
              .withArgs(alice.address, amount);

          await expect(staking.connect(alice).stake(amount))
              .to.be.revertedWith("Staking: ALREADY EXIST");
        });

        it("should revert if user pass zero amount", async () => {
          const amount = 0;
          await expect(staking.stake(amount))
              .to.be.revertedWith("Staking: NOT ZERO");
        });

        it("should stake -> unstake -> stake successfully", async () => {
          const amount = 1000;
          await staking.connect(alice).stake(amount);

          await staking.connect(alice).unstake()

          const newAmount = 20000;
          await expect(staking.connect(alice).stake(newAmount))
            .to.emit(staking, "Stake")
            .withArgs(alice.address, newAmount);
            
          expect(await token.balanceOf(staking.address)).to.equal(newAmount);
          expect(await token.balanceOf(alice.address)).to.equal(aliceTotalBalance - newAmount);
          const stakeHolder = await staking.stakeHolders(alice.address);
          expect(stakeHolder.stake).to.equal(newAmount)
          expect(stakeHolder.snapshot).to.equal(0)
        });

        it("should stake Alice -> stake Bob -> distribute -> unstake successfully", async () => {
          const stakeAlice = 2000;
          await staking.connect(alice).stake(stakeAlice)

          const stakeBob = 1000;
          await staking.connect(bob).stake(stakeBob)

          const reward = 30000;
          await staking.distribute(reward)
            
          expect(await token.balanceOf(staking.address)).to.equal(reward + stakeBob + stakeAlice);
          expect(await token.balanceOf(alice.address)).to.equal(aliceTotalBalance - stakeAlice);
          expect(await token.balanceOf(bob.address)).to.equal(bobTotalBalance - stakeBob);

          const [aliceHolder, bobHolder] = await Promise.all([
            staking.stakeHolders(alice.address),
            staking.stakeHolders(bob.address)
          ]);
          expect(aliceHolder.stake).to.equal(stakeAlice)
          expect(aliceHolder.snapshot).to.equal(0)

          expect(bobHolder.stake).to.equal(stakeBob)
          expect(bobHolder.snapshot).to.equal(0)

          await staking.connect(alice).unstake()
          await staking.connect(bob).unstake()

          expect(await token.balanceOf(staking.address)).to.equal(0);
          expect(await token.balanceOf(alice.address)).to.equal(aliceTotalBalance + stakeAlice * reward / (stakeBob + stakeAlice));
          expect(await token.balanceOf(bob.address)).to.equal(bobTotalBalance + stakeBob * reward / (stakeBob + stakeAlice));
        });
    });

    describe("distribute", () => {
        it("should distribute reward successfully", async () => {
            const amount = 1000;
            await expect(staking.connect(alice).stake(amount))

            const reward = 200;
            await expect(staking.distribute(reward))
                .to.emit(staking, "Distribute")
                .withArgs(reward);

            const expectedStakingBalance = amount + reward;
            const expectedAliceBalance = aliceTotalBalance - amount;
            expect(await token.balanceOf(staking.address)).to.equal(expectedStakingBalance);
            expect(await token.balanceOf(alice.address)).to.equal(expectedAliceBalance);
        });

        it("should revert if not owner tries distribute", async () => {
          const amount = 1000;
          await expect(staking.connect(alice).stake(amount))

          const reward = 200;
          await expect(staking.connect(alice).distribute(reward))
              .to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("should revert if not owner tries distribute", async () => {
          const reward = 200;
          await expect(staking.distribute(reward))
              .to.be.revertedWith("Staking: NO STAKERS");
        });
        // TODO: test fractional divisions and round calculations
    });

    describe("unstake", () => {
        it("should unstake tokens successfully", async () => {
            // stake tokens first
            const amount = 1000;
            await expect(staking.connect(alice).stake(amount))

            // distribute reward by admin
            const reward = 200;
            await expect(staking.distribute(reward))
                .to.emit(staking, "Distribute")
                .withArgs(reward);

            // claim reward
            const expectedReward = amount + reward;
            await expect(staking.connect(alice).unstake())
                .to.emit(staking, "Unstake")
                .withArgs(alice.address, expectedReward);

            expect(await token.balanceOf(staking.address)).to.equal(0);
            expect(await token.balanceOf(alice.address)).to.equal(aliceTotalBalance + reward);
            const stakeHolder = await staking.stakeHolders(alice.address);
            expect(stakeHolder.stake).to.equal(0)
            expect(stakeHolder.snapshot).to.equal(0)
        });

        it("should unstake tokens successfully", async () => {
            await expect(staking.unstake())
                .to.be.revertedWith("Staking: NOT EXIST");
        });
    });
});