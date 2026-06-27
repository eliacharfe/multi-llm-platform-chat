
// apps/web/src/components/ui/Footer.tsx

import Link from "next/link";

export default function Footer() {
    return (
        <div className="text-center text-xs text-gray-500 px-3 pt-0 pb-[calc(10px+env(safe-area-inset-bottom))] shrink-0">
            MultiLLM •{" "}
            © {new Date().getFullYear()} MultiLLM. All rights reserved. •{" "}
            <a
                href="https://www.eliacharfeig.com/"
                target="_blank"
                rel="noreferrer"
                className="text-gray-400 hover:text-gray-200 underline underline-offset-2"
            >
                Built by Eliachar Feig
            </a>{" "}
            •{" "}
            <a
                href="https://github.com/eliacharfe/multi-llm-platform-chat"
                target="_blank"
                rel="noreferrer"
                className="text-gray-400 hover:text-gray-200 underline underline-offset-2"
            >
                GitHub
            </a > {" "}
            •{" "}
            <a href="https://www.linkedin.com/in/eliachar-feig/" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-gray-200 underline underline-offset-2">
                LinkedIn
            </a>{" "}
            •{" "}
            <Link href="/pricing" className="text-gray-400 hover:text-gray-200 underline underline-offset-2">Pricing</Link>{" "}
            •{" "}
            <Link href="/terms" className="text-gray-400 hover:text-gray-200 underline underline-offset-2">Terms</Link>{" "}
            •{" "}
            <Link href="/privacy" className="text-gray-400 hover:text-gray-200 underline underline-offset-2">Privacy</Link>{" "}
            •{" "}
            <Link href="/refund" className="text-gray-400 hover:text-gray-200 underline underline-offset-2">Refund</Link>
        </div >
    );
}