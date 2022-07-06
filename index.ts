import express, { Express, NextFunction, Request, Response } from "express";

import { MerkleTree } from "merkletreejs";
import cors from "cors";
import dotenv from "dotenv";
import editJsonFile from "edit-json-file";
import keccak256 from "keccak256";
import morgan from "morgan";

const app: Express = express();

dotenv.config();

const PORT = process.env.PORT || 8012;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));
app.use(morgan("dev"));
app.use(cors());

type Error = {
  status: number;
  message: string;
};
let merkleTreeStored: MerkleTree;

(() => {
  try {
    let file = editJsonFile(`${__dirname}/addresses.json`);
    const addresses = file.get("whitelist");
    if (!addresses) return;
    if (addresses.length === 0) return;

    const leafNodes = addresses.map((addr: string) => keccak256(addr));
    const merkleTree = new MerkleTree(leafNodes, keccak256, {
      sortPairs: true,
    });
    merkleTreeStored = merkleTree;
    return;
  } catch (e) {
    console.log(e);
  }
})();
app.get("/", async (req: Request, res: Response) => {
  res.status(200).json({
    error: false,
    status: true,
    message: "WHITELIST",
  });
});

app.get("/addresses", async (req: Request, res: Response) => {
  try {
    let file = editJsonFile(`${__dirname}/addresses.json`);
    const addresses = file.get("whitelist");
    if (!addresses)
      return res
        .status(200)
        .json({ error: true, status: false, message: "No Addresses Found!" });

    res.status(200).json({
      status: true,
      message: "Addresses Fetched!",
      error: false,
      data: addresses,
    });
  } catch (e) {
    console.log(e);
    res.status(500).send("Internal Server Error!");
  }
});

app.get("/add/address/:addr", async (req: Request, res: Response) => {
  try {
    const { addr } = req.params;
    if (!addr)
      return res.status(200).json({
        status: false,
        error: true,
        message: "Invalid Address Sent!",
      });
    let file = editJsonFile(`${__dirname}/addresses.json`);
    const addresses = file.get("whitelist");
    if (!addresses) {
      file.set("whitelist", [addr]);
      file.save();
      return res.status(200).json({
        status: true,
        error: false,
        message: `${addr} is successfully added to whitelist.`,
      });
    } else {
      const exists = addresses.find((add: string) => add === addr);
      if (exists)
        return res.status(200).json({
          status: false,
          error: true,
          message: "Address is already Whitelisted!",
        });
      addresses.push(addr);
      file.set("whitelist", addresses);
      file.save();
      res.status(200).json({
        status: true,
        error: false,
        message: `${addr} is successfully added to whitelist.`,
      });
    }
  } catch (e) {
    console.log(e);
    res.status(500).send("Internal Server Error!");
  }
});

app.post("/set/address", async (req: Request, res: Response) => {
  try {
    const { address } = req.body;
    if (!address)
      return res.status(200).json({
        status: false,
        error: true,
        message: "Invalid Addresses Sent!",
      });
    let file = editJsonFile(`${__dirname}/addresses.json`);
    file.set("whitelist", address);
    file.save();
    res.status(200).json({
      status: true,
      error: false,
      message: `total ${address.length} addresses Assigned to whitelist.`,
    });
  } catch (e) {
    console.log(e);
    res.status(500).send("Internal Server Error!");
  }
});

app.get("/generate", async (req: Request, res: Response) => {
  try {
    let file = editJsonFile(`${__dirname}/addresses.json`);
    const addresses = file.get("whitelist");
    if (!addresses)
      return res.status(200).json({
        status: false,
        error: true,
        message: "No Addresses Found!",
      });
    if (addresses.length === 0)
      return res.status(200).json({
        status: false,
        error: true,
        message: "Addresses Are Empty!",
      });

    const leafNodes = addresses.map((addr: string) => keccak256(addr));
    const merkleTree = new MerkleTree(leafNodes, keccak256, {
      sortPairs: true,
    });
    merkleTreeStored = merkleTree;
    res.status(200).json({
      status: true,
      error: false,
      message:
        "Tree Generated , Root Hash: " + merkleTree.getHexRoot().toString(),
    });
  } catch (e) {
    console.log(e);
    res.status(500).send("Something Went Wrong");
  }
});

app.get("/getproof/:addr", async (req: Request, res: Response) => {
  try {
    const { addr } = req.params;
    if (!addr)
      return res.status(200).json({
        status: false,
        error: true,
        message: "Invalid Address Supplied!",
      });
    if (!merkleTreeStored)
      return res.status(200).json({
        status: false,
        error: true,
        message: "Tree Not Generated Yet!",
      });
    const leaf = keccak256(addr);
    const hexProof = merkleTreeStored.getHexProof(leaf);
    const whitelisted = merkleTreeStored.verify(
      hexProof,
      leaf,
      merkleTreeStored.getHexRoot()
    );
    if (!whitelisted)
      return res.status(200).json({
        status: false,
        error: true,
        message: "Wallet Not Whitelisted!",
      });
    res.status(200).json({
      status: true,
      error: false,
      message: `Wallet ${addr} is present in whitelist.`,
      proof: hexProof,
    });
  } catch (e) {
    console.log(e);
    res.status(500).send("Internal Server Error!");
  }
});

app.get("/getroot", async (req: Request, res: Response) => {
  try {
    if (!merkleTreeStored)
      return res.status(200).json({
        status: false,
        error: true,
        message: "Tree Not Generated Yet!",
      });
    const rootHash = merkleTreeStored.getHexRoot().toString();
    res.status(200).json({
      error: false,
      status: true,
      message: `Root Hash: ${rootHash}`,
    });
  } catch (e) {
    console.log(e);
    res.status(500).send("Internal Server Error!");
  }
});

app.use(async (req: Request, res: Response, next: NextFunction) => {
  res.status(404).send("404");
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.log(err);
  res.status(err.status || 500);
  res.send({
    error: {
      status: err.status || 500,
      message: err.message,
    },
  });
});

app.listen(PORT, () => {
  console.log(`Server ${process.pid} Up on ${PORT}`);
});
