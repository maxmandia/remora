import { ContentPage } from "./content-page";

const effectiveDate = "July 14, 2026";

export function PrivacyPage() {
  return (
    <ContentPage
      eyebrow="Legal"
      title="Privacy Policy"
      description="This policy explains what Remora collects when you use the desktop application and related services, why we collect it, and the choices available to you."
      updated={effectiveDate}
    >
      <section>
        <h2>1. Who we are and what this covers</h2>
        <p>
          Remora Industries (“Remora,” “we,” “us,” or “our”) operates the Remora
          desktop application, website, generation services, and related support
          (collectively, the “Service”). This Privacy Policy applies to personal
          data we process through the Service. Remora Industries is the
          controller of that data unless we say otherwise.
        </p>
        <p>
          This policy does not govern third-party websites or services that you
          access independently, even if the Service links to them.
        </p>
      </section>

      <section>
        <h2>2. Data we collect</h2>
        <h3>Account and authentication data</h3>
        <p>
          We collect your name, email address, password credentials in hashed
          form, email-verification status, optional profile image, account
          identifiers, session tokens, sign-in timestamps, IP address, and user
          agent. We use this information to create and secure your account and
          keep you signed in between the website and desktop application.
        </p>

        <h3>User Content and generation data</h3>
        <p>
          We collect prompts, project and thread names, images, videos, audio,
          file names, file metadata, model selections, generation settings, and
          generated outputs. We also keep operational records such as job
          status, provider and model identifiers, generation cost, usage,
          errors, and timestamps. This information is necessary to perform
          generations, show history, store results, calculate credits, and
          troubleshoot failures.
        </p>

        <h3>Billing and credit data</h3>
        <p>
          Stripe collects payment-card details directly. Remora does not store
          your full card number. We retain Stripe customer, payment-method,
          checkout, and payment identifiers; purchase amounts; credit balance
          and ledger activity; billing status; and any auto-reload amount and
          threshold you select. We use this information to process purchases,
          provide credits, prevent duplicate charges, and maintain financial
          records.
        </p>

        <h3>Device, analytics, and diagnostic data</h3>
        <p>
          We collect information such as application version, release channel,
          operating system, device architecture, session starts, feature events,
          selected models and settings, attachment counts, generation success or
          failure, processing time, and credit events. Analytics events are
          associated with an account identifier.
        </p>
        <p>
          When analytics is enabled in a production build, we use Mixpanel for
          product analytics and session replay. Session replay creates a visual
          reconstruction of interactions with the interface and may capture
          content visible on screen. We use Sentry for crash reporting and error
          diagnostics, which may receive user and device identifiers, IP
          address, error messages, stack traces, and failed request paths. Our
          diagnostic filters are designed to remove fields such as prompts,
          authentication tokens, URLs, and local file paths, but no filtering
          system is perfect.
        </p>

        <h3>Support communications</h3>
        <p>
          If you contact us, we collect your email address, message, and any
          logs, screenshots, files, receipts, or other information you choose to
          send.
        </p>
      </section>

      <section>
        <h2>3. How we use data</h2>
        <p>We use personal data to:</p>
        <ul>
          <li>provide, personalize, and maintain the Service;</li>
          <li>
            authenticate accounts and transfer sign-in sessions securely to the
            desktop application;
          </li>
          <li>
            process prompts and media, perform generations, and store outputs;
          </li>
          <li>
            process payments, maintain credit balances, and run optional
            auto-reload;
          </li>
          <li>
            monitor reliability, understand feature usage, diagnose errors, and
            improve the interface and performance;
          </li>
          <li>
            detect fraud, abuse, security incidents, and violations of our
            Terms;
          </li>
          <li>respond to support and privacy requests;</li>
          <li>comply with law and enforce our agreements; and</li>
          <li>
            send important account, transaction, policy, and Service notices.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Legal bases for international users</h2>
        <p>
          Where a law such as the GDPR requires a legal basis, we process data
          as necessary to perform our contract with you, including providing
          accounts, generations, storage, and purchases. We also process data
          for legitimate interests such as securing and improving the Service,
          preventing abuse, maintaining business records, and supporting users,
          where those interests are not overridden by your rights.
        </p>
        <p>
          We rely on consent where required, and you may withdraw that consent
          at any time. We process some information to comply with legal
          obligations, including tax, accounting, consumer-protection, and
          lawful-request requirements.
        </p>
      </section>

      <section>
        <h2>5. AI processing and model training</h2>
        <p>
          Remora sends prompts and reference media to generation providers,
          currently including BytePlus, to create requested outputs. We also
          send generation prompts to OpenAI to create short, descriptive thread
          names. AI providers may receive signed, time-limited links to media
          stored for your account.
        </p>
        <p>
          Remora does not currently use User Content to train generative models
          owned by Remora. We do not, however, promise that every third-party
          provider will never use submitted data for safety, service
          improvement, or model training. Their processing and retention are
          governed by their own agreements and policies. You should not submit
          sensitive, confidential, or regulated data unless you are authorized
          to do so and are comfortable with this provider processing.
        </p>
      </section>

      <section>
        <h2>6. When we disclose data</h2>
        <p>We disclose data only as described below:</p>
        <ul>
          <li>
            <strong>AI providers:</strong> BytePlus processes prompts and media
            to generate outputs, and OpenAI processes prompt text to create
            thread names.
          </li>
          <li>
            <strong>Infrastructure providers:</strong> Cloudflare provides
            object storage and content delivery, and Railway and related
            infrastructure providers host application services and databases.
          </li>
          <li>
            <strong>Payments:</strong> Stripe processes payments, saved payment
            methods, and auto-reload charges.
          </li>
          <li>
            <strong>Analytics and diagnostics:</strong> Mixpanel processes usage
            analytics and session replays, and Sentry processes errors,
            diagnostics, and performance information.
          </li>
          <li>
            <strong>Legal and safety:</strong> We may disclose information when
            reasonably necessary to comply with law, protect rights and safety,
            investigate abuse, or enforce our agreements.
          </li>
          <li>
            <strong>Business transfers:</strong> Data may be disclosed in a
            financing, reorganization, merger, acquisition, sale, or transfer of
            all or part of our business, subject to appropriate safeguards.
          </li>
          <li>
            <strong>With your direction:</strong> We disclose data when you ask
            us to or give consent.
          </li>
        </ul>
        <p>
          We do not sell personal data. We do not share personal data for
          cross-context behavioral advertising, and we do not serve targeted
          advertising in the Service.
        </p>
      </section>

      <section>
        <h2>7. Local storage and similar technology</h2>
        <p>
          The website and desktop application use cookies, local storage,
          session credentials, and similar technology to keep you signed in,
          remember application state, prevent fraud, and support analytics.
          Blocking this technology may prevent parts of the Service from
          working.
        </p>
        <p>
          We do not currently respond to browser “Do Not Track” signals because
          there is no uniform industry standard for them. Because we do not sell
          personal data or use it for cross-context behavioral advertising, an
          opt-out preference signal such as Global Privacy Control does not
          change those practices.
        </p>
      </section>

      <section>
        <h2>8. Data retention and deletion</h2>
        <p>
          We generally retain account information, projects, prompts, uploaded
          media, generation history, and outputs while your account is active so
          you can continue using the Service. Operational logs and analytics are
          retained for periods reasonably necessary for security, reliability,
          and product analysis.
        </p>
        <p>
          You may request account deletion by emailing{" "}
          <a href="mailto:support@remora.computer">support@remora.computer</a>{" "}
          from the address associated with your account. After verifying the
          request, we will delete or de-identify account content from our active
          systems within 30 days. Backups and provider systems may take
          additional time to cycle out.
        </p>
        <p>
          We may retain limited billing, transaction, security, fraud, dispute,
          and legal-compliance records for longer where reasonably necessary or
          required by law. We may also retain de-identified data that cannot
          reasonably be linked back to you.
        </p>
      </section>

      <section>
        <h2>9. Security</h2>
        <p>
          We use administrative, technical, and organizational safeguards
          designed to protect personal data, including authenticated access,
          encrypted network connections, signed media links, access controls,
          and monitoring. No system is completely secure, and we cannot
          guarantee that information will never be accessed, lost, or altered
          improperly.
        </p>
      </section>

      <section>
        <h2>10. International transfers</h2>
        <p>
          Remora is available internationally, and we and our providers may
          process data in the United States and other countries where we or they
          operate. Those countries may have different data-protection laws than
          your country. Where required, we use recognized safeguards for
          international transfers, such as contractual protections.
        </p>
      </section>

      <section>
        <h2>11. Your privacy rights</h2>
        <p>
          Depending on where you live, you may have rights to access, correct,
          delete, restrict, object to processing, or receive a portable copy of
          personal data. You may also have the right to withdraw consent, appeal
          a denied request, or complain to a local data-protection authority.
        </p>
        <p>
          To make a request, email{" "}
          <a href="mailto:support@remora.computer">support@remora.computer</a>{" "}
          from your account email and describe the request. We may need to
          verify your identity. You may use an authorized agent where local law
          permits. We will not discriminate against you for exercising a privacy
          right.
        </p>
        <p>
          Residents of the European Economic Area, United Kingdom, or
          Switzerland may object to processing based on legitimate interests and
          may lodge a complaint with the supervisory authority in their country.
          Residents of U.S. states with applicable privacy laws may request the
          rights provided by those laws. Because we do not sell personal data,
          there is no sale from which you need to opt out.
        </p>
      </section>

      <section>
        <h2>12. California disclosures</h2>
        <p>
          The categories of personal information described in Section 2 include
          identifiers, customer records, commercial information, internet or
          electronic activity, audiovisual information contained in User
          Content, and inferences reflected by your generation settings and
          usage. We collect these categories from you, your device, and the
          providers involved in operating the Service. We use and disclose them
          for the purposes described in Sections 3 and 6.
        </p>
        <p>
          We do not sell or share these categories for cross-context behavioral
          advertising. We do not knowingly use or disclose sensitive personal
          information to infer characteristics about you. California residents
          may exercise applicable access, correction, deletion, and portability
          rights as described above.
        </p>
      </section>

      <section>
        <h2>13. Children</h2>
        <p>
          The Service is for people aged 18 and older. We do not knowingly
          collect personal data from anyone under 18. If you believe a minor has
          provided data to us, contact support so we can investigate and delete
          it where appropriate.
        </p>
      </section>

      <section>
        <h2>14. Changes to this policy</h2>
        <p>
          We may update this Privacy Policy as the Service or law changes. We
          will post the revised policy with a new effective date and provide
          additional notice when a change materially affects your rights or how
          we use personal data.
        </p>
      </section>

      <section>
        <h2>15. Contact</h2>
        <p>
          Contact Remora Industries about privacy questions or requests at{" "}
          <a href="mailto:support@remora.computer">support@remora.computer</a>.
        </p>
      </section>
    </ContentPage>
  );
}
