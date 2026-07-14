import { ContentPage } from "./content-page";

const effectiveDate = "July 14, 2026";

export function TermsPage() {
  return (
    <ContentPage
      eyebrow="Legal"
      title="Terms of Service"
      description="These terms govern your use of Remora's desktop application, website, generation services, and credits."
      updated={effectiveDate}
    >
      <section>
        <h2>1. Agreement and eligibility</h2>
        <p>
          These Terms of Service (the “Terms”) are an agreement between you and
          Remora Industries (“Remora,” “we,” “us,” or “our”). They apply to the
          Remora desktop application, website, APIs, generation features, and
          related services (collectively, the “Service”). By creating an
          account, downloading the application, purchasing credits, or using the
          Service, you agree to these Terms.
        </p>
        <p>
          You must be at least 18 years old and legally able to enter into this
          agreement. If you use the Service for an organization, you represent
          that you have authority to bind that organization, and “you” includes
          the organization.
        </p>
      </section>

      <section>
        <h2>2. The Service</h2>
        <p>
          Remora provides tools for creating and managing AI-generated images,
          videos, and related media. Features, models, providers, pricing,
          limits, and availability may change as the Service develops. We may
          add, modify, suspend, or discontinue any part of the Service. When
          practical, we will provide notice of material changes that negatively
          affect active users.
        </p>
        <p>
          Generation results depend on probabilistic systems and third-party
          providers. We do not promise that a generation will complete, meet
          your expectations, be unique, be accurate, or remain available
          indefinitely.
        </p>
      </section>

      <section>
        <h2>3. Your account</h2>
        <p>
          You must provide accurate account information and keep your sign-in
          credentials secure. You are responsible for activity under your
          account and must promptly notify us at{" "}
          <a href="mailto:support@remora.computer">support@remora.computer</a>{" "}
          if you suspect unauthorized access. You may not share, sell, or
          transfer an account in a way that defeats Service limits or security
          controls.
        </p>
      </section>

      <section>
        <h2>4. Your content and generated content</h2>
        <p>
          “User Content” means prompts, source images, videos, audio, project
          names, instructions, and other materials you submit. You retain your
          ownership rights in User Content. You represent that you have all
          rights and permissions needed to submit it and to instruct us and our
          providers to process it.
        </p>
        <p>
          You grant Remora a worldwide, non-exclusive, royalty-free license to
          host, copy, transmit, transform, and process User Content only as
          reasonably necessary to provide, secure, troubleshoot, and support the
          Service. This license ends when the content is deleted from our active
          systems, except for limited copies retained for backups, security,
          dispute resolution, or legal compliance.
        </p>
        <p>
          As between you and Remora, and to the extent permitted by law, you own
          the outputs generated for you. Remora assigns to you any rights it may
          have in those outputs. AI-generated material may not qualify for
          intellectual-property protection, and similar or identical outputs may
          be generated for others. We do not guarantee that an output is
          non-infringing or safe for every commercial use. You are responsible
          for reviewing outputs before publishing or relying on them.
        </p>
      </section>

      <section>
        <h2>5. Acceptable use</h2>
        <p>You may not use the Service to:</p>
        <ul>
          <li>violate any law or another person's rights;</li>
          <li>
            create, upload, or distribute child sexual abuse material or any
            sexual content involving a minor;
          </li>
          <li>
            create non-consensual intimate imagery, facilitate exploitation or
            harassment, or make deceptive impersonations intended to cause harm;
          </li>
          <li>
            infringe privacy, publicity, copyright, trademark, or other
            intellectual-property rights;
          </li>
          <li>
            distribute malware, interfere with the Service, probe for
            vulnerabilities without permission, or bypass access, payment,
            safety, or rate-limit controls;
          </li>
          <li>
            resell access, scrape the Service, or use automated means at a
            volume that burdens our systems unless we authorize it in writing;
            or
          </li>
          <li>
            represent AI-generated material as authentic evidence when doing so
            would mislead or harm another person.
          </li>
        </ul>
        <p>
          Do not submit payment-card data, government identifiers, health
          records, trade secrets, or other highly sensitive information unless
          we have expressly agreed in writing to support that use.
        </p>
      </section>

      <section>
        <h2>6. AI and infrastructure providers</h2>
        <p>
          Remora uses third parties to operate the Service. For example, User
          Content may be sent to AI providers such as BytePlus to produce media
          and to OpenAI to create short thread names. Other providers support
          hosting, storage, payments, analytics, and error monitoring.
        </p>
        <p>
          Remora does not currently train Remora-owned generative models on User
          Content. Third-party providers process data under their own agreements
          and policies, which may change. Unless we expressly state otherwise in
          writing, we do not guarantee that every provider will refrain from
          using submitted data for service improvement, safety, or model
          training. Do not submit confidential material if those provider
          practices are unacceptable for your use case.
        </p>
      </section>

      <section>
        <h2>7. Credits, purchases, and auto-reload</h2>
        <p>
          Remora uses prepaid credits for generation services. Credit prices and
          estimated generation costs are shown before purchase or use when
          practical. Actual cost may depend on the selected model, settings,
          duration, resolution, number of outputs, and provider usage.
        </p>
        <ul>
          <li>
            Credit purchases are charged in U.S. dollars and are final and
            non-refundable, except where required by law.
          </li>
          <li>
            Credits have no cash value, cannot be transferred, and cannot be
            redeemed outside the Service.
          </li>
          <li>
            Credits remain valid while your account is active. Deleting your
            account may forfeit unused credits except where law requires
            otherwise.
          </li>
          <li>
            Credits reserved for a generation that does not complete are
            ordinarily released back to your balance. Contact support if a
            technical issue appears to have charged you incorrectly.
          </li>
        </ul>
        <p>
          If you enable auto-reload, you authorize Remora and Stripe to charge
          your saved payment method for the amount you selected whenever your
          balance falls below your selected threshold. You can disable or change
          auto-reload before the next charge from the credit settings in the
          application. Disabling auto-reload does not reverse a charge that has
          already been initiated.
        </p>
        <p>
          You are responsible for applicable taxes. We may change prices
          prospectively, but a change will not reduce credits already in your
          account.
        </p>
      </section>

      <section>
        <h2>8. Software license and updates</h2>
        <p>
          Subject to these Terms, Remora grants you a limited, revocable,
          non-exclusive, non-transferable license to install and use the desktop
          application for your personal or internal business purposes. You may
          not copy, sell, sublicense, reverse engineer, or modify the
          application except to the extent such a restriction is prohibited by
          law.
        </p>
        <p>
          The application may check for, download, and install updates. Updates
          may be required for security, compatibility, or continued access to
          the Service.
        </p>
      </section>

      <section>
        <h2>9. Feedback</h2>
        <p>
          If you send ideas or feedback about Remora, you grant us a perpetual,
          worldwide, royalty-free right to use that feedback without an
          obligation to compensate you. This does not give us rights in your
          User Content.
        </p>
      </section>

      <section>
        <h2>10. Suspension and termination</h2>
        <p>
          You may stop using the Service at any time and may request account
          deletion through support. We may suspend or terminate access if you
          materially violate these Terms, create risk for users or the Service,
          fail to pay amounts due, or if required by law. When reasonable, we
          will provide notice and an opportunity to resolve the issue.
        </p>
        <p>
          Provisions that by their nature should survive termination—including
          ownership, payment obligations, disclaimers, limitations of liability,
          indemnity, and dispute terms—will survive.
        </p>
      </section>

      <section>
        <h2>11. Disclaimers</h2>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE SERVICE IS PROVIDED “AS
          IS” AND “AS AVAILABLE.” REMORA DISCLAIMS ALL EXPRESS OR IMPLIED
          WARRANTIES, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
          PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT, AND THAT THE SERVICE WILL
          BE UNINTERRUPTED, SECURE, OR ERROR-FREE. Nothing in these Terms
          excludes a warranty or right that cannot legally be excluded.
        </p>
      </section>

      <section>
        <h2>12. Limitation of liability</h2>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, REMORA AND ITS SUPPLIERS WILL
          NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
          EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, REVENUE, DATA,
          GOODWILL, OR BUSINESS OPPORTUNITIES, ARISING FROM THE SERVICE OR THESE
          TERMS.
        </p>
        <p>
          REMORA'S TOTAL LIABILITY FOR ALL CLAIMS ARISING OUT OF THE SERVICE OR
          THESE TERMS WILL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID TO
          REMORA DURING THE 12 MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM
          OR (B) US $100. These limits do not apply where prohibited by law.
        </p>
      </section>

      <section>
        <h2>13. Indemnity</h2>
        <p>
          To the extent permitted by law, you will defend, indemnify, and hold
          harmless Remora and its personnel from third-party claims, damages,
          and reasonable expenses arising from your User Content, your use of
          generated content, your violation of these Terms, or your violation of
          another person's rights. This obligation does not apply to the extent
          a claim was caused by Remora's own unlawful conduct.
        </p>
      </section>

      <section>
        <h2>14. Governing law and disputes</h2>
        <p>
          These Terms are governed by the laws of the State of New York, without
          regard to conflict-of-law rules. Before filing a formal claim, you and
          Remora agree to try to resolve the dispute informally for 30 days
          after written notice. Send notices to{" "}
          <a href="mailto:support@remora.computer">support@remora.computer</a>.
        </p>
        <p>
          Any dispute that is not resolved informally must be brought in the
          state or federal courts located in New York County, New York, and each
          party consents to those courts' jurisdiction. This section does not
          prevent either party from seeking urgent injunctive relief, and it
          does not override consumer protections that apply in your country of
          residence.
        </p>
      </section>

      <section>
        <h2>15. Changes and general terms</h2>
        <p>
          We may update these Terms. If a change is material, we will provide
          reasonable notice through the Service, by email, or on this page.
          Continued use after the new effective date means you accept the
          revised Terms.
        </p>
        <p>
          If part of these Terms is unenforceable, the remaining terms remain in
          effect. Our failure to enforce a provision is not a waiver. You may
          not assign these Terms without our consent; we may assign them as part
          of a reorganization, financing, merger, acquisition, or transfer of
          the Service. These Terms and any terms presented at purchase are the
          entire agreement about the Service.
        </p>
      </section>

      <section>
        <h2>16. Contact</h2>
        <p>
          Questions about these Terms can be sent to Remora Industries at{" "}
          <a href="mailto:support@remora.computer">support@remora.computer</a>.
        </p>
      </section>
    </ContentPage>
  );
}
