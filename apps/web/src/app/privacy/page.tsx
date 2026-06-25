"use client";

import { useRouter } from "next/navigation";

export default function PrivacyPage() {
  const router = useRouter();
  const lastUpdated = "June 25, 2026";

  return (
    <main className="min-h-screen bg-[#1f1f1f] text-white px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-6 rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 hover:text-white"
        >
          ← Back
        </button>

        <h1 className="text-4xl font-bold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-white/40">Last updated: {lastUpdated}</p>

        <div className="mt-8 space-y-8 text-white/70 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Who We Are</h2>
            <p>
              MultiLLM ("we", "us", or "our") operates the platform at{" "}
              <span className="text-white">multillm.net</span> — a unified AI chat interface
              for interacting with multiple language model providers. This policy explains what
              data we collect, how we use it, and your rights.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Data We Collect</h2>
            <ul className="space-y-3">
              <li>
                <span className="text-white font-medium">Account data:</span> Your email address
                and authentication details when you sign up (via Google or email).
              </li>
              <li>
                <span className="text-white font-medium">Usage data:</span> Prompts you send,
                models you use, and basic interaction logs to help us improve the service and
                enforce usage limits.
              </li>
              <li>
                <span className="text-white font-medium">Payment data:</span> We do not store
                your payment details. All billing is handled by Paddle (paddle.com), who
                processes payments as the Merchant of Record.
              </li>
              <li>
                <span className="text-white font-medium">Technical data:</span> IP address,
                browser type, and device information collected automatically when you use the service.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. How We Use Your Data</h2>
            <ul className="space-y-2 list-disc list-inside">
              <li>To operate and improve the MultiLLM platform</li>
              <li>To authenticate your account and enforce usage limits</li>
              <li>To process your subscription and send billing-related emails</li>
              <li>To respond to support requests</li>
              <li>To detect and prevent abuse or unauthorized access</li>
            </ul>
            <p className="mt-3">
              We do not sell your personal data to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Third-Party AI Providers</h2>
            <p>
              When you send a message, your prompt is forwarded to the AI provider you selected
              (e.g., OpenAI, Anthropic, Google). Each provider has their own privacy policy
              governing how they handle your data. We recommend reviewing their policies if
              you share sensitive information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Data Retention</h2>
            <p>
              We retain your account data for as long as your account is active. Conversation
              logs may be retained for a limited period to support usage enforcement and
              debugging. You can request deletion of your data at any time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Your Rights (GDPR)</h2>
            <p>
              If you are located in the European Economic Area, you have the right to:
            </p>
            <ul className="mt-3 space-y-2 list-disc list-inside">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data ("right to be forgotten")</li>
              <li>Object to or restrict certain processing</li>
              <li>Request a portable copy of your data</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, email us at{" "}
              <a href="mailto:multillm.support@gmail.com" className="text-teal-400 hover:underline">
                multillm.support@gmail.com
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Cookies</h2>
            <p>
              We use essential cookies to keep you signed in and maintain your session.
              We do not use advertising or tracking cookies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Security</h2>
            <p>
              We take reasonable technical and organizational measures to protect your data.
              However, no system is 100% secure. If you suspect unauthorized access to your
              account, please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy occasionally. We will notify you of significant
              changes via email or an in-app notice. The "last updated" date at the top of
              this page reflects the most recent revision.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. Contact</h2>
            <p>
              Questions or requests about your privacy? Email us at{" "}
              <a href="mailto:multillm.support@gmail.com" className="text-teal-400 hover:underline">
                multillm.support@gmail.com
              </a>
            </p>
          </section>

        </div>
      </div>
    </main>
  );
}
