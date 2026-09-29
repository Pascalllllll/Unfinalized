// Generated from contracts/UnfinalizedBoard.sol with solc 0.8.28+commit.7893614a.Emscripten.clang (optimizer, 200 runs, shanghai).
export const abi = [
  {
    "inputs": [],
    "name": "AlreadyClaimed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "FromTheFuture",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotASlotTime",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "TooFast",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "TooOld",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "runner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint64",
        "name": "caughtBlock",
        "type": "uint64"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "caughtHash",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "uint64",
        "name": "caughtAt",
        "type": "uint64"
      },
      {
        "indexed": false,
        "internalType": "uint32",
        "name": "timeMs",
        "type": "uint32"
      },
      {
        "indexed": false,
        "internalType": "uint16",
        "name": "stones",
        "type": "uint16"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "personalBest",
        "type": "bool"
      }
    ],
    "name": "RunSubmitted",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "MAINNET_GENESIS",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MAX_AGE",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MAX_SKEW",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MIN_TIME_MS",
    "outputs": [
      {
        "internalType": "uint32",
        "name": "",
        "type": "uint32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "best",
    "outputs": [
      {
        "internalType": "uint64",
        "name": "caughtBlock",
        "type": "uint64"
      },
      {
        "internalType": "uint64",
        "name": "caughtAt",
        "type": "uint64"
      },
      {
        "internalType": "uint32",
        "name": "timeMs",
        "type": "uint32"
      },
      {
        "internalType": "uint16",
        "name": "stones",
        "type": "uint16"
      },
      {
        "internalType": "uint64",
        "name": "submittedAt",
        "type": "uint64"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "name": "claimed",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "offset",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "limit",
        "type": "uint256"
      }
    ],
    "name": "page",
    "outputs": [
      {
        "internalType": "address[]",
        "name": "who",
        "type": "address[]"
      },
      {
        "components": [
          {
            "internalType": "uint64",
            "name": "caughtBlock",
            "type": "uint64"
          },
          {
            "internalType": "uint64",
            "name": "caughtAt",
            "type": "uint64"
          },
          {
            "internalType": "uint32",
            "name": "timeMs",
            "type": "uint32"
          },
          {
            "internalType": "uint16",
            "name": "stones",
            "type": "uint16"
          },
          {
            "internalType": "uint64",
            "name": "submittedAt",
            "type": "uint64"
          }
        ],
        "internalType": "struct UnfinalizedBoard.Best[]",
        "name": "bests",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "runnerCount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "runners",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint64",
        "name": "caughtBlock",
        "type": "uint64"
      },
      {
        "internalType": "bytes32",
        "name": "caughtHash",
        "type": "bytes32"
      },
      {
        "internalType": "uint64",
        "name": "caughtAt",
        "type": "uint64"
      },
      {
        "internalType": "uint32",
        "name": "timeMs",
        "type": "uint32"
      },
      {
        "internalType": "uint16",
        "name": "stones",
        "type": "uint16"
      }
    ],
    "name": "submit",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

export const bytecode = '0x6080604052348015600e575f5ffd5b50610a4d8061001c5f395ff3fe608060405234801561000f575f5ffd5b506004361061009b575f3560e01c8063cc3c0f0611610063578063cc3c0f0614610101578063d53bb09214610133578063ebb9e69c146101cd578063f307deac146101ee578063f66d68451461020c575f5ffd5b80630dcaeaf21461009f57806347e9907b146100bb5780639b15b74f146100e6578063b1e67148146100f1578063be5db8e4146100f9575b5f5ffd5b6100a861038481565b6040519081526020015b60405180910390f35b6100ce6100c93660046107c5565b610221565b6040516001600160a01b0390911681526020016100b2565b6100a8635fc6305781565b6100a8603c81565b6001546100a8565b61012361010f3660046107c5565b60026020525f908152604090205460ff1681565b60405190151581526020016100b2565b61018b6101413660046107dc565b5f602081905290815260409020546001600160401b0380821691600160401b810482169163ffffffff600160801b8304169161ffff600160a01b82041691600160b01b9091041685565b604080516001600160401b039687168152948616602086015263ffffffff9093169284019290925261ffff16606083015291909116608082015260a0016100b2565b6101e06101db366004610809565b610249565b6040516100b2929190610829565b6101f7613a9881565b60405163ffffffff90911681526020016100b2565b61021f61021a366004610922565b61047e565b005b60018181548110610230575f80fd5b5f918252602090912001546001600160a01b0316905081565b60015460609081905f8161025d86886109a4565b116102715761026c85876109a4565b610273565b815b90505f818710610283575f61028d565b61028d87836109bd565b9050806001600160401b038111156102a7576102a76109d0565b6040519080825280602002602001820160405280156102d0578160200160208202803683370190505b509450806001600160401b038111156102eb576102eb6109d0565b60405190808252806020026020018201604052801561034257816020015b6040805160a0810182525f808252602080830182905292820181905260608201819052608082015282525f199092019101816103095790505b5093505f5b8181101561047357600161035b828a6109a4565b8154811061036b5761036b6109e4565b905f5260205f20015f9054906101000a90046001600160a01b0316868281518110610398576103986109e4565b60200260200101906001600160a01b031690816001600160a01b0316815250505f5f8783815181106103cc576103cc6109e4565b6020908102919091018101516001600160a01b031682528181019290925260409081015f20815160a08101835290546001600160401b038082168352600160401b820481169483019490945263ffffffff600160801b8204169282019290925261ffff600160a01b8304166060820152600160b01b90910490911660808201528551869083908110610460576104606109e4565b6020908102919091010152600101610347565b505050509250929050565b635fc63057836001600160401b031610806104ba5750600c6104ad635fc630576001600160401b0386166109bd565b6104b791906109f8565b15155b156104d857604051638d8843d160e01b815260040160405180910390fd5b6104e3603c426109a4565b836001600160401b0316111561050c5760405163716bd56760e11b815260040160405180910390fd5b6105216103846001600160401b0385166109a4565b4211156105415760405163da5eb10960e01b815260040160405180910390fd5b613a9863ffffffff8316101561056a576040516373e6dcff60e01b815260040160405180910390fd5b60408051336020808301919091526001600160401b03881682840152825180830384018152606090920183528151918101919091205f81815260029092529190205460ff16156105cd57604051630c8d9eab60e31b815260040160405180910390fd5b5f8181526002602090815260408083208054600160ff1990911617905533835290829052812080549091600160b01b9091046001600160401b0316159081806106275750825463ffffffff600160801b9091048116908716105b90508115610670576001805480820182555f919091527fb10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf60180546001600160a01b031916331790555b8015610753576040805160a0810182526001600160401b03808c168252898116602080840191825263ffffffff808c1685870190815261ffff808d166060880190815242871660808901908152335f90815295869052989094209651875495519251945198518716600160b01b0267ffffffffffffffff60b01b1999909216600160a01b0261ffff60a01b1995909416600160801b029490941665ffffffffffff60801b19928716600160401b026fffffffffffffffffffffffffffffffff19909616949096169390931793909317929092169290921717929092169190911790555b604080518981526001600160401b03898116602083015263ffffffff89168284015261ffff8816606083015283151560808301529151918b169133917f0ead27b873beacb6c8c71d95efbf939b7808ee958212cfa1f71ae73d2ab705db919081900360a00190a3505050505050505050565b5f602082840312156107d5575f5ffd5b5035919050565b5f602082840312156107ec575f5ffd5b81356001600160a01b0381168114610802575f5ffd5b9392505050565b5f5f6040838503121561081a575f5ffd5b50508035926020909101359150565b604080825283519082018190525f9060208501906060840190835b8181101561086b5783516001600160a01b0316835260209384019390920191600101610844565b5050838103602080860191909152855180835291810192508501905f5b818110156108fb5782516001600160401b0381511685526001600160401b03602082015116602086015263ffffffff604082015116604086015261ffff60608201511660608601526001600160401b0360808201511660808601525060a084019350602083019250600181019050610888565b50919695505050505050565b80356001600160401b038116811461091d575f5ffd5b919050565b5f5f5f5f5f60a08688031215610936575f5ffd5b61093f86610907565b94506020860135935061095460408701610907565b9250606086013563ffffffff8116811461096c575f5ffd5b9150608086013561ffff81168114610982575f5ffd5b809150509295509295909350565b634e487b7160e01b5f52601160045260245ffd5b808201808211156109b7576109b7610990565b92915050565b818103818111156109b7576109b7610990565b634e487b7160e01b5f52604160045260245ffd5b634e487b7160e01b5f52603260045260245ffd5b5f82610a1257634e487b7160e01b5f52601260045260245ffd5b50069056fea26469706673582212204dc19c62d8baf3b84de6740b2f57de00865572819a196b5727fe09710a76e05a64736f6c634300081c0033';
