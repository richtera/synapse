#!/usr/bin/env node
const Web3 = require("web3");
const Web3Token = require("web3-token/dist/web3-token.common");
global.fetch = require("node-fetch");

const { ERC725 } = require("@erc725/erc725.js");
const erc725schema = require("@erc725/erc725.js/schemas/LSP3UniversalProfileMetadata.json");
const permissionsSchema = require("@erc725/erc725.js/schemas/LSP12IssuedAssets.json");
// Network and storage
const RPC_ENDPOINT = "https://rpc.l16.lukso.network";
const IPFS_GATEWAY = "https://2eff.lukso.dev/ipfs/";

// Parameters for the ERC725 instance
const provider = new Web3.providers.HttpProvider(RPC_ENDPOINT);
const config = { ipfsGateway: IPFS_GATEWAY };
const web3 = new Web3(provider);

const getData = async (address, keys, web3) => {
  const Contract = new web3.eth.Contract(
    [
      {
        stateMutability: "view",
        type: "function",
        inputs: [
          {
            internalType: "bytes32[]",
            name: "_keys",
            type: "bytes32[]",
          },
        ],
        name: "getData",
        outputs: [
          {
            internalType: "bytes[]",
            name: "values",
            type: "bytes[]",
          },
        ],
      },
    ],
    address
  );

  let data = [];
  try {
    data = await Contract.methods.getData(keys).call();
  } catch (err) {
    console.log(err.message);
  }
  return data;
};

async function readProfile(address, item) {
  try {
    const result = await getData(address, [item.key], web3);
    const schema = [item];
    const erc725 = new ERC725(schema, address, web3.currentProvider);

    const decodedData = erc725.decodeData([
      {
        keyName: item.name,
        result,
      },
    ]);

    if (item.keyType === "Array") {
      const result = await erc725.getData(item.name);
      return result.value;
    }
    throw new Error("No address list found");
  } catch (err) {
    console.error("error", err);
    process.exit(1);
  }
}

const zmq = require("zeromq");

function hexDecode(str) {
  str = str.replace(/^0x/, "");
  return Buffer.from(str, "hex");
}

async function run() {
  const sock = new zmq.Reply();

  await sock.bind("tcp://127.0.0.1:5555");

  for await (const [msg] of sock) {
    try {
      const data = JSON.parse(msg.toString());
      console.log("Data", data);
      const { address: tokenAddress, body } = await Web3Token.verify(
        data.token
      );
      const [_ignpore, address, machine] = /@([^:]*):(.*)$/.exec(data.address);

      const local = hexDecode(tokenAddress);
      if (local.compare(hexDecode(address)) === 0) {
        data.success = true;
        data.body = body;

        console.log("Success Address & Body", address, machine, body);

        // Disallow metamask logins.
        await sock.send(Buffer.from(JSON.stringify({ success: false })));
        continue;
      }

      console.log("UP Address & Body", address, machine, body);
      const value = await readProfile(address, {
        name: "AddressPermissions[]",
        key: "0xdf30dba06db6a30e65354d9a64c609861f089545ca58c6b4dbe31a5f338cb0e3",
        keyType: "Array",
        valueType: "address",
        valueContent: "Address",
      });

      const success = value
        .map((item) => hexDecode(item))
        .some((buf) => buf.compare(local) === 0);

      console.log("success", success);
      await sock.send(Buffer.from(JSON.stringify({ success })));
    } catch (err) {
      console.log("Error", err);
      await sock.send(Buffer.from(JSON.stringify(err)));
    }
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error", err);
    process.exit(1);
  });
