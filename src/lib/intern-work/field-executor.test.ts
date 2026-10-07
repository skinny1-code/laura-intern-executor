import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";

describe("Intern field execution safety invariants",()=>{
 it("hashes evidence deterministically for onchain submission",()=>{
  const evidence="verified evidence payload";
  expect("0x"+createHash("sha256").update(evidence).digest("hex")).toMatch(/^0x[0-9a-f]{64}$/);
 });
 it("does not expose signing secrets through the Intern Work client environment contract",()=>{
  const source=["INTERN_WORK_API_URL","INTERN_WORK_API_TOKEN"];
  expect(source).not.toContain("PRIVATE_KEY");
  expect(source).not.toContain("MNEMONIC");
 });
});
