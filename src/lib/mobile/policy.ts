/** Platform decisions are separate from the native bridge so they can be tested in Node. */
export function backAction(overlay: boolean, canGoBack: boolean, path: string) {
  if (overlay) return "dismiss";
  if (canGoBack) return "back";
  return path === "/" ? "minimize" : "home";
}

export function validExportName(name: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name) && name.length <= 150;
}

export async function encodeFile(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 32768)
    binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(binary);
}
