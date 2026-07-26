import { Button } from "@bizo/ui/button";

const foundations = [
  "One clear next action",
  "Plain language",
  "Safe multi-business boundaries",
  "Global-ready amounts, dates, and tax",
] as const;

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-10 px-6 py-16">
      <div className="max-w-3xl space-y-5">
        <span className="inline-flex rounded-full bg-[var(--muted)] px-3 py-1 text-sm font-medium">
          Phase 0 · Engineering foundation
        </span>
        <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">
          Run the work. bizOS handles the paperwork.
        </h1>
        <p className="max-w-2xl text-lg leading-8 text-[var(--muted-foreground)]">
          A simple operating system for small businesses and service teams. Business workflows come
          next; the foundation is being made reliable first.
        </p>
        <Button disabled>Workspace coming after foundation acceptance</Button>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2" aria-label="Product foundations">
        {foundations.map((foundation) => (
          <li key={foundation} className="rounded-xl border bg-[var(--surface)] p-5 font-medium">
            {foundation}
          </li>
        ))}
      </ul>
    </main>
  );
}
