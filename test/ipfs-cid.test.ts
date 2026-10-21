import { describe, expect, it } from "vitest";
import { computeIPFSCIDs, verifyIPFSHash } from "@/lib/ipfs-cid";
import { verifyDownloadedContent } from "@/lib/ipfs";

const CHUNK = 262144;

function payload(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  for (let i = 0; i < size; i++) bytes[i] = (i * 31 + 7) & 255;
  return bytes;
}

// Roots produced by ipfs-unixfs-importer (default 256 KiB chunker, balanced
// layout) for payload(size): [size, rawLeaves, root CID].
const REFERENCE: Array<[number, boolean, string]> = [
  [0, false, "QmbFMke1KXqnYyBBWxB74N4c5SBnJMVAiMNRcGu6x1AwQH"],
  [0, true, "bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku"],
  [100, false, "QmQ11PSrvgsMA6cnoY5rJrhGNnntDMBP8Teg4V64xrhp5X"],
  [100, true, "bafkreigcfzeq3ksel6zpxjccpdacfxytkmip2j4mvpfevv4rt3o4zti5zy"],
  [262144, false, "QmVV5RrHAR5ZerjbGLJSDXCBjkiR1DraddGdvKRAowDJvA"],
  [262144, true, "bafkreigtb2zed6k6pq34amzfdj4ovylbble3alojsysuiikydagtlammdm"],
  [262145, false, "QmS7fy4bE586ZCgYuxrdNEhggP1Cm5FBuZaqmgtfSqFizr"],
  [262145, true, "bafybeif4z4ikxldcsjhv2l4sxmk57abnwjkwpa57gopqjvdhkyxddhmzf4"],
  [524288, false, "QmPuckKbndF5UWST3PDx65jPCrVggFtaK9r9pQQyu2fA7i"],
  [524288, true, "bafybeie7ws7kynitnqn7anm44icz7vnjxhn6wqh7qxssk42oxyhq5lf5na"],
  [1048576, false, "QmNWqKQ5e1RDkbEcLuBC6f5mBKQsocsnJMBt8HgapxH4ji"],
  [1048576, true, "bafybeiauqn2tgwkyydo5v62clfl5vtokgwet2o3qpoaaxihbnh3ehac3am"],
  [1048577, false, "QmaRNrA7eVwnm6NGGWLzz3BsoNBHxjNFNxiuECZi8dAQTe"],
  [1048577, true, "bafybeihysgc544qyg3rz4xmy3npkqb77hgvt33wymo23qfeefwubq6g4yq"],
  [45875205, false, "QmeCMejtgSEf5d3pCSbpQfD64v963HVT6kbJghPKVruowj"],
  [45875205, true, "bafybeiaedwboyer3zupya74qmrdt7pnbnzjdfsllyoatv6at3chvumqqcu"],
];

describe("IPFS CIDs for multi-chunk files", () => {
  it.each(REFERENCE)(
    "matches the reference importer for %i bytes (raw leaves: %s)",
    async (size, raw, expected) => {
      const cids = await computeIPFSCIDs(payload(size));
      expect(raw ? cids.cidV1Raw : cids.cidV0).toBe(expected);
    }
  );

  it("verifies a 1 MB payload and the exact 256 KiB boundary", async () => {
    for (const size of [CHUNK, CHUNK + 1, 1024 * 1024]) {
      const bytes = payload(size);
      const cids = await computeIPFSCIDs(bytes);
      await expect(verifyIPFSHash(cids.cidV0, bytes)).resolves.toBe(true);
      await expect(verifyIPFSHash(cids.cidV1Raw, bytes)).resolves.toBe(true);
      await expect(verifyDownloadedContent(cids.cidV0, bytes)).resolves.toBe(true);
    }
  });

  it("still rejects tampered multi-chunk bytes", async () => {
    const bytes = payload(1024 * 1024);
    const { cidV0 } = await computeIPFSCIDs(bytes);
    const tampered = bytes.slice();
    tampered[CHUNK + 5] ^= 1;
    await expect(verifyDownloadedContent(cidV0, tampered)).resolves.toBe(false);
    await expect(verifyDownloadedContent(cidV0, bytes.subarray(0, CHUNK))).resolves.toBe(false);
  });
});
