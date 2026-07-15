import { ContentPage } from "./content-page";

export function SupportPage() {
  return (
    <ContentPage
      eyebrow="Remora"
      title="Support"
      description="Questions, strange behavior, or something that simply does not feel right? Send us the details and we'll help you sort it out."
    >
      <section>
        <h2>Contact support</h2>
        <p>
          Email{" "}
          <a href="mailto:support@remora.computer">support@remora.computer</a>.
          We do not promise a fixed response time, but we will reply as soon as
          we reasonably can.
        </p>
        <p>We can help with:</p>
        <ul>
          <li>downloading, installing, launching, or updating Remora;</li>
          <li>sign-in, account access, and desktop authentication;</li>
          <li>generation failures, missing outputs, or unexpected results;</li>
          <li>credit purchases, balances, charges, and auto-reload;</li>
          <li>privacy requests and account deletion; and</li>
          <li>reports of abuse, infringement, or security concerns.</li>
        </ul>
      </section>

      <section>
        <h2>What to include</h2>
        <p>For the fastest diagnosis, include:</p>
        <ul>
          <li>the email address associated with your Remora account;</li>
          <li>your Remora version and macOS version;</li>
          <li>what you expected to happen and what happened instead;</li>
          <li>the steps that reproduce the problem;</li>
          <li>the approximate date and time of the issue; and</li>
          <li>a screenshot or screen recording, when useful.</li>
        </ul>
        <p>
          Never email your password, authentication tokens, full card number,
          security code, government identifier, or highly sensitive source
          media. You can redact unrelated personal information from screenshots
          and recordings.
        </p>
      </section>

      <section>
        <h2>Credits and payments</h2>
        <p>
          If you believe a generation was charged incorrectly, include the
          approximate time, selected model, and generation or project details.
          For a purchase issue, include the Stripe receipt or checkout
          identifier if available—never your complete payment-card details.
        </p>
        <p>
          Credit purchases are generally non-refundable except where required by
          law, but we will investigate duplicate charges, missing credits, and
          technical billing errors.
        </p>
      </section>

      <section>
        <h2>Privacy and account deletion</h2>
        <p>
          To request access to, correction of, or deletion of your personal
          data, email us from the address associated with your account. We may
          ask for additional information to verify the request. Verified
          account-deletion requests are completed on active Remora systems
          within 30 days, subject to limited records we must retain for legal,
          billing, fraud-prevention, or security reasons.
        </p>
        <p>
          Read the <a href="/privacy">Privacy Policy</a> for more detail.
        </p>
      </section>

      <section>
        <h2>Abuse, copyright, and security reports</h2>
        <p>
          If Remora is being used to violate your rights or create harmful
          content, describe the material, where it appeared, why you believe it
          violates your rights, and how we can contact you. Copyright notices
          should identify the protected work, the allegedly infringing material,
          and include a good-faith statement that the disputed use is not
          authorized.
        </p>
        <p>
          For a security concern, use the subject line “Security report” and
          include enough detail for us to reproduce the issue. Do not access,
          alter, or retain another person's data while testing.
        </p>
      </section>
    </ContentPage>
  );
}
