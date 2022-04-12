// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.12;

import '../interfaces/IDexKIP7.sol';
import '../interfaces/IKIPReciever.sol';
import '../utils/Address.sol';
import '../utils/KIP13.sol';

contract KIP7 is IKIP7, KIP13 {
    using Address for address;

    mapping(address => uint256) private _balances;

    mapping(address => mapping(address => uint256)) private _allowances;

    uint256 private _totalSupply;

    string private _name;
    string private _symbol;
    uint8 private _decimals;


    // Equals to `bytes4(keccak256("onKIP7Received(address,address,uint256,bytes)"))`
    // which can be also obtained as `IKIP7Receiver(0).onKIP7Received.selector`
    bytes4 private constant _KIP7_RECEIVED = 0x9d188c22;
    bytes4 private constant _INTERFACE_ID_KIP7 = 0x65787371;
    bytes4 private constant _INTERFACE_ID_KIP7_METADATA = 0xa219a025;


    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
        _name = name_;
        _symbol = symbol_;
        _decimals = decimals_;
        _registerInterface(_INTERFACE_ID_KIP7);
        _registerInterface(_INTERFACE_ID_KIP7_METADATA);

    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {}

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {}

    function _mint(address account, uint256 amount) internal virtual {
        require(account != address(0), "KIP7: mint to the zero address");

        _beforeTokenTransfer(address(0), account, amount);

        _totalSupply += amount;
        _balances[account] += amount;
        emit Transfer(address(0), account, amount);

        _afterTokenTransfer(address(0), account, amount);
    }

    function _burn(address account, uint256 amount) internal virtual {
        require(account != address(0), "KIP7: burn from the zero address");

        _beforeTokenTransfer(account, address(0), amount);

        uint256 accountBalance = _balances[account];
        require(accountBalance >= amount, "ERC20: burn amount exceeds balance");
        unchecked {
            _balances[account] = accountBalance - amount;
        }
        _totalSupply -= amount;

        emit Transfer(account, address(0), amount);

        _afterTokenTransfer(account, address(0), amount);
    }

    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual {
        require(owner != address(0), "KIP7: approve from the zero address");
        require(spender != address(0), "KIP7: approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {
        require(from != address(0), "KIP7: transfer from the zero address");
        require(to != address(0), "KIP7: transfer to the zero address");

        _beforeTokenTransfer(from, to, amount);

        uint256 fromBalance = _balances[from];
        require(fromBalance >= amount, "KIP7: transfer amount exceeds balance");
        unchecked {
            _balances[from] = fromBalance - amount;
        }
        _balances[to] += amount;

        emit Transfer(from, to, amount);

        _afterTokenTransfer(from, to, amount);
    }


    function name() public view virtual returns (string memory) {
        return _name;
    }

    function symbol() public view virtual returns (string memory) {
        return _symbol;
    }

    function decimals() public view virtual returns (uint8) {
        return _decimals;
    }

    function totalSupply() public view virtual override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view virtual override returns (uint256) {
        return _balances[account];
    }

    function allowance(address owner, address spender) public view virtual override returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint amount) public virtual override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint amount) public virtual override returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint amount) public virtual override returns (bool) {
        uint currentAllowance = _allowances[from][msg.sender];
        if (currentAllowance != type(uint).max) {
            require(currentAllowance >= amount, "KIP7: insufficient allowance");
            _allowances[from][msg.sender] = currentAllowance - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    /**
    * @dev  Moves `amount` tokens from the caller's account to `recipient`.
    */
    function safeTransfer(address recipient, uint256 amount) external {
        safeTransfer(recipient, amount, "");
    }

    /**
    * @dev Moves `amount` tokens from the caller's account to `recipient`.
    */
    function safeTransfer(address recipient, uint256 amount, bytes memory data) public {
        transfer(recipient, amount);
        require(_checkOnKIP7Received(msg.sender, recipient, amount, data), "KIP7: transfer to non KIP7Receiver implementer");
    }

    /**
    * @dev Moves `amount` tokens from `sender` to `recipient` using the allowance mechanism.
    * `amount` is then deducted from the caller's allowance.
    */
    function safeTransferFrom(address sender, address recipient, uint256 amount) external {
        safeTransferFrom(sender, recipient, amount, "");
    }

    /**
    * @dev Moves `amount` tokens from `sender` to `recipient` using the allowance mechanism.
    * `amount` is then deducted from the caller's allowance.
    */
    function safeTransferFrom(address sender, address recipient, uint256 amount, bytes memory data) public {
        transferFrom(sender, recipient, amount);
        require(_checkOnKIP7Received(sender, recipient, amount, data), "KIP7: transfer to non KIP7Receiver implementer");
    }

    /**
     * @dev Internal function to invoke `onKIP7Received` on a target address.
     * The call is not executed if the target address is not a contract.
     */
    function _checkOnKIP7Received(address sender, address recipient, uint256 amount, bytes memory _data)
        internal returns (bool)
    {
        if (!recipient.isContract()) {
            return true;
        }

        bytes4 retval = IKIP7TokenReceiver(recipient).onKIP7Received(msg.sender, sender, amount, _data);
        return (retval == _KIP7_RECEIVED);
    }
}
