const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Staking", () => {
  let _owner;
  let staking;
  let token;
  const aliceBalance = 1_000_000;
  const bobBalance = 1000;
  const totalSupply = ethers.utils.parseUnits("1000", 18);

  beforeEach(async () => {
    [_owner, alice, bob, david] = await ethers.getSigners();
    // deploy token to test network
    const TKNContract = await ethers.getContractFactory("TKN");
    token = await TKNContract.deploy(totalSupply);

    // deploy staking contract
    const StakingContract = await ethers.getContractFactory("Staking");
    staking = await StakingContract.deploy(token.address);

    // transfer a bit tokens to Alice and approve them to the staking contract
    await token.transfer(alice.address, aliceBalance);
    await token.connect(alice).approve(staking.address, aliceBalance);

    // transfer a bit tokens to Bob and approve them to the staking contract
    await token.transfer(bob.address, bobBalance);
    await token.connect(bob).approve(staking.address, bobBalance);

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
      expect(await token.balanceOf(alice.address)).to.equal(
        aliceBalance - amount
      );
      const stakeHolder = await staking.stakeHolders(alice.address);
      expect(stakeHolder.stake).to.equal(amount);
      expect(stakeHolder.snapshot).to.equal(0);
    });

    it("should revert if user stake twice", async () => {
      const amount = 1000;
      await expect(staking.connect(alice).stake(amount))
        .to.emit(staking, "Stake")
        .withArgs(alice.address, amount);

      await expect(staking.connect(alice).stake(amount)).to.be.revertedWith(
        "Staking: ALREADY EXIST"
      );
    });

    it("should revert if user pass zero amount", async () => {
      const amount = 0;
      await expect(staking.stake(amount)).to.be.revertedWith(
        "Staking: NOT ZERO"
      );
    });

    it("should stake -> unstake -> stake successfully", async () => {
      const amount = 1000;
      await staking.connect(alice).stake(amount);

      await staking.connect(alice).unstake(amount);

      const newAmount = 20000;
      await expect(staking.connect(alice).stake(newAmount))
        .to.emit(staking, "Stake")
        .withArgs(alice.address, newAmount);

      expect(await token.balanceOf(staking.address)).to.equal(newAmount);
      expect(await token.balanceOf(alice.address)).to.equal(
        aliceBalance - newAmount
      );
      const stakeHolder = await staking.stakeHolders(alice.address);
      expect(stakeHolder.stake).to.equal(newAmount);
      expect(stakeHolder.snapshot).to.equal(0);
    });

    it("should stake Alice -> stake Bob -> distribute -> unstake successfully", async () => {
      const stakeAlice = 2000;
      await staking.connect(alice).stake(stakeAlice);

      const stakeBob = 1000;
      await staking.connect(bob).stake(stakeBob);

      const reward = 30000;
      await staking.distribute(reward);

      expect(await token.balanceOf(staking.address)).to.equal(
        reward + stakeBob + stakeAlice
      );
      expect(await token.balanceOf(alice.address)).to.equal(
        aliceBalance - stakeAlice
      );
      expect(await token.balanceOf(bob.address)).to.equal(
        bobBalance - stakeBob
      );

      const [aliceHolder, bobHolder] = await Promise.all([
        staking.stakeHolders(alice.address),
        staking.stakeHolders(bob.address),
      ]);
      expect(aliceHolder.stake).to.equal(stakeAlice);
      expect(aliceHolder.snapshot).to.equal(0);

      expect(bobHolder.stake).to.equal(stakeBob);
      expect(bobHolder.snapshot).to.equal(0);

      const bobUnstakeAmount = 500;
      await staking.connect(alice).unstake(stakeAlice);
      await staking.connect(bob).unstake(bobUnstakeAmount);

      expect(await token.balanceOf(staking.address)).to.equal(500);
      expect(await token.balanceOf(alice.address)).to.equal(
        aliceBalance + (stakeAlice * reward) / (stakeBob + stakeAlice)
      );
      expect(await token.balanceOf(bob.address)).to.equal(
        bobUnstakeAmount + (stakeBob * reward) / (stakeBob + stakeAlice)
      );
    });
  });

  describe("distribute", () => {
    it("should distribute reward successfully", async () => {
      const amount = 1000;
      await expect(staking.connect(alice).stake(amount));

      const reward = 200;
      await expect(staking.distribute(reward))
        .to.emit(staking, "Distribute")
        .withArgs(reward);

      const expectedStakingBalance = amount + reward;
      const expectedAliceBalance = aliceBalance - amount;
      expect(await token.balanceOf(staking.address)).to.equal(
        expectedStakingBalance
      );
      expect(await token.balanceOf(alice.address)).to.equal(
        expectedAliceBalance
      );
    });

    it("should revert if not owner tries distribute", async () => {
      const amount = 1000;
      await expect(staking.connect(alice).stake(amount));

      const reward = 200;
      await expect(
        staking.connect(alice).distribute(reward)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should revert if not owner tries distribute", async () => {
      const reward = 200;
      await expect(staking.distribute(reward)).to.be.revertedWith(
        "Staking: NO STAKERS"
      );
    });
    // TODO: test fractional divisions and round calculations
  });

  describe("unstake", () => {
    it("should unstake tokens successfully", async () => {
      // stake tokens first
      const amount = 1000;
      await expect(staking.connect(alice).stake(amount));

      // distribute reward by admin
      const reward = 200;
      await expect(staking.distribute(reward))
        .to.emit(staking, "Distribute")
        .withArgs(reward);

      // claim reward
      const expectedReward = amount + reward;
      await expect(staking.connect(alice).unstake(amount))
        .to.emit(staking, "Unstake")
        .withArgs(alice.address, expectedReward);

      expect(await token.balanceOf(staking.address)).to.equal(0);
      expect(await token.balanceOf(alice.address)).to.equal(
        aliceBalance + reward
      );
      const stakeHolder = await staking.stakeHolders(alice.address);
      expect(stakeHolder.stake).to.equal(0);
      expect(stakeHolder.snapshot).to.equal(ethers.utils.parseUnits("0.2", 18));
    });

    it("should revert if stake not exist", async () => {
      await expect(staking.unstake(1000)).to.be.revertedWith("Staking: NOT EXIST");
    });

    it("should revert if unstake amount equals to zero", async () => {
      await expect(staking.unstake(0)).to.be.revertedWith("Staking: NOT ZERO");
    });

    it("should revert if unstake amount greater than stake amount", async () => {
      // stake tokens first
      const amount = 1000;
      await expect(staking.connect(alice).stake(amount));

      // try unstake
      await expect(staking.connect(alice).unstake(amount + 1))
        .to.be.revertedWith("Staking: INVALID");
    });
  });

  describe("complex", () => {
    it("should stake Alice -> distribute -> stake Bob -> stake David -> distribute -> unstake half Alice -> distribute -> unstake Bob -> distribute -> unstake David and Alice", async () => {
      // transfer a bit tokens to Bob and approve them to the staking contract
      const davidBalance = 3000;
      await token.transfer(david.address, davidBalance);
      await token.connect(david).approve(staking.address, davidBalance);

      const stakeAlice = 2000;
      await staking.connect(alice).stake(stakeAlice);

      const firstReward = 10;
      await staking.distribute(firstReward);
      const firstRewardPerUnit = firstReward / stakeAlice; // 0.005
      let totalRewardPerUnit = firstRewardPerUnit;

      const stakeBob = 1000;
      const stakeDavid = 500;
      await staking.connect(bob).stake(stakeBob);
      await staking.connect(david).stake(stakeDavid);

      const secondReward = 5250;
      await staking.distribute(secondReward);
      let allActiveStakes = stakeAlice + stakeBob + stakeDavid; // 3500
      const secondRewardPerUnit = secondReward / allActiveStakes; // 1.5
      totalRewardPerUnit += secondRewardPerUnit;

      let stakingBalance = allActiveStakes + firstReward + secondReward;
      expect(await token.balanceOf(staking.address)).to.equal(
        stakingBalance
      );
      expect(await token.balanceOf(alice.address)).to.equal(
        aliceBalance - stakeAlice
      );
      expect(await token.balanceOf(bob.address)).to.equal(
        bobBalance - stakeBob
      );
      expect(await token.balanceOf(david.address)).to.equal(
        davidBalance - stakeDavid
      );

      let [davidHolder, bobHolder] = await Promise.all([
        staking.stakeHolders(david.address),
        staking.stakeHolders(bob.address),
      ]);
      expect(davidHolder.stake).to.equal(stakeDavid);
      expect(davidHolder.snapshot).to.equal(ethers.utils.parseUnits(String(firstRewardPerUnit), 18));

      expect(bobHolder.stake).to.equal(stakeBob);
      expect(bobHolder.snapshot).to.equal(ethers.utils.parseUnits(String(firstRewardPerUnit), 18));

      // unstake half of stake 1000 TKN unstaked and 10 + 3000 TKN as a reward
      await staking.connect(alice).unstake(stakeAlice / 2);
      allActiveStakes -= stakeAlice / 2;

      const secondAliceReward = stakeAlice * secondRewardPerUnit;
      stakingBalance =  stakingBalance - stakeAlice / 2 - firstReward - secondAliceReward;
      expect(await token.balanceOf(staking.address)).to.equal(
        stakingBalance
      );
      expect(await token.balanceOf(alice.address)).to.equal(
        aliceBalance - stakeAlice / 2 + firstReward + secondAliceReward
      );

      let aliceHolder = await staking.stakeHolders(alice.address)
      expect(aliceHolder.stake).to.equal(stakeAlice / 2);
      expect(aliceHolder.snapshot).to.equal(ethers.utils.parseUnits(String(totalRewardPerUnit), 18));

      // distribute reward
      const thirdReward = 50;
      await staking.distribute(thirdReward);
      const thirdRewardPerUnit = thirdReward / allActiveStakes; // 0.02
      stakingBalance += thirdReward;
      totalRewardPerUnit += thirdRewardPerUnit;

      // unstake Bob
      await staking.connect(bob).unstake(stakeBob);
      allActiveStakes -= stakeBob;

      const bobReward = stakeBob * (secondRewardPerUnit + thirdRewardPerUnit);
      stakingBalance = stakingBalance - bobReward - stakeBob;
      expect(await token.balanceOf(staking.address)).to.equal(
        stakingBalance
      );
      expect(await token.balanceOf(bob.address)).to.equal(
        bobBalance + bobReward
      );

      bobHolder = await staking.stakeHolders(bob.address)
      expect(bobHolder.stake).to.equal(0);
      expect(bobHolder.snapshot).to.equal(ethers.utils.parseUnits(String(totalRewardPerUnit), 18));

      // distribute reward
      const fourthReward = 900000;
      await staking.distribute(fourthReward);
      const fourthRewardPerUnit = fourthReward / allActiveStakes; // 600
      stakingBalance += fourthReward;
      totalRewardPerUnit += fourthRewardPerUnit;

      // unstake half David
      await staking.connect(david).unstake(stakeDavid / 2);

      const davidReward = stakeDavid * (secondRewardPerUnit + thirdRewardPerUnit + fourthRewardPerUnit);
      stakingBalance = stakingBalance - davidReward - stakeDavid / 2;
      expect(await token.balanceOf(staking.address)).to.equal(
        stakingBalance
      );
      expect(await token.balanceOf(david.address)).to.equal(
        davidBalance - stakeDavid / 2 + davidReward
      );

      davidHolder = await staking.stakeHolders(david.address)
      expect(davidHolder.stake).to.equal(stakeDavid / 2);
      expect(davidHolder.snapshot).to.equal(ethers.utils.parseUnits(String(totalRewardPerUnit), 18));

      // unstake all left stakes
      await staking.connect(alice).unstake(stakeAlice / 2);

      const aliceReward = stakeAlice / 2 * (thirdRewardPerUnit + fourthRewardPerUnit);
      stakingBalance = stakingBalance - aliceReward - stakeAlice / 2;
      expect(await token.balanceOf(staking.address)).to.equal(
        stakingBalance
      );
      expect(await token.balanceOf(alice.address)).to.equal(
        aliceBalance + aliceReward + firstReward + secondAliceReward
      );

      aliceHolder = await staking.stakeHolders(alice.address)
      expect(aliceHolder.stake).to.equal(0);
      expect(aliceHolder.snapshot).to.equal(ethers.utils.parseUnits(String(totalRewardPerUnit), 18));

      await staking.connect(david).unstake(stakeDavid / 2);

      expect(await token.balanceOf(staking.address)).to.equal(0);
      expect(await token.balanceOf(david.address)).to.equal(
        davidBalance + davidReward
      );

      davidHolder = await staking.stakeHolders(david.address)
      expect(davidHolder.stake).to.equal(0);
      expect(davidHolder.snapshot).to.equal(ethers.utils.parseUnits(String(totalRewardPerUnit), 18));
    });
  });
});
