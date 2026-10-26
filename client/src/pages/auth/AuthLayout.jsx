import { Wordmark } from '../../components/layout/Sidebar.jsx';

/*
  Split layout for every pre-app screen: an engineering-drawing panel with
  the product's identity on the left (hidden on narrow screens), the form on
  the right.
*/
export default function AuthLayout({ title, subtitle, children, step }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[minmax(420px,5fr)_7fr] bg-surface">
      <aside className="blueprint relative hidden lg:flex flex-col justify-between p-10 text-nav-ink overflow-hidden">
        <Wordmark />
        <div className="relative">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-brass mb-4">Publication authoring</p>
          <p className="text-[28px] leading-[1.2] font-semibold text-nav-ink-strong max-w-md">
            Structured technical documentation, authored and released under control.
          </p>
          <div className="mt-10 font-mono text-[12px] text-nav-ink/80 space-y-1.5" aria-hidden="true">
            <p><span className="text-nav-ink/50">DMC</span>&nbsp;&nbsp;AGS-A-00-00-00-00A-040A-A</p>
            <p><span className="text-nav-ink/50">PMC</span>&nbsp;&nbsp;AGS-00001-00001-00</p>
            <p><span className="text-nav-ink/50">ISS</span>&nbsp;&nbsp;S1000D 4.2 · 5.0 · 6.0</p>
          </div>
        </div>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-nav-ink/50">Authorised users only · Activity is audited</p>
      </aside>
      <main className="flex flex-col">
        <div className="lg:hidden flex items-center px-6 h-14 bg-nav"><Wordmark /></div>
        <div className="flex-1 grid place-items-center px-6 py-10">
          <div className="w-full max-w-[400px]">
            {step ? <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-3 mb-2">{step}</p> : null}
            <h1 className="text-[24px] font-semibold text-ink">{title}</h1>
            {subtitle ? <p className="mt-1.5 text-ink-3">{subtitle}</p> : null}
            <div className="mt-7">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
