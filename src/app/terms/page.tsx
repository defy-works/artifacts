import { LegalPage } from "@/components/shell/LegalPage";

export const metadata = {
  title: "Terms of service",
  description: "The terms under which defy.works provides Artifacts (artifacts.defy.works).",
};

export default function TermsPage() {
  return (
    <LegalPage eyebrow="Legal · 02" title="Terms of service" updated="17 September 2026">
      <p>
        These terms govern your use of Artifacts (<strong>artifacts.defy.works</strong>, "the Service"), operated by
        defy.works. By creating an account or using the Service you agree to them.
      </p>

      <h2>1. Accounts</h2>
      <p>
        You need an account to publish. Keep your sign-in email and API tokens confidential; you are responsible for
        activity under your account. We may suspend accounts that break these terms or endanger the Service.
      </p>

      <h2>2. Your content</h2>
      <p>
        You keep all rights to the pages, files and data you publish. You grant us the licence needed to store, render
        and deliver them to you and to the people you share them with. You are responsible for having the rights to
        anything you upload and for what your pages do.
      </p>

      <h2>3. Acceptable use</h2>
      <p>
        Do not use the Service to distribute malware, phishing pages, content that infringes others' rights, or
        content that is unlawful where you or your viewers are. Do not attempt to break the sandbox, access other
        users' data, or overload the Service. Published pages that impersonate other organisations will be removed.
      </p>

      <h2>4. Sharing</h2>
      <p>
        When you share an artifact by link or by email you decide who can view, interact with or edit it. Content
        shared by public link can be seen by anyone who has the link.
      </p>

      <h2>5. Availability and changes</h2>
      <p>
        The Service is provided as is, without warranty. We may change or discontinue features; we will give
        reasonable notice before discontinuing the Service and let you export your content. Limits on page size,
        storage and request rates apply and may change.
      </p>

      <h2>6. Liability</h2>
      <p>
        To the extent permitted by law, defy.works is not liable for indirect or consequential loss arising from use of
        the Service. Our total liability is limited to the amount you paid us in the preceding twelve months, which
        for a free service is zero.
      </p>

      <h2>7. Privacy</h2>
      <p>
        How we handle personal data is described in the <a href="/privacy">privacy policy</a>, which forms part of
        these terms.
      </p>

      <h2>8. Governing law and contact</h2>
      <p>
        These terms are governed by the laws of the Republic of Korea. Questions:{" "}
        <a href="mailto:artifacts@defy.works">artifacts@defy.works</a>.
      </p>
    </LegalPage>
  );
}
