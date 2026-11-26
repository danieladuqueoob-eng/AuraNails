"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const specialties = ["Acrílicas", "Semipermanente", "Soft Gel", "Diseño a mano alzada", "Manicure clásica", "Otra"];

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: "",
    specialty: specialties[0],
    workStart: "09:00",
    workEnd: "18:00",
    email: "",
    password: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (form.workStart >= form.workEnd) {
      setError("La hora de fin debe ser posterior a la hora de inicio.");
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: {
          full_name: form.fullName.trim(),
          specialty: form.specialty,
        },
      },
    });
    if (signUpError) {
      setLoading(false);
      setError(`No se pudo crear la cuenta: ${signUpError.message}`);
      return;
    }

    if (!data.user || !data.session) {
      setLoading(false);
      setMessage("La cuenta fue creada. Para completar tu perfil, inicia sesión después de confirmar el correo. Si desactivaste la confirmación de correo en Supabase, vuelve a intentar el registro.");
      return;
    }

    const { error: profileError } = await supabase.from("manicurists").insert({
      id: data.user.id,
      full_name: form.fullName.trim(),
      specialty: form.specialty,
      work_start_time: form.workStart,
      work_end_time: form.workEnd,
    });
    setLoading(false);
    if (profileError) {
      setError(`Tu cuenta se creó, pero no se pudo guardar el perfil: ${profileError.message}. Inicia sesión y vuelve a intentar o revisa las políticas RLS.`);
      return;
    }
    router.push("/panel");
  }

  return (
    <div className="mx-auto grid min-h-[calc(100vh-76px)] max-w-6xl items-center gap-10 px-5 py-12 md:grid-cols-[0.85fr_1.15fr] sm:px-8">
      <div className="hidden rounded-3xl bg-[#f0e5df] p-10 md:block">
        <Sparkles className="mb-8 text-[#b76e79]" size={28} />
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#9e5a64]">Tu talento merece espacio</p>
        <h1 className="mt-4 font-serif text-5xl leading-tight">Haz crecer tu estudio, a tu manera.</h1>
        <p className="mt-5 max-w-sm leading-7 text-stone-600">Crea tu perfil, publica tus servicios y recibe solicitudes de nuevas clientas.</p>
      </div>
      <div className="mx-auto w-full max-w-xl rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b76e79]">Empieza hoy</p>
        <h2 className="mt-2 font-serif text-3xl">Perfil de manicurista</h2>
        <p className="mt-2 text-sm leading-6 text-stone-500">Completa tus datos para gestionar tus citas desde AuraNails.</p>
        {error && <div role="alert" className="notice mt-5 border border-red-200 bg-red-50 text-red-800">{error}</div>}
        {message && <div role="status" className="notice mt-5 border border-amber-200 bg-amber-50 text-amber-900">{message}</div>}
        <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
          <label className="form-field sm:col-span-2">Nombre completo
            <input className="form-control" name="fullName" autoComplete="name" required minLength={2} maxLength={120} value={form.fullName} onChange={update} placeholder="Tu nombre profesional" />
          </label>
          <label className="form-field sm:col-span-2">Especialidad
            <select className="form-control" name="specialty" value={form.specialty} onChange={update}>
              {specialties.map((specialty) => <option key={specialty}>{specialty}</option>)}
            </select>
          </label>
          <label className="form-field">Inicio de jornada
            <input className="form-control" type="time" name="workStart" required value={form.workStart} onChange={update} />
          </label>
          <label className="form-field">Fin de jornada
            <input className="form-control" type="time" name="workEnd" required value={form.workEnd} onChange={update} />
          </label>
          <label className="form-field sm:col-span-2">Correo electrónico
            <input className="form-control" type="email" name="email" autoComplete="email" required maxLength={254} value={form.email} onChange={update} placeholder="tu@correo.com" />
          </label>
          <label className="form-field sm:col-span-2">Contraseña
            <input className="form-control" type="password" name="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={update} placeholder="Mínimo 8 caracteres" />
          </label>
          <button className="button-primary mt-2 sm:col-span-2" type="submit" disabled={loading}>
            {loading ? <><LoaderCircle size={17} className="animate-spin" /> Creando perfil...</> : "Crear mi perfil"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-stone-500">¿Ya tienes una cuenta? <Link href="/login" className="font-semibold text-[#9e5a64] hover:underline">Inicia sesión</Link></p>
      </div>
    </div>
  );
}
