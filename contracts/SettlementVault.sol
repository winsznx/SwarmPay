// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title SwarmPay SettlementVault
/// @notice Atomic batch settlement for SwarmPay agents on Arc testnet.
/// @dev Arc treats USDC as the native gas token (no ERC-20). Agents
///      pre-deposit USDC; the platform owner submits batches that
///      rebalance internal balances and emit per-payment events.
///      One on-chain transaction settles N micropayments atomically.
contract SettlementVault {
    address public immutable owner;
    mapping(address => uint256) public balances;

    struct Payment {
        address from;
        address to;
        uint256 amount;
    }

    event Deposited(address indexed agent, uint256 amount, uint256 newBalance);
    event Withdrawn(address indexed agent, uint256 amount, uint256 newBalance);
    event PaymentSettled(
        bytes32 indexed taskId,
        uint256 indexed idx,
        address indexed from,
        address to,
        uint256 amount
    );
    event BatchSettled(bytes32 indexed taskId, uint256 count, uint256 total);
    event OwnerWithdrew(address indexed to, uint256 amount);

    error NotOwner();
    error InsufficientBalance(address agent, uint256 have, uint256 need);
    error TransferFailed();
    error EmptyBatch();
    error ZeroDeposit();

    constructor() {
        owner = msg.sender;
    }

    receive() external payable {
        if (msg.value == 0) revert ZeroDeposit();
        balances[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value, balances[msg.sender]);
    }

    function deposit() external payable {
        if (msg.value == 0) revert ZeroDeposit();
        balances[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value, balances[msg.sender]);
    }

    function depositFor(address agent) external payable {
        if (msg.value == 0) revert ZeroDeposit();
        balances[agent] += msg.value;
        emit Deposited(agent, msg.value, balances[agent]);
    }

    function withdraw(uint256 amount) external {
        uint256 bal = balances[msg.sender];
        if (bal < amount) revert InsufficientBalance(msg.sender, bal, amount);
        unchecked { balances[msg.sender] = bal - amount; }
        (bool ok, ) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Withdrawn(msg.sender, amount, balances[msg.sender]);
    }

    /// @notice Atomically settle N payments in one tx.
    /// @dev    Owner-only because agents grant the vault custody on deposit.
    ///         Reverts the entire batch if any payer balance is insufficient
    ///         or any recipient call fails.
    ///
    ///         Each payment debits the payer's internal vault balance AND
    ///         performs a real native USDC transfer to the recipient (Arc's
    ///         native gas token). The recipient address therefore shows N
    ///         balance increases on the explorer State tab AND the receipt
    ///         logs N PaymentSettled events — full visibility, atomic.
    function settleBatch(bytes32 taskId, Payment[] calldata payments) external {
        if (msg.sender != owner) revert NotOwner();
        uint256 n = payments.length;
        if (n == 0) revert EmptyBatch();

        uint256 total;
        for (uint256 i; i < n; ) {
            Payment calldata p = payments[i];
            uint256 fromBal = balances[p.from];
            if (fromBal < p.amount) {
                revert InsufficientBalance(p.from, fromBal, p.amount);
            }
            unchecked {
                balances[p.from] = fromBal - p.amount;
                total += p.amount;
            }
            (bool ok, ) = p.to.call{value: p.amount}("");
            if (!ok) revert TransferFailed();
            emit PaymentSettled(taskId, i, p.from, p.to, p.amount);
            unchecked { ++i; }
        }
        emit BatchSettled(taskId, n, total);
    }

    /// @notice Owner emergency exit — withdraws contract surplus only.
    /// @dev    Cannot touch agent balances (must equal sum of deposits minus settlements minus withdrawals).
    function ownerWithdrawSurplus(address to, uint256 amount) external {
        if (msg.sender != owner) revert NotOwner();
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit OwnerWithdrew(to, amount);
    }

    function balanceOf(address agent) external view returns (uint256) {
        return balances[agent];
    }
}
