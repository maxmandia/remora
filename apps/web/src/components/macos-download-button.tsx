import { buttonVariants } from "@remora/ui";

import { createMacosDownload } from "../lib/macos-download";

export function MacosDownloadButton({
  downloadUrl,
  text,
  withAppleIcon = false,
}: {
  downloadUrl?: string;
  text?: string;
  withAppleIcon?: boolean;
}) {
  const download = createMacosDownload(downloadUrl);

  return (
    <a
      className={buttonVariants({ variant: "outline" })}
      download={download.fileName}
      href={download.url}
    >
      {withAppleIcon ? (
        <img
          src="/apple-icon.png"
          alt=""
          aria-hidden="true"
          data-icon="inline-start"
          className="size-4 invert"
          draggable={false}
        />
      ) : null}
      {text || "Download for macOS"}
    </a>
  );
}
