"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, LockKeyhole } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signInError) {
      setError(`No se pudo iniciar sesión: ${signInError.message}`);
      return;
    }
    router.push("/panel");
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-76px)] max-w-6xl items-center justify-center px-5 py-12">
      <section className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-7 shadow-sm sm:p-10">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-[#f6e8e8] text-[#a75f6b]"><LockKeyhole size={21} /></div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b76e79]">Bienvenida de vuelta</p>
        <h1 className="mt-2 font-serif text-3xl">Inicia sesión</h1>
        <p className="mt-2 text-sm leading-6 text-stone-500">Accede a tu panel para gestionar tus servicios y citas.</p>
        {error && <div role="alert" className="notice mt-5 border border-red-200 bg-red-50 text-red-800">{error}</div>}
        <form className="mt-7 grid gap-5" onSubmit={submit}>
          <label className="form-field">Correo electrónico
            <input className="form-control" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" />
          </label>
          <label className="form-field">Contraseña
            <input className="form-control" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Tu contraseña" />
          </label>
          <button className="button-primary mt-1" type="submit" disabled={loading}>
            {loading ? <><LoaderCircle size={17} className="animate-spin" /> Validando...</> : "Entrar a mi panel"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-stone-500">¿Aún no tienes perfil? <Link href="/registro" className="font-semibold text-[#9e5a64] hover:underline">Regístrate</Link></p>
      </section>
    </div>
  );
}
