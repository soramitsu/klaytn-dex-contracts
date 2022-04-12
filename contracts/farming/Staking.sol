// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.12;

import "../interfaces/IKIP7.sol";
import "../libraries/TransferHelper.sol";
import "../tokens/PlatformToken.sol";
import "../utils/Ownable.sol";
import '../utils/SafeCast.sol';

contract Staking is Ownable {
    // Info of each user.
    using SafeCast for uint256;
    struct UserInfo {
        uint256 amount; // How many LP tokens the user has provided.
        uint256 rewardDebt; // Reward debt. See explanation below.
        //
        // We do some fancy math here. Basically, any point in time, the amount of PTNs
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (user.amount * pool.accPtnPerShare) - user.rewardDebt
        //
        // Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
        //   1. The pool's `accPtnPerShare` (and `lastRewardBlock`) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. User's `amount` gets updated.
        //   4. User's `rewardDebt` gets updated.
    }

    // Info of each pool.
    struct PoolInfo {
        address stakingToken; // Address of LP token contract.
        uint256 stakingTokenTotalAmount;
        uint64 allocPoint; // How many allocation points assigned to this pool. PTNs to distribute per block.
        uint64 lastRewardBlock; // Last block number that PTNs distribution occurs.
        uint128 accPtnPerShare; // Accumulated PTNs per share, times 1e12.
    }

    // The PTN TOKEN!
    PlatformToken public ptn;

    // PTN tokens created per block.
    uint256 public ptnPerBlock;
    // Bonus muliplier for early ptn makers.
    uint256 public BONUS_MULTIPLIER = 10;
    // The migrator contract. It has a lot of power. Can only be set through governance (owner).

    // Info of each pool.
    PoolInfo[] public poolInfo;
    mapping (address => bool) public addedTokens;
    // Info of each user that stakes LP tokens.
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    // Total allocation points. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint;
    // The block number when PTN mining starts.
    uint256 public startBlock;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(
        address indexed user,
        uint256 indexed pid,
        uint256 amount
    );

    constructor(
        address _ptn,
        uint256 _ptnPerBlock,
        uint256 _startBlock
    ) {
        ptn = PlatformToken(_ptn);
        ptnPerBlock = _ptnPerBlock;
        startBlock = _startBlock;
    }

    function updateMultiplier(uint256 multiplierNumber) public onlyOwner {
        BONUS_MULTIPLIER = multiplierNumber;
    }

    function updatePtnPerBlock(uint256 _ptnPerBlock) external onlyOwner {
        // This MUST be done or pool rewards will be calculated with new boo per second
        // This could unfairly punish small pools that dont have frequent deposits/withdraws/harvests
        massUpdatePools(); 
        ptnPerBlock = _ptnPerBlock;
    }

     // Return reward multiplier over the given _from to _to block.
    function getMultiplier(uint256 _from, uint256 _to) public view returns (uint256) {
        return (_to - _from) * BONUS_MULTIPLIER;
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    // Add a new lp to the pool. Can only be called by the owner.
    function add(uint256 _allocPoint, address _stakingToken, bool _withUpdate) public onlyOwner {
        require(addedTokens[_stakingToken] == false, "Token already added");
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint + _allocPoint;
        poolInfo.push(PoolInfo({
            stakingToken: _stakingToken,
            stakingTokenTotalAmount: 0,
            allocPoint: _allocPoint.toUint64(),
            lastRewardBlock: lastRewardBlock.toUint64(),
            accPtnPerShare: 0
        }));
        addedTokens[_stakingToken] = true;
    }

    // Update the given pool's PTN allocation point. Can only be called by the owner.
    function set(uint256 _pid, uint256 _allocPoint, bool _withUpdate) public onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 prevAllocPoint = poolInfo[_pid].allocPoint;
        if (prevAllocPoint != _allocPoint) {
            poolInfo[_pid].allocPoint = _allocPoint.toUint64();
            totalAllocPoint = totalAllocPoint - prevAllocPoint + _allocPoint;
        }
    }

    // Update reward variables for all pools. Be careful of gas spending!
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    // Update reward variables of the given pool to be up-to-date.
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number > pool.lastRewardBlock) {
            uint256 lpSupply = IKIP7(pool.stakingToken).balanceOf(address(this));
            if (lpSupply > 0) {
                uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
                uint256 ptnReward = (multiplier * ptnPerBlock * pool.allocPoint) / totalAllocPoint;
                ptn.mint(address(this), ptnReward);
                pool.accPtnPerShare = pool.accPtnPerShare + (ptnReward * 1e12 / lpSupply).toUint64();
            }
            pool.lastRewardBlock = (block.number).toUint64();
        }
    }

    // Deposit LP tokens to Farming Contract for PTN allocation.
    function deposit(uint256 _pid, uint256 _amount) public {

        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);
        if (user.amount > 0) {
            uint256 pending = (user.amount * pool.accPtnPerShare / 1e12) - user.rewardDebt;
            if(pending > 0) {
                safePtnTransfer(msg.sender, pending);
            }
        }
        if (_amount > 0) {
            TransferHelper.safeTransferFrom(pool.stakingToken, address(msg.sender), address(this), _amount);
            user.amount += _amount;
            pool.stakingTokenTotalAmount += _amount;
        }
        user.rewardDebt = user.amount * pool.accPtnPerShare / 1e12;
        emit Deposit(msg.sender, _pid, _amount);
    }

    // Withdraw LP tokens from Farming Contract.
    function withdraw(uint256 _pid, uint256 _amount) public {

        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amount >= _amount, "withdraw: not good");

        updatePool(_pid);
        uint256 pending = (user.amount * pool.accPtnPerShare / 1e12) - user.rewardDebt;
        if(pending > 0) {
            safePtnTransfer(msg.sender, pending);
        }
        if(_amount > 0) {
            user.amount -= _amount;
            pool.stakingTokenTotalAmount -= _amount;
            TransferHelper.safeTransfer(pool.stakingToken, address(msg.sender), _amount);
        }
        user.rewardDebt = user.amount * pool.accPtnPerShare / 1e12;
        emit Withdraw(msg.sender, _pid, _amount);
    }


    // Safe boo transfer function, just in case if rounding error causes pool to not have enough PTNs.
    function safePtnTransfer(address _to, uint256 _amount) internal {
        uint256 ptnBal = ptn.balanceOf(address(this));
        if (_amount > ptnBal) {
            TransferHelper.safeTransfer(address(ptn), _to, ptnBal);
        } else {
            TransferHelper.safeTransfer(address(ptn), _to, _amount);
        }
    }
    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];

        uint oldUserAmount = user.amount;
        pool.stakingTokenTotalAmount -= user.amount;
        user.amount = 0;
        user.rewardDebt = 0;

        TransferHelper.safeTransfer(pool.stakingToken, address(msg.sender), oldUserAmount);
        emit EmergencyWithdraw(msg.sender, _pid, oldUserAmount);

    }

    // View function to see pending CAKEs on frontend.
    function pendingPtn(uint256 _pid, address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accPtnPerShare = pool.accPtnPerShare;
        uint256 lpSupply = IKIP7(pool.stakingToken).balanceOf(address(this));
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
            uint256 ptnReward = (multiplier * ptnPerBlock * pool.allocPoint) / totalAllocPoint;
            accPtnPerShare = accPtnPerShare + (ptnReward * 1e12 / lpSupply);
        }
        return (user.amount * accPtnPerShare / 1e12 ) - user.rewardDebt;
    }
}
