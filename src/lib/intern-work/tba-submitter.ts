import { createPublicClient, createWalletClient, encodeFunctionData, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const SUBMIT_RESULT_SELECTOR="0xd2ee66cf";
const VALID_SIGNER_MAGIC="0x523e3260";
const tbaAbi=parseAbi([
 "function isValidSigner(address signer,bytes context) view returns (bytes4)",
 "function execute(address to,uint256 value,bytes data,uint8 operation) payable returns (bytes)"
]);

type ResultIntent={chainId:number;to:string;value:string;data:string;function?:string;functionSignature?:string;requiredSigner:string;requiresExternalSigner:boolean;broadcast:boolean};

function address(v:unknown):v is `0x${string}`{return typeof v==="string"&&/^0x[0-9a-fA-F]{40}$/.test(v);}
function txData(v:unknown):v is `0x${string}`{return typeof v==="string"&&/^0x[0-9a-fA-F]*$/.test(v);}
function privateKey(v:string|undefined):v is `0x${string}`{return /^0x[0-9a-fA-F]{64}$/.test(v??"");}

export function validateResultIntent(raw:unknown,workerTba:string,expectedEscrow:string,expectedChainId:number){
 const x=raw as ResultIntent;
 if(!x||x.broadcast!==false||x.requiresExternalSigner!==true)throw new Error("UNSAFE_RESULT_INTENT");
 if(!address(workerTba)||!address(x.requiredSigner)||x.requiredSigner.toLowerCase()!==workerTba.toLowerCase())throw new Error("RESULT_SIGNER_MISMATCH");
 if(!address(expectedEscrow)||!address(x.to)||x.to.toLowerCase()!==expectedEscrow.toLowerCase())throw new Error("RESULT_TARGET_MISMATCH");
 if(Number(x.chainId)!==expectedChainId)throw new Error("RESULT_CHAIN_MISMATCH");
 if(String(x.value)!=="0")throw new Error("RESULT_VALUE_NOT_ZERO");
 if(!txData(x.data)||!x.data.toLowerCase().startsWith(SUBMIT_RESULT_SELECTOR))throw new Error("RESULT_SELECTOR_MISMATCH");
 if(x.function&&x.function!=="submitResult")throw new Error("RESULT_FUNCTION_MISMATCH");
 if(x.functionSignature&&x.functionSignature!=="submitResult(uint256,bytes32)")throw new Error("RESULT_SIGNATURE_MISMATCH");
 return x;
}

export async function submitResultThroughTba(raw:unknown,workerTba:string){
 if(process.env.INTERN_WORK_AUTOSUBMIT!=="1")return {submitted:false as const,reason:"AUTOSUBMIT_DISABLED"};
 const rpcUrl=process.env.INTERN_WORK_RPC_URL,escrow=process.env.INTERN_WORK_ESCROW_ADDRESS;
 const chainId=Number(process.env.INTERN_WORK_CHAIN_ID??"46630");
 if(!rpcUrl?.startsWith("https://")||!address(escrow)||!Number.isSafeInteger(chainId)||chainId<=0)throw new Error("INTERN_WORK_CHAIN_NOT_CONFIGURED");
 const key=process.env.SWARM_WALLET_PRIVATE_KEY;
 if(!privateKey(key))throw new Error("INTERN_WORK_TBA_CONTROLLER_NOT_CONFIGURED");
 const intent=validateResultIntent(raw,workerTba,escrow,chainId);
 const account=privateKeyToAccount(key);
 const transport=http(rpcUrl);
 const pub=createPublicClient({transport});
 const magic=await pub.readContract({address:workerTba as `0x${string}`,abi:tbaAbi,functionName:"isValidSigner",args:[account.address,"0x"]});
 if(String(magic).toLowerCase()!==VALID_SIGNER_MAGIC)throw new Error("TBA_CONTROLLER_NOT_AUTHORIZED");
 const data=encodeFunctionData({abi:tbaAbi,functionName:"execute",args:[intent.to as `0x${string}`,0n,intent.data as `0x${string}`,0]});
 const wallet=createWalletClient({account,transport});
 const hash=await wallet.sendTransaction({account,to:workerTba as `0x${string}`,value:0n,data,chain:{id:chainId,name:`Intern Work ${chainId}`,nativeCurrency:{name:"Ether",symbol:"ETH",decimals:18},rpcUrls:{default:{http:[rpcUrl]}}}});
 const receipt=await pub.waitForTransactionReceipt({hash});
 if(receipt.status!=="success")throw new Error("TBA_SUBMIT_REVERTED");
 return {submitted:true as const,hash,blockNumber:receipt.blockNumber.toString()};
}
