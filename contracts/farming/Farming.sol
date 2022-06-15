// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.12;

import "../interfaces/IKIP7.sol";
import "../tokens/PlatformToken.sol";
import "../utils/Ownable.sol";
import "../utils/SafeCast.sol";
import "../utils/ReentrancyGuard.sol";

contract Farming is Ownable, ReentrancyGuard {
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
        uint32 bonusMultiplier; // Bonus multiplier for the farming pool
        uint64 bonusEndBlock; 
        uint256 totalStaked;
        uint64 allocPoint; // How many allocation points assigned to this pool. PTNs to distribute per block.
        uint64 lastRewardBlock; // Last block number that PTNs distribution occurs.
        uint128 accPtnPerShare; // Accumulated PTNs per share, times 1e12.
    }

    // The PTN TOKEN!
    PlatformToken public ptn;

    // PTN tokens created per block.
    uint256 public ptnPerBlock;
    // Info of each pool.
    PoolInfo[] public poolInfo;
    mapping(address => bool) public addedTokens;
    // Info of each user that stakes LP tokens.
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    // Total allocation points. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint;
    // The block number when PTN mining starts.
    uint256 public startBlock;

    uint256 private constant ACC_PRECISION = 1e12;

    event AddPool(
        uint256 indexed pid,
        uint256 allocPoint,
        address indexed token,
        uint256 bonusMultiplier,
        uint256 bonusEndBlock
    );
    event SetPool(uint256 indexed pid, uint256 allocPoint);
    event UpdatePool(
        uint256 indexed pid,
        uint256 lastRewardBlock,
        uint256 lpSupply,
        uint256 accPtnPerShare
    );

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(
        address indexed user,
        uint256 indexed pid,
        uint256 amount
    );
    event UpdateRewardPerBlock(uint256 rewardPerBlock);
    event UpdatePoolMultiplier(uint256 indexed pid, uint256 multiplier);

    constructor(
        address _ptn,
        uint256 _ptnPerBlock,
        uint256 _startBlock,
        address _multisig
    ) {
        ptn = PlatformToken(_ptn);
        ptnPerBlock = _ptnPerBlock;
        startBlock = _startBlock;
        _transferOwnership(_multisig);
    }

    /// @dev Update reward multiplier for `_pid` pool.
    /// @param _pid The id of the pool. See `poolInfo`.
    /// @param _multiplier The new pool rewards multiplier.
    function updateMultiplier(uint256 _pid, uint256 _multiplier)
        public
        onlyOwner
    {
        updatePool(_pid);
        poolInfo[_pid].bonusMultiplier = _multiplier.toUint32();
        emit UpdatePoolMultiplier(_pid, _multiplier);
    }

    function updatePtnPerBlock(uint256 _ptnPerBlock) external onlyOwner {
        // This MUST be done or pool rewards will be calculated with new boo per second
        // This could unfairly punish small pools that dont have frequent deposits/withdraws/harvests
        massUpdatePools();
        ptnPerBlock = _ptnPerBlock;
        emit UpdateRewardPerBlock(_ptnPerBlock);
    }

    /// @dev Returns reward multiplier over the given `_from` to `_to` block for `_pid` pool.
    /// @param _pid The id of the pool. See `poolInfo`.
    /// @param _from Start block number
    /// @param _to End block number
    function getMultiplier(
        uint256 _pid,
        uint256 _from,
        uint256 _to
    ) public view returns (uint256) {
        if (_to <= poolInfo[_pid].bonusEndBlock) {
            return (_to - _from) * poolInfo[_pid].bonusMultiplier;
        } else if (_from >= poolInfo[_pid].bonusEndBlock) {
            return _to - _from;
        } else {
            return
                (poolInfo[_pid].bonusEndBlock -_from) * poolInfo[_pid].bonusMultiplier + (
                    _to - poolInfo[_pid].bonusEndBlock);
        }
    }

    /// @dev Returns the number of farming pools.
    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    /// @dev Add a new pool. Can only be called by the owner.
    /// @param _allocPoint Number of allocation points for the new pool.
    /// @param _lpToken Address of the LP KIP7 token.
    /// @param _withUpdate Whether call "massUpdatePools" operation.
    /// @param _bonusMultiplier  The pool reward multipler.
    function add(
        uint256 _allocPoint,
        address _lpToken,
        bool _withUpdate,
        uint256 _bonusMultiplier,
        uint256 _bonusEndBlock
    ) public onlyOwner {
        require(_lpToken != address(ptn), "Can't stake reward token");
        require(addedTokens[_lpToken] == false, "Token already added");
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 lastRewardBlock = block.number > startBlock
            ? block.number
            : startBlock;
        totalAllocPoint = totalAllocPoint + _allocPoint;
        poolInfo.push(
            PoolInfo({
                lpToken: _lpToken,
                bonusMultiplier: _bonusMultiplier.toUint32(),
                bonusEndBlock: _bonusEndBlock.toUint64(),
                totalStaked: 0,
                allocPoint: _allocPoint.toUint64(),
                lastRewardBlock: lastRewardBlock.toUint64(),
                accPtnPerShare: 0
            })
        );
        addedTokens[_lpToken] = true;
        emit AddPool(poolInfo.length - 1, _allocPoint, _lpToken, _bonusMultiplier, _bonusEndBlock);
    }

    /// @notice Update the given pool's PTN allocation point. Can only be called by the owner.
    /// @param _pid The id of the pool. See `poolInfo`.
    /// @param _allocPoint New number of allocation points for the pool.
    /// @param _withUpdate Whether call "massUpdatePools" operation.
    function set(
        uint256 _pid,
        uint256 _allocPoint,
        bool _withUpdate
    ) public onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 prevAllocPoint = poolInfo[_pid].allocPoint;
        if (prevAllocPoint != _allocPoint) {
            poolInfo[_pid].allocPoint = _allocPoint.toUint64();
            totalAllocPoint = totalAllocPoint - prevAllocPoint + _allocPoint;
            require(totalAllocPoint > 0, "Should be more than zero");
        }
        emit SetPool(_pid, _allocPoint);
    }

    /// @dev Update PTN reward for all the active pools. Be careful of gas spending!
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    /// @notice Update reward variables for the given pool.
    /// @param _pid The id of the pool. See `poolInfo`.
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number > pool.lastRewardBlock) {
            uint256 lpSupply = pool.totalStaked;
            if (lpSupply > 0) {
                uint256 multiplier = getMultiplier(
                    _pid,
                    pool.lastRewardBlock,
                    block.number
                );
                uint256 ptnReward = (multiplier *
                    ptnPerBlock *
                    pool.allocPoint) / totalAllocPoint;
                ptn.mint(address(this), ptnReward);
                pool.accPtnPerShare =
                    pool.accPtnPerShare +
                    ((ptnReward * ACC_PRECISION) / lpSupply).toUint128();
            }
            pool.lastRewardBlock = (block.number).toUint64();
            emit UpdatePool(
                _pid,
                pool.lastRewardBlock,
                lpSupply,
                pool.accPtnPerShare
            );
        }
    }

    /// @dev Deposit LP tokens to pool.
    /// @param _pid The id of the pool. See `poolInfo`.
    /// @param _amount Amount of LP tokens to deposit.
    function deposit(uint256 _pid, uint256 _amount) external nonReentrant {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);
        if (user.amount > 0) {
            uint256 pending = ((user.amount * pool.accPtnPerShare) /
                ACC_PRECISION) - user.rewardDebt;
            if (pending > 0) {
                safePtnTransfer(msg.sender, pending);
            }
        }
        if (_amount > 0) {
            IKIP7(pool.lpToken).safeTransferFrom(
                msg.sender,
                address(this),
                _amount
            );
            pool.totalStaked += _amount;
            user.amount += _amount;
        }
        user.rewardDebt = (user.amount * pool.accPtnPerShare) / ACC_PRECISION;
        emit Deposit(msg.sender, _pid, _amount);
    }

    /// @dev Withdraw LP tokens from pool.
    /// @param _pid The id of the pool. See `poolInfo`.
    /// @param _amount Amount of LP tokens to withdraw.
    function withdraw(uint256 _pid, uint256 _amount) external nonReentrant {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amount >= _amount, "withdraw: not good");

        updatePool(_pid);
        uint256 pending = ((user.amount * pool.accPtnPerShare) /
            ACC_PRECISION) - user.rewardDebt;
        if (pending > 0) {
            safePtnTransfer(msg.sender, pending);
        }
        if (_amount > 0) {
            user.amount -= _amount;
            pool.totalStaked -= _amount;
            IKIP7(pool.lpToken).safeTransfer(msg.sender, _amount);
        }
        user.rewardDebt = (user.amount * pool.accPtnPerShare) / ACC_PRECISION;
        emit Withdraw(msg.sender, _pid, _amount);
    }

    /// @dev Safe PTN transfer function, just in case if rounding error causes pool to not have enough PTNs.
    /// @param _to The PTN receiver address.
    /// @param _amount of PTN to transfer.
    function safePtnTransfer(address _to, uint256 _amount) internal {
        uint256 ptnBal = ptn.balanceOf(address(this));
        if (_amount > ptnBal) {
            ptn.safeTransfer(_to, ptnBal);
        } else {
            ptn.safeTransfer(_to, _amount);
        }
    }

    /// @dev Withdraw without caring about the rewards. EMERGENCY ONLY.
    /// @param _pid The id of the pool. See `poolInfo`.
    function emergencyWithdraw(uint256 _pid) public nonReentrant {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];

        uint256 oldUserAmount = user.amount;
        pool.totalStaked -= user.amount;
        user.amount = 0;
        user.rewardDebt = 0;

        IKIP7(pool.lpToken).safeTransfer(msg.sender, oldUserAmount);
        emit EmergencyWithdraw(msg.sender, _pid, oldUserAmount);
    }

    /// @dev View function for checking pending PTN rewards.
    /// @param _pid The id of the pool. See `poolInfo`.
    /// @param _user Address of the user.
    function pendingPtn(uint256 _pid, address _user)
        external
        view
        returns (uint256)
    {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accPtnPerShare = pool.accPtnPerShare;
        uint256 lpSupply = pool.totalStaked;
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 multiplier = getMultiplier(
                _pid,
                pool.lastRewardBlock,
                block.number
            );
            uint256 ptnReward = (multiplier * ptnPerBlock * pool.allocPoint) /
                totalAllocPoint;
            accPtnPerShare =
                accPtnPerShare +
                ((ptnReward * ACC_PRECISION) / lpSupply);
        }
        return
            ((user.amount * accPtnPerShare) / ACC_PRECISION) - user.rewardDebt;
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
    function onKIP7Received(
        address _operator,
        address _from,
        uint256 _amount,
        bytes memory _data
    ) public pure returns (bytes4) {
        return 0x9d188c22;
    }
}
