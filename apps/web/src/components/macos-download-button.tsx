import { buttonVariants } from "@remora/ui";

import { createMacosDownload } from "../lib/macos-download";

export function MacosDownloadButton({ downloadUrl }: { downloadUrl?: string }) {
  const download = createMacosDownload(downloadUrl);

  return (
    <a
      className={buttonVariants()}
      download={download.fileName}
      href={download.url}
    >
      Download for macOS
    </a>
  );
}
