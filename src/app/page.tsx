export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-4 py-16">
      <p className="font-mono text-xs tracking-[0.18em] text-muted">KOVRELL</p>
      <h1 className="text-4xl font-semibold tracking-tight">Kovrell calls the vendor before you pay.</h1>
      <p className="max-w-xl text-muted">
        AI voice callback for every bank-detail change. It dials the number of record, asks what only the real
        vendor knows, and holds payment until it checks out.
      </p>
    </main>
  );
}
