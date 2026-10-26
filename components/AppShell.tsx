"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useData } from "./DataProvider";
import { Logo, ThemeToggle } from "./ui";
import { ROLE_NAME } from "@/lib/constants";
import { dueState, initials } from "@/lib/utils";

const TABS: [string, string][] = [
  ["/", "Огляд"],
  ["/trips", "Рейси"],
  ["/fleet", "Автопарк"],
  ["/drivers", "Водії"],
  ["/expenses", "Витрати"],
  ["/salary", "Зарплата"],
  ["/clients", "Замовники"],
  ["/settings", "Налаштування"],
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { me, supabase, docs, addExpense } = useData();
  const [menu, setMenu] = useState(false);
  const meRef = useRef<HTMLDivElement>(null);
  const nav = useRef<HTMLElement>(null);
  const hot = docs.filter((d) => ["late", "urgent"].includes(dueState(d.expires_on))).length;
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  useEffect(() => {
    nav.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "center" });
    setMenu(false);
  }, [pathname]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => { if (!meRef.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <div className="wrap">
        <header className="top">
          <div className="brand">
            <Link href="/" className="logo"><Logo /></Link>
            <div className="me" ref={meRef}>
              <button className="av-btn" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label="Профіль">
                <span className="av">{initials(me.full_name)}</span>
                <span className="me-name">{me.full_name}</span>
              </button>
              {menu && (
                <div className="me-menu" role="menu">
                  <div>
                    <div className="nm">{me.full_name}</div>
                    <div className="muted small">{ROLE_NAME[me.role]}</div>
                  </div>
                  <ThemeToggle />
                  <button className="btn ghost sm" role="menuitem" onClick={logout}>Вийти</button>
                </div>
              )}
            </div>
          </div>
          <nav className="tabs" aria-label="Розділи" ref={nav}>
            {TABS.map(([href, label]) => (
              <Link key={href} href={href} aria-current={active(href) ? "page" : undefined}>
                {label}
                {href === "/" && hot > 0 && <span className="cnt" aria-label={`${hot} термінів горить`}>{hot}</span>}
              </Link>
            ))}
          </nav>
        </header>
        <main>{children}</main>
      </div>
      {!pathname.startsWith("/settings") && (
        <button className="fab" onClick={() => addExpense()} aria-label="Додати витрату">
          <span aria-hidden="true">+</span><span className="fab-text">Витрата</span>
        </button>
      )}
    </>
  );
}
