//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TKN is ERC20 {
    constructor(uint initialSupply) ERC20("Token", "TKN") {
        _mint(msg.sender, initialSupply);
    }
}
