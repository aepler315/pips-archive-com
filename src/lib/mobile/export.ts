import { isNativeApp } from "./platform";
import { encodeFile, validExportName } from "./policy";

/** Share through Android's file chooser; use an ordinary download on the website. */
export async function exportFile(blob: Blob, name: string): Promise<void> {
  if (!validExportName(name)) throw new Error("Invalid export filename");
  if (isNativeApp()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]);
    const { uri } = await Filesystem.writeFile({
      path: `exports/${name}`,
      directory: Directory.Cache,
      data: await encodeFile(blob),
      recursive: true,
    });
    // Keep the cache file after sharing: the receiving app may read it asynchronously.
    await Share.share({ title: name, files: [uri], dialogTitle: "Save or share" });
    return;
  }
  const url = URL.createObjectURL(blob);
  const anchor = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export async function copyText(text: string): Promise<void> {
  if (isNativeApp()) {
    const { Clipboard } = await import("@capacitor/clipboard");
    await Clipboard.write({ string: text });
  } else await navigator.clipboard.writeText(text);
}
