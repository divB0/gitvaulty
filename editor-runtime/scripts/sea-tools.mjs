export const SEA_SENTINEL_FUSE = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";

/**
 * @param {(filename: string, resourceName: string, resourceData: Buffer, options: { sentinelFuse: string, machoSegmentName?: string }) => Promise<unknown>} inject
 * @param {string} executable
 * @param {Buffer} blob
 * @param {NodeJS.Platform} platform
 */
export async function injectSeaBlob(inject, executable, blob, platform) {
  /** @type {{ sentinelFuse: string, machoSegmentName?: string }} */
  const options = { sentinelFuse: SEA_SENTINEL_FUSE };
  if (platform === "darwin") options.machoSegmentName = "NODE_SEA";
  await inject(executable, "NODE_SEA_BLOB", blob, options);
}
