const verificationEmailSubject =
  "Verify your email to continue with your generation";

export function createVerificationEmailContent(verificationUrl: string) {
  const url = new URL(verificationUrl).toString();
  const escapedUrl = escapeHtml(url);

  return {
    subject: verificationEmailSubject,
    text: [
      "Verify your email to continue with your generation",
      "",
      url,
      "",
      "This link expires in one hour.",
      "If you did not create this Remora account, you can ignore this email.",
    ].join("\n"),
    html: [
      "<!doctype html>",
      '<html lang="en">',
      "<body>",
      "<p>Verify your email address to continue with your generation.</p>",
      `<p><a href="${escapedUrl}">Verify email</a></p>`,
      "<p>This link expires in one hour.</p>",
      "<p>If you did not create this Remora account, you can ignore this email.</p>",
      "</body>",
      "</html>",
    ].join(""),
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
