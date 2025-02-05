import { readJson, saveNewFile, sleep } from "./utils"
import { PRIVATE_KEY, RPC_ENDPOINT, RPC_WEBSOCKET_ENDPOINT } from "./constants";
import { Transaction } from "@mysten/sui/transactions";
import { SuiClient } from "@mysten/sui/client";
import { SuiKit } from "./src";
import { BN } from "bn.js";

const client = new SuiClient({ url: RPC_ENDPOINT })
const mainSui = new SuiKit({ secretKey: PRIVATE_KEY, fullnodeUrls: [RPC_ENDPOINT] })

const main = async () => {
  let length = readJson().length

    console.log("Trying to gather")
    const walletsData = readJson()
    length = walletsData.length
    if (length == 0){
      console.log("================== All gathered ==================")
      return
    }

    const wallets = walletsData.map(({ privateKey }) => new SuiKit({ secretKey: privateKey, fullnodeUrls: [RPC_ENDPOINT] }))
    wallets.map(async (suiWallet, i) => {
      try {
        await sleep(i * 1000)
        const balance = await suiWallet.getBalance('0x2::sui::SUI')
        console.log("Balance:", balance.totalBalance)

        if (Number(balance.totalBalance) == 0) {
          const walletsData = readJson()
          const wallets = walletsData.filter(({ pubkey }) => suiWallet.getAddress() != pubkey)
          saveNewFile(wallets)
          console.log("Removed wallet.")
          return
        }

        if (Number(balance.totalBalance) <= 3000000) {
          const transferAmount = Number(new BN(3000000).sub(new BN(balance.totalBalance)))
          const resp = await mainSui.transferSui(suiWallet.getAddress(), transferAmount)
          await client.waitForTransaction({
            digest: resp.digest,
            options: {
              showBalanceChanges: true,
            },
          });
          console.log("Transfer wallet, signature : ", resp.digest)
          await sleep(3000)
        }

        try {
          const tx = new Transaction()
          tx.transferObjects([tx.gas], mainSui.getAddress())
          if (tx) {
            const txId = await client.signAndExecuteTransaction({ transaction: tx, signer: suiWallet.getKeypair() })
            await client.waitForTransaction({
              digest: txId.digest,
              options: {
                showBalanceChanges: true,
              },
            });
            console.log("Transfer SUI back to main wallet, signature : ", txId.digest)
          }

        } catch (error) {
          console.log("Transaction error while transferring to main")
          return
        }

        const balanceAfter = await suiWallet.getBalance('0x2::sui::SUI')
        if (balanceAfter.totalBalance == "0") {
          const walletsData = readJson()
          const wallets = walletsData.filter(({ pubkey }) => suiWallet.getAddress() != pubkey)
          saveNewFile(wallets)
          console.log("Removed wallet.")
        }
        
      } catch (error) {
        console.log("Transaction error while gathering")
        return
      }
    })
}

main()
