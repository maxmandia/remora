const verificationEmailSubject =
  "Verify your email to claim $5 in Remora credits";

export function createVerificationEmailContent(verificationUrl: string) {
  const url = new URL(verificationUrl).toString();
  const escapedUrl = escapeHtml(url);

  return {
    subject: verificationEmailSubject,
    text: [
      "Verify your email address to claim your $5 in Remora credits:",
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
      "<p>Verify your email address to claim your $5 in Remora credits.</p>",
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
