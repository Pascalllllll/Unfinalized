// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Unfinalized leaderboard
/// @notice Keeps each wallet's fastest claimed climb. The game runs in the
/// player's browser, so this contract cannot prove a run happened. What it
/// does enforce: a run must name a real post-merge mainnet slot time, must be
/// submitted within 15 minutes of that time, and each wallet can claim a given
/// mainnet block only once.
contract UnfinalizedBoard {
    /// Beacon chain genesis. Every post-merge mainnet block timestamp is
    /// MAINNET_GENESIS + 12 * slot.
    uint256 public constant MAINNET_GENESIS = 1606824023;
    uint256 public constant MAX_AGE = 15 minutes;
    uint256 public constant MAX_SKEW = 60;
    /// Climbing 9 blocks cannot take less than this; anything faster is a typo or a lie.
    uint32 public constant MIN_TIME_MS = 15_000;

    struct Best {
        uint64 caughtBlock;
        uint64 caughtAt;
        uint32 timeMs;
        uint16 stones;
        uint64 submittedAt;
    }

    mapping(address => Best) public best;
    address[] public runners;
    mapping(bytes32 => bool) public claimed;

    event RunSubmitted(
        address indexed runner,
        uint64 indexed caughtBlock,
        bytes32 caughtHash,
        uint64 caughtAt,
        uint32 timeMs,
        uint16 stones,
        bool personalBest
    );

    error NotASlotTime();
    error TooOld();
    error FromTheFuture();
    error TooFast();
    error AlreadyClaimed();

    /// @param caughtBlock mainnet block number the player reached
    /// @param caughtHash that block's hash, logged so anyone can check it against mainnet
    /// @param caughtAt that block's timestamp
    /// @param timeMs climb time in milliseconds
    /// @param stones transactions stood on during the climb
    function submit(uint64 caughtBlock, bytes32 caughtHash, uint64 caughtAt, uint32 timeMs, uint16 stones) external {
        if (caughtAt < MAINNET_GENESIS || (caughtAt - MAINNET_GENESIS) % 12 != 0) revert NotASlotTime();
        if (caughtAt > block.timestamp + MAX_SKEW) revert FromTheFuture();
        if (block.timestamp > caughtAt + MAX_AGE) revert TooOld();
        if (timeMs < MIN_TIME_MS) revert TooFast();

        bytes32 key = keccak256(abi.encode(msg.sender, caughtBlock));
        if (claimed[key]) revert AlreadyClaimed();
        claimed[key] = true;

        Best storage prev = best[msg.sender];
        bool first = prev.submittedAt == 0;
        bool personalBest = first || timeMs < prev.timeMs;
        if (first) runners.push(msg.sender);
        if (personalBest) {
            best[msg.sender] = Best(caughtBlock, caughtAt, timeMs, stones, uint64(block.timestamp));
        }
        emit RunSubmitted(msg.sender, caughtBlock, caughtHash, caughtAt, timeMs, stones, personalBest);
    }

    function runnerCount() external view returns (uint256) {
        return runners.length;
    }

    /// @notice Unsorted slice of every runner's best. The game sorts client-side.
    function page(uint256 offset, uint256 limit) external view returns (address[] memory who, Best[] memory bests) {
        uint256 n = runners.length;
        uint256 end = offset + limit > n ? n : offset + limit;
        uint256 len = offset < end ? end - offset : 0;
        who = new address[](len);
        bests = new Best[](len);
        for (uint256 i = 0; i < len; i++) {
            who[i] = runners[offset + i];
            bests[i] = best[who[i]];
        }
    }
}
