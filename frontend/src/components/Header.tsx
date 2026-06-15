import Link from "next/link";

export default function Header() {
  return (
    <header>
      <nav>
        <Link href="/">NSW Bus Delays</Link>
        <Link href="/monitor/new">+ New Monitor</Link>
      </nav>
    </header>
  );
}
