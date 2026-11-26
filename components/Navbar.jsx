"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      window.alert(`No se pudo cerrar la sesión: ${error.message}`);
      return;
    }
    router.push("/");
  }

  const links = user ? (
    <>
      <Link className="nav-link" href="/panel" onClick={() => setMenuOpen(false)}>
        Mi Panel
      </Link>
      <button className="nav-link flex items-center gap-2" onClick={signOut}>
        <LogOut size={16} /> Cerrar sesión
      </button>
    </>
  ) : (
    <>
      <Link className="nav-link" href="/login" onClick={() => setMenuOpen(false)}>
        Soy Manicurista
      </Link>
      <Link className="button-primary !px-4 !py-2" href="/registro" onClick={() => setMenuOpen(false)}>
        Crear perfil
      </Link>
    </>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-[#faf8f5]/95 backdrop-blur">
      <nav className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="font-serif text-2xl font-semibold tracking-tight text-stone-900">
          Aura<span className="text-[#b76e79]">Nails</span>
          <span className="ml-2 align-middle text-[10px] font-sans font-medium uppercase tracking-[0.22em] text-stone-500">
            Studio
          </span>
        </Link>
        <div className="hidden items-center gap-7 md:flex">{links}</div>
        <button
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          className="rounded-xl p-2 text-stone-700 md:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
        {menuOpen && (
          <div className="absolute left-0 right-0 top-[75px] flex flex-col gap-5 border-b border-stone-200 bg-[#faf8f5] px-6 py-6 shadow-lg md:hidden">
            {links}
          </div>
        )}
      </nav>
    </header>
  );
}
