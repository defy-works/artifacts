import { LegalPage } from "@/components/shell/LegalPage";

export const metadata = {
  title: "Privacy policy",
  description: "What Artifacts (artifacts.defy.works) collects, why, and how it is used, shared, stored and deleted.",
};

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="Legal · 01" title="Privacy policy" updated="17 September 2026">
      <p>
        Artifacts (<strong>artifacts.defy.works</strong>, "the Service") is operated by defy.works ("we", "us"). It lets
        people publish interactive HTML pages from Claude Code, share them with others, and let those pages store data.
        This policy explains what personal data the Service collects, why, how it is used and shared, how long it is
        kept, and the choices you have.
      </p>

      <h2>1. Data we collect</h2>
      <h3>Account data</h3>
      <ul>
        <li>
          <strong>Email address and display name.</strong> Required to create an account and identify you to people
          you share with. When you sign in with a magic link we store the email you entered.
        </li>
        <li>
          <strong>Google account data.</strong> If you sign in with Google we receive your Google account's email
          address, name and profile picture through Google OAuth. We use these only to create and identify your
          account and to display your name to collaborators. We do not request access to your Gmail, Drive, contacts
          or any other Google data, and we never post to your Google account.
        </li>
        <li>
          <strong>Session data.</strong> A session identifier stored in a cookie, plus the IP address and browser user
          agent recorded when the session is created, used to keep you signed in and to detect abuse.
        </li>
      </ul>
      <h3>Content you create</h3>
      <ul>
        <li>
          <strong>Artifacts.</strong> The HTML pages you publish, every version of them, supporting files and uploaded
          assets (images, PDFs, fonts, data files).
        </li>
        <li>
          <strong>Artifact data.</strong> Documents a page stores through its database capability, including per-viewer
          private documents, and transient presence data (for example a cursor position) while a page is open.
        </li>
        <li>
          <strong>Comments and sharing.</strong> Comments you write, the email addresses you invite, and the access level
          you give them.
        </li>
        <li>
          <strong>API tokens.</strong> Tokens you create for Claude Code are stored only as a one-way hash, together
          with the name you give them and when they were last used.
        </li>
      </ul>
      <h3>Technical data</h3>
      <p>
        Standard server logs (request path, status, timestamp, IP address) kept for a short period to operate and
        secure the Service. We do not use third-party analytics or advertising trackers.
      </p>

      <h2>2. How we use data</h2>
      <ul>
        <li>To provide the Service: authenticate you, render your pages, store and synchronise their data, and enforce the access levels you set.</li>
        <li>To send transactional email: sign-in links and notifications when someone shares an artifact with you. We do not send marketing email.</li>
        <li>To keep the Service secure and reliable, including rate limiting and abuse prevention.</li>
        <li>To respond when you contact us.</li>
      </ul>
      <p>We do not sell personal data, and we do not use it to train machine-learning models.</p>

      <h2>3. Google user data</h2>
      <p>
        Our use of information received from Google APIs adheres to the{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements. Google data is used only to sign you in and identify your account; it
        is not transferred to anyone else except as needed to provide the Service, is not used for advertising, and is
        never read by a human except with your consent, for security purposes, or as required by law.
      </p>

      <h2>4. Who can see your data</h2>
      <ul>
        <li>
          <strong>People you share with.</strong> An artifact is private to you until you invite an email address or
          turn on link access. Viewers see the page, its shared documents and comments according to the level you
          chose. Documents a page stores under a viewer's private path are visible only to that viewer.
        </li>
        <li>
          <strong>Service providers.</strong> Email is delivered by Sendsprite (Amazon SES infrastructure operated by
          defy.works), which processes recipient addresses and message content solely to deliver mail. The Service
          runs on servers we control.
        </li>
        <li>
          <strong>Legal.</strong> We may disclose data if required by law or to protect the rights, safety or property
          of users or the Service.
        </li>
      </ul>

      <h2>5. Cookies</h2>
      <p>
        We use one strictly necessary cookie to keep you signed in. It is not used for tracking or advertising.
        Published pages run in an isolated sandbox and cannot read this cookie.
      </p>

      <h2>6. Retention and deletion</h2>
      <ul>
        <li>Artifacts and everything attached to them (versions, files, assets, documents, comments, shares) are deleted when you delete the artifact.</li>
        <li>Presence data expires within a minute of a page being closed; room events are discarded after a minute.</li>
        <li>Sign-in links expire after 10 minutes; sessions expire after 30 days of inactivity.</li>
        <li>
          To delete your account and all data associated with it, email{" "}
          <a href="mailto:artifacts@defy.works">artifacts@defy.works</a> from the address on the account. We complete
          deletion within 30 days.
        </li>
      </ul>

      <h2>7. Security</h2>
      <p>
        Data is transmitted over HTTPS and stored in an encrypted-at-rest database. API tokens and session tokens are
        hashed. Published pages execute in a sandboxed frame on a separate origin so they cannot access your session.
        No system is perfectly secure; if we learn of a breach affecting your data we will notify you.
      </p>

      <h2>8. Your rights</h2>
      <p>
        You can access and export your content at any time through the Service or its API, correct your name in your
        account, and delete artifacts yourself. Depending on where you live you may also have rights to access,
        rectify, erase, restrict or port your data, or to object to processing. Contact us to exercise them.
      </p>

      <h2>9. Children</h2>
      <p>The Service is not directed at children under 16, and we do not knowingly collect their data.</p>

      <h2>10. Changes</h2>
      <p>
        We will post any changes to this policy on this page and update the date above. Material changes will be
        announced to signed-in users.
      </p>

      <h2>11. Contact</h2>
      <p>
        defy.works · <a href="mailto:artifacts@defy.works">artifacts@defy.works</a> ·{" "}
        <a href="https://defy.works" target="_blank" rel="noreferrer">
          defy.works
        </a>
      </p>
    </LegalPage>
  );
}
