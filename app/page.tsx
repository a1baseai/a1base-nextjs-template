import Image from "next/image";
import Link from "next/link";
export default function Home() {
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <Image
          className="dark:invert"
          src="/a1base-black.png"
          alt="A1Base logo"
          width={180}
          height={38}
          priority
        />
        <p className="text-lg text-center sm:text-left">
          {`Template A1 Agent that can communicate across WhatsApp, Email, Slack, Teams, and SMS.`}
        </p>

        <div className="flex gap-4">
          {process.env.A1BASE_AGENT_NUMBER && (
            <a
              href={`https://wa.me/${process.env.A1BASE_AGENT_NUMBER.replace(
                "+",
                ""
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg px-6 py-3 bg-[#25D366] hover:bg-[#128C7E] text-white flex items-center gap-2 transition-colors"
            >
              {`Chat with your agent on WhatApp`}
            </a>
          )}
          <Link
            href="/chat"
            className="rounded-lg px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 transition-colors"
          >
            {`Chat with your agent on Web`}
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-4xl">
          <div className="p-6 rounded-xl bg-white dark:bg-black/20 border border-black/[.08] dark:border-white/[.08] shadow-lg">
            <h2 className="text-xl font-semibold mb-4">{`Create your A1Base Account`}</h2>
            <div className="flex flex-col gap-3">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {`Build your own AI agent in minutes:`}
              </p>
              <ul className="list-disc list-inside text-sm space-y-2">
                <li>{`Choose your agent's personality`}</li>
                <li>{`Define custom behaviors`}</li>
                <li>{`Set up communication channels`}</li>
                <li>{`Deploy and start chatting`}</li>
              </ul>
            </div>
          </div>

          <div className="p-6 rounded-xl bg-white dark:bg-black/20 border border-black/[.08] dark:border-white/[.08] shadow-lg col-span-2">
            <h2 className="text-xl font-semibold mb-4">{`Getting Started`}</h2>
            <ol className="list-inside list-decimal text-sm space-y-3 font-[family-name:var(--font-geist-mono)]">
              <li>{`Update your env variables`}</li>
              <li>
                {`Get started by editing `}
                <code className="bg-black/[.05] dark:bg-white/[.06] px-1 py-0.5 rounded font-semibold">
                  {`lib/agent/prompts.ts`}
                </code>
                {`.`}
              </li>
              <li>{`Update your webhook URL in the A1Base dashboard. Use Ngrok to test locally.`}</li>
            </ol>
          </div>
        </div>

        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <a
            className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:min-w-44"
            href="https://docs.a1base.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            {`Read A1Base docs`}
          </a>
        </div>
      </main>
      <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/file.svg"
            alt="File icon"
            width={16}
            height={16}
          />
          {`Learn`}
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/window.svg"
            alt="Window icon"
            width={16}
            height={16}
          />
          {`Examples`}
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://www.a1base.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          {`Go to a1base.com →`}
        </a>
      </footer>
    </div>
  );
}
