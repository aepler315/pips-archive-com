import { validResultDate } from "./daily-results";

/** Clone the rendered card alone, at the same width but without scroll/animation limits. */
export async function renderResultsPng(node: HTMLElement, date: string): Promise<Blob> {
  if (!validResultDate(date)) throw new Error("Invalid puzzle date");
  const width = node.getBoundingClientRect().width;
  if (!width) throw new Error("The results card is not laid out");
  const host = document.createElement("div");
  host.className = "results-export";
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;pointer-events:none;`;
  const clone = node.cloneNode(true) as HTMLElement;
  host.appendChild(clone);
  document.body.appendChild(host);
  try {
    const { toBlob } = await import("html-to-image");
    await document.fonts.ready;
    const blob = await toBlob(clone, {
      pixelRatio: 2,
      backgroundColor: "#fffdf8",
      width,
      height: Math.ceil(clone.getBoundingClientRect().height),
      style: { animation: "none", transform: "none", opacity: "1", maxHeight: "none" },
    });
    if (!blob || blob.type !== "image/png" || blob.size === 0)
      throw new Error("PNG generation failed");
    return blob;
  } finally {
    host.remove();
  }
}

export async function downloadResultsPng(node: HTMLElement, date: string): Promise<void> {
  const blob = await renderResultsPng(node, date);
  saveResultsPng(blob, date);
}

export function saveResultsPng(blob: Blob, date: string) {
  const url = URL.createObjectURL(blob);
  const anchor = Object.assign(document.createElement("a"), {
    href: url,
    download: `pips-${date}.png`,
  });
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
