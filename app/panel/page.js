"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, Clock3, LoaderCircle, Plus, Scissors, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const durationOptions = [30, 60, 90, 120];

function prettyDate(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("es", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function prettyTime(time) {
  return time.slice(0, 5);
}

export default function PanelPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingService, setSavingService] = useState(false);
  const [busyAppointment, setBusyAppointment] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [serviceForm, setServiceForm] = useState({ name: "", description: "", duration: "60", price: "" });

  const loadDashboard = useCallback(async (userId) => {
    const [profileResult, servicesResult, appointmentsResult] = await Promise.all([
      supabase.from("manicurists").select("id, full_name, specialty, work_start_time, work_end_time").eq("id", userId).maybeSingle(),
      supabase.from("services").select("id, name, description, duration_minutes, price, is_active").eq("manicurist_id", userId).order("created_at", { ascending: false }),
      supabase.from("appointments").select("id, client_name, client_email, client_phone, design_notes, appointment_date, start_time, end_time, status, created_at, booked_service_name, booked_price").eq("manicurist_id", userId).order("appointment_date", { ascending: true }).order("start_time", { ascending: true }),
    ]);
    const firstError = profileResult.error || servicesResult.error || appointmentsResult.error;
    if (firstError) {
      setError(`No se pudo cargar el panel: ${firstError.message}`);
      return;
    }
    setProfile(profileResult.data);
    setServices(servicesResult.data ?? []);
    setAppointments(appointmentsResult.data ?? []);
  }, []);

  useEffect(() => {
    let active = true;
    async function initialize() {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!active) return;
      if (sessionError) {
        setError(`No se pudo validar la sesión: ${sessionError.message}`);
        setLoading(false);
        return;
      }
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setSession(data.session);
      await loadDashboard(data.session.user.id);
      if (active) setLoading(false);
    }
    initialize();
    return () => {
      active = false;
    };
  }, [loadDashboard, router]);

  async function addService(event) {
    event.preventDefault();
    if (!session) return;
    setSavingService(true);
    setError("");
    setNotice("");
    const { error: insertError } = await supabase.from("services").insert({
      manicurist_id: session.user.id,
      name: serviceForm.name.trim(),
      description: serviceForm.description.trim(),
      duration_minutes: Number(serviceForm.duration),
      price: Number(serviceForm.price),
    });
    setSavingService(false);
    if (insertError) {
      setError(`No se pudo guardar el servicio: ${insertError.message}`);
      return;
    }
    setServiceForm({ name: "", description: "", duration: "60", price: "" });
    setNotice("El servicio quedó publicado y disponible para reservar.");
    await loadDashboard(session.user.id);
  }

  async function deleteService(serviceId) {
    if (!session || !window.confirm("¿Quieres eliminar este servicio?")) return;
    setError("");
    setNotice("");
    const { error: deleteError } = await supabase.from("services").delete().eq("id", serviceId);
    if (deleteError) {
      setError(`No se pudo eliminar el servicio. Si tiene citas, no puede borrarse: ${deleteError.message}`);
      return;
    }
    setNotice("Servicio eliminado.");
    await loadDashboard(session.user.id);
  }

  async function confirmAppointment(appointmentId) {
    if (!session) return;
    setBusyAppointment(appointmentId);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/appointments/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId, access_token: session.access_token }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo confirmar la cita.");
      setNotice("Cita confirmada y correo enviado a la clienta.");
      await loadDashboard(session.user.id);
    } catch (requestError) {
      setError(requestError.message || "Ocurrió un error al confirmar la cita.");
    } finally {
      setBusyAppointment("");
    }
  }

  async function rejectAppointment(appointmentId) {
    if (!session || !window.confirm("¿Rechazar esta solicitud de cita?")) return;
    setBusyAppointment(appointmentId);
    setError("");
    setNotice("");
    const { error: updateError } = await supabase.from("appointments").update({ status: "rechazada" }).eq("id", appointmentId).eq("manicurist_id", session.user.id).eq("status", "pendiente");
    setBusyAppointment("");
    if (updateError) {
      setError(`No se pudo rechazar la cita: ${updateError.message}`);
      return;
    }
    setNotice("Solicitud rechazada.");
    await loadDashboard(session.user.id);
  }

  const pending = appointments.filter((appointment) => appointment.status === "pendiente");
  const history = appointments.filter((appointment) => appointment.status !== "pendiente");

  if (loading) {
    return <div className="flex min-h-[calc(100vh-76px)] items-center justify-center gap-3 text-stone-500"><LoaderCircle size={20} className="animate-spin" /> Cargando tu panel...</div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      <section className="mb-9 flex flex-col justify-between gap-5 rounded-3xl bg-[#f0e5df] p-7 sm:flex-row sm:items-end sm:p-10">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9e5a64]">Espacio profesional</p>
          <h1 className="mt-2 font-serif text-3xl sm:text-4xl">Hola, {profile?.full_name || session?.user?.email}</h1>
          <p className="mt-2 text-sm text-stone-600">{profile?.specialty || "Completa tu perfil"} · {profile ? `${prettyTime(profile.work_start_time)}–${prettyTime(profile.work_end_time)}` : "Tu perfil aún no está configurado"}</p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-2xl bg-white/70 px-5 py-3"><span className="block text-2xl font-semibold">{pending.length}</span><span className="text-xs text-stone-500">pendientes</span></div>
          <div className="rounded-2xl bg-white/70 px-5 py-3"><span className="block text-2xl font-semibold">{services.length}</span><span className="text-xs text-stone-500">servicios</span></div>
        </div>
      </section>

      {error && <div role="alert" className="notice mb-5 border border-red-200 bg-red-50 text-red-800">{error}</div>}
      {notice && <div role="status" className="notice mb-5 border border-emerald-200 bg-emerald-50 text-emerald-800">{notice}</div>}

      <div className="grid items-start gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f6e8e8] text-[#a75f6b]"><Scissors size={19} /></span>
            <div><h2 className="font-serif text-2xl">Mis servicios</h2><p className="text-sm text-stone-500">Comparte lo que haces mejor.</p></div>
          </div>
          <form onSubmit={addService} className="grid gap-4">
            <label className="form-field">Nombre del servicio
              <input className="form-control" required minLength={2} maxLength={100} value={serviceForm.name} onChange={(event) => setServiceForm({ ...serviceForm, name: event.target.value })} placeholder="Ej. Soft gel natural" />
            </label>
            <label className="form-field">Descripción breve
              <textarea className="form-control min-h-20 resize-y" maxLength={300} value={serviceForm.description} onChange={(event) => setServiceForm({ ...serviceForm, description: event.target.value })} placeholder="Qué incluye el servicio" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="form-field">Duración
                <select className="form-control" value={serviceForm.duration} onChange={(event) => setServiceForm({ ...serviceForm, duration: event.target.value })}>
                  {durationOptions.map((minutes) => <option key={minutes} value={minutes}>{minutes} min</option>)}
                </select>
              </label>
              <label className="form-field">Precio (USD)
                <input className="form-control" type="number" min="0" max="99999999" step="0.01" required value={serviceForm.price} onChange={(event) => setServiceForm({ ...serviceForm, price: event.target.value })} placeholder="45.00" />
              </label>
            </div>
            <button type="submit" className="button-primary mt-1" disabled={savingService}>
              {savingService ? <><LoaderCircle size={16} className="animate-spin" /> Guardando...</> : <><Plus size={17} /> Añadir servicio</>}
            </button>
          </form>

          <div className="mt-7 divide-y divide-stone-100 border-t border-stone-100">
            {services.length === 0 && <p className="py-5 text-sm text-stone-500">Todavía no has publicado servicios.</p>}
            {services.map((service) => (
              <div key={service.id} className="flex items-start justify-between gap-3 py-4">
                <div>
                  <p className="font-semibold">{service.name}</p>
                  <p className="mt-1 text-xs text-stone-500">{service.duration_minutes} min · ${Number(service.price).toFixed(2)}</p>
                  {service.description && <p className="mt-1 text-xs leading-5 text-stone-500">{service.description}</p>}
                </div>
                <button aria-label={`Eliminar ${service.name}`} className="rounded-full p-2 text-stone-400 hover:bg-red-50 hover:text-red-600" onClick={() => deleteService(service.id)}><Trash2 size={17} /></button>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-8">
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b76e79]">Requieren tu atención</p><h2 className="mt-1 font-serif text-2xl">Pendientes por confirmar</h2></div>
              <span className="rounded-full bg-[#f6e8e8] px-3 py-1 text-sm font-semibold text-[#9e5a64]">{pending.length}</span>
            </div>
            {pending.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-7 text-center text-sm text-stone-500">No tienes solicitudes pendientes. ¡Buen trabajo!</div>
            ) : <div className="grid gap-4">{pending.map((appointment) => (
              <AppointmentCard key={appointment.id} appointment={appointment} busy={busyAppointment === appointment.id} onConfirm={confirmAppointment} onReject={rejectAppointment} />
            ))}</div>}
          </section>

          <section>
            <div className="mb-4"><p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500">Tus citas</p><h2 className="mt-1 font-serif text-2xl">Confirmadas / Historial</h2></div>
            {history.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-7 text-center text-sm text-stone-500">Aquí aparecerán las citas confirmadas y las solicitudes rechazadas.</div>
            ) : <div className="grid gap-4">{history.map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} />)}</div>}
          </section>
        </div>
      </div>
    </div>
  );
}

function AppointmentCard({ appointment, busy, onConfirm, onReject }) {
  const confirmed = appointment.status === "confirmada";
  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-xl">{appointment.client_name}</h3>
          <p className="mt-1 text-sm text-[#9e5a64]">{appointment.booked_service_name} · ${Number(appointment.booked_price).toFixed(2)}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${confirmed ? "bg-emerald-50 text-emerald-700" : appointment.status === "rechazada" ? "bg-stone-100 text-stone-600" : "bg-amber-50 text-amber-800"}`}>
          {confirmed ? "Confirmada" : appointment.status === "rechazada" ? "Rechazada" : "Pendiente"}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-stone-500">
        <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} /> {prettyDate(appointment.appointment_date)}</span>
        <span className="inline-flex items-center gap-1.5"><Clock3 size={14} /> {prettyTime(appointment.start_time)}–{prettyTime(appointment.end_time)}</span>
      </div>
      <div className="mt-4 space-y-1 text-sm text-stone-600">
        <p><a className="hover:text-[#9e5a64]" href={`mailto:${appointment.client_email}`}>{appointment.client_email}</a> · {appointment.client_phone}</p>
        {appointment.design_notes && <p className="rounded-xl bg-stone-50 p-3 text-xs leading-5">Nota: {appointment.design_notes}</p>}
      </div>
      {appointment.status === "pendiente" && onConfirm && (
        <div className="mt-5 flex flex-wrap gap-2 border-t border-stone-100 pt-4">
          <button className="button-primary !min-h-10 !px-4 !py-2 !text-xs" disabled={busy} onClick={() => onConfirm(appointment.id)}>
            {busy ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />} Confirmar y Notificar
          </button>
          <button className="button-secondary !min-h-10 !px-4 !py-2 !text-xs" disabled={busy} onClick={() => onReject(appointment.id)}><X size={15} /> Rechazar</button>
        </div>
      )}
    </article>
  );
}
