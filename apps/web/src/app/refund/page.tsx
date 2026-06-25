"use client";

import { useRouter } from "next/navigation";

export default function RefundPage() {
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

        <h1 className="text-4xl font-bold">Refund Policy</h1>
        <p className="mt-2 text-sm text-white/40">Last updated: {lastUpdated}</p>

        <div className="mt-8 space-y-8 text-white/70 leading-relaxed">

          <section>
            <div className="rounded-2xl border border-teal-400/30 bg-teal-500/10 p-5">
              <p className="text-teal-300 font-medium text-lg">
                🙌 14-day money-back guarantee, no questions asked.
              </p>
              <p className="mt-2 text-white/70">
                If you're not happy with MultiLLM Premium within 14 days of your purchase,
                contact us and we'll issue a full refund.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">How to Request a Refund</h2>
            <p>
              Email us at{" "}
              <a href="mailto:multillm.support@gmail.com" className="text-teal-400 hover:underline">
                multillm.support@gmail.com
              </a>{" "}
              within 14 days of your purchase with the subject line "Refund Request". Include
              the email address you used to sign up and we'll process it promptly — typically
              within 1–3 business days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Eligibility</h2>
            <ul className="space-y-3 list-disc list-inside">
              <li>Refunds are available within <span className="text-white font-medium">14 days</span> of the original purchase date.</li>
              <li>Both monthly and yearly plans are eligible.</li>
              <li>Refunds are issued to the original payment method.</li>
              <li>After 14 days, refunds are issued at our discretion for extenuating circumstances.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Cancellations</h2>
            <p>
              You can cancel your subscription at any time from your account settings. Cancelling
              stops future charges. You'll retain access to Premium features until the end of
              your current billing period. Cancellation alone does not trigger a refund —
              please contact us if you also want a refund within the 14-day window.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Payment Processing</h2>
            <p>
              All payments are processed by Paddle (paddle.com), who acts as the Merchant of
              Record. Refunds will appear on your statement from Paddle. Processing time may
              vary depending on your bank or card provider (typically 3–10 business days).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Contact Us</h2>
            <p>
              Still have questions?{" "}
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
