// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.12;

import "../interfaces/IKIP7.sol";
import "../tokens/PlatformToken.sol";
import "../utils/Ownable.sol";
import '../utils/SafeCast.sol';
import "../utils/ReentrancyGuard.sol";

contract Farming is Ownable, ReentrancyGuard{
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
        address lpToken; // Address of LP token contract.
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
    uint256 public BONUS_MULTIPLIER = 1;
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

    uint256 private constant ACC_PRECISION = 1e12;

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

        // staking pool
        poolInfo.push(PoolInfo({
            lpToken: _ptn,
            stakingTokenTotalAmount: 0,
            allocPoint: 1000,
            lastRewardBlock: startBlock.toUint64(),
            accPtnPerShare: 0
        }));

        totalAllocPoint = 1000;

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
    function add(uint256 _allocPoint, address _lpToken, bool _withUpdate) public onlyOwner {
        require(addedTokens[_lpToken] == false, "Token already added");
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint + _allocPoint;
        poolInfo.push(PoolInfo({
            lpToken: _lpToken,
            stakingTokenTotalAmount: 0,
            allocPoint: _allocPoint.toUint64(),
            lastRewardBlock: lastRewardBlock.toUint64(),
            accPtnPerShare: 0
        }));
        updateStakingPool();
        addedTokens[_lpToken] = true;
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
            updateStakingPool();
        }
    }

    function updateStakingPool() internal {
        uint256 allocPool = totalAllocPoint - poolInfo[0].allocPoint;
        uint256 points = allocPool / 3;
        if (points != 0) {
            totalAllocPoint = allocPool + points;
            poolInfo[0].allocPoint = points.toUint64();
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
            uint256 lpSupply = IKIP7(pool.lpToken).balanceOf(address(this));
            if (lpSupply > 0) {
                uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
                uint256 ptnReward = (multiplier * ptnPerBlock * pool.allocPoint) / totalAllocPoint;
                ptn.mint(address(this), ptnReward);
                pool.accPtnPerShare = pool.accPtnPerShare + (ptnReward * ACC_PRECISION / lpSupply).toUint128();
            }
            pool.lastRewardBlock = (block.number).toUint64();
        }
    }

    // Deposit LP tokens to Farming Contract for PTN allocation.
    function deposit(uint256 _pid, uint256 _amount) external nonReentrant {

        require (_pid != 0, 'deposit PTN by staking');

        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);
        if (user.amount > 0) {
            uint256 pending = (user.amount * pool.accPtnPerShare / ACC_PRECISION) - user.rewardDebt;
            if(pending > 0) {
                safePtnTransfer(msg.sender, pending);
            }
        }
        if (_amount > 0) {
            IKIP7(pool.lpToken).safeTransferFrom(address(msg.sender), address(this), _amount);
            pool.stakingTokenTotalAmount += _amount;
            user.amount += _amount;
            
        }
        user.rewardDebt = user.amount * pool.accPtnPerShare / ACC_PRECISION;
        emit Deposit(msg.sender, _pid, _amount);
    }

    // Withdraw LP tokens from Farming Contract.
    function withdraw(uint256 _pid, uint256 _amount) external nonReentrant {

        require (_pid != 0, 'withdraw PTN by unstaking');
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amount >= _amount, "withdraw: not good");

        updatePool(_pid);
        uint256 pending = (user.amount * pool.accPtnPerShare / ACC_PRECISION) - user.rewardDebt;
        if(pending > 0) {
            safePtnTransfer(msg.sender, pending);
        }
        if(_amount > 0) {
            user.amount -= _amount;
            pool.stakingTokenTotalAmount -= _amount;
            IKIP7(pool.lpToken).safeTransfer(address(msg.sender), _amount);
        }
        user.rewardDebt = user.amount * pool.accPtnPerShare / ACC_PRECISION;
        emit Withdraw(msg.sender, _pid, _amount);
    }

    // Stake PTN tokens to Farming Contract
    function enterStaking(uint256 _amount) external nonReentrant {
        PoolInfo storage pool = poolInfo[0];
        UserInfo storage user = userInfo[0][msg.sender];
        updatePool(0);
        if (user.amount > 0) {
            uint256 pending = (user.amount * pool.accPtnPerShare / ACC_PRECISION) - user.rewardDebt;
            if(pending > 0) {
                safePtnTransfer(msg.sender, pending);
            }
        }
        if(_amount > 0) {
            IKIP7(pool.lpToken).safeTransferFrom(address(msg.sender), address(this), _amount);
            pool.stakingTokenTotalAmount += _amount;
            user.amount += _amount;
        }
        user.rewardDebt = user.amount * pool.accPtnPerShare / ACC_PRECISION;
        emit Deposit(msg.sender, 0, _amount);
    }

    // Withdraw PTN tokens from Farming Contract.
    function leaveStaking(uint256 _amount) external nonReentrant {
        PoolInfo storage pool = poolInfo[0];
        UserInfo storage user = userInfo[0][msg.sender];
        require(user.amount >= _amount, "withdraw: not good");
        updatePool(0);
        uint256 pending = (user.amount * pool.accPtnPerShare / ACC_PRECISION) - user.rewardDebt;
        if(pending > 0) {
            safePtnTransfer(msg.sender, pending);
        }
        if(_amount > 0) {
            user.amount -= _amount;
            pool.stakingTokenTotalAmount -= _amount;
            IKIP7(pool.lpToken).safeTransfer(address(msg.sender), _amount);
        }
        user.rewardDebt = user.amount * pool.accPtnPerShare / ACC_PRECISION;
        emit Withdraw(msg.sender, 0, _amount);
    }

    // Safe boo transfer function, just in case if rounding error causes pool to not have enough PTNs.
    function safePtnTransfer(address _to, uint256 _amount) internal {
        uint256 ptnBal = ptn.balanceOf(address(this));
        if (_amount > ptnBal) {
            ptn.safeTransfer(_to, ptnBal);
        } else {
            ptn.safeTransfer(_to, _amount);
        }
    }
    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw(uint256 _pid) public nonReentrant {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];

        uint oldUserAmount = user.amount;
        pool.stakingTokenTotalAmount -= user.amount;
        user.amount = 0;
        user.rewardDebt = 0;

        IKIP7(pool.lpToken).safeTransfer(address(msg.sender), oldUserAmount);
        emit EmergencyWithdraw(msg.sender, _pid, oldUserAmount);

    }

    // View function to see pending CAKEs on frontend.
    function pendingPtn(uint256 _pid, address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accPtnPerShare = pool.accPtnPerShare;
        uint256 lpSupply = IKIP7(pool.lpToken).balanceOf(address(this));
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
            uint256 ptnReward = (multiplier * ptnPerBlock * pool.allocPoint) / totalAllocPoint;
            accPtnPerShare = accPtnPerShare + (ptnReward * ACC_PRECISION / lpSupply);
        }
        return (user.amount * accPtnPerShare / ACC_PRECISION ) - user.rewardDebt;
    }

    /**
     * @notice Handle the receipt of KIP-7 token
     * @dev The KIP-7 smart contract calls this function on the recipient
     *  after a `safeTransfer`. This function MAY throw to revert and reject the
     *  transfer. Return of other than the magic value MUST result in the
     *  transaction being reverted.
     *  Note: the contract address is always the message sender.
     * @param _operator The address which called `safeTransferFrom` function
     * @param _from The address which previously owned the token
     * @param _amount The token amount which is being transferred.
     * @param _data Additional data with no specified format
     * @return `bytes4(keccak256("onKIP7Received(address,address,uint256,bytes)"))`
     *  unless throwing
     */
    function onKIP7Received(address _operator, address _from, uint256 _amount, bytes memory _data) public pure returns (bytes4){
        return 0x9d188c22;
    }
}
