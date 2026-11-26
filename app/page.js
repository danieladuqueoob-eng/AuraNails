"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Clock3, Gem, LoaderCircle, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const steps = ["Manicurista", "Servicio", "Fecha y hora", "Tus datos"];

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function subscribeToClock(callback) {
  const timer = window.setInterval(callback, 30_000);
  return () => window.clearInterval(timer);
}

function getClientClock() {
  const now = new Date();
  return `${localDateString(now)}|${String(now.getHours() * 60 + now.getMinutes()).padStart(4, "0")}`;
}

function getServerClock() {
  return "";
}

function timeToMinutes(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatTime(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function formatTimeLabel(value) {
  return value.slice(0, 5);
}

export default function BookingPage() {
  const router = useRouter();
  const clock = useSyncExternalStore(subscribeToClock, getClientClock, getServerClock);
  const [today, currentMinute] = clock
    ? [clock.slice(0, 10), Number(clock.slice(11))]
    : ["", -1];
  const [step, setStep] = useState(1);
  const [manicurists, setManicurists] = useState([]);
  const [services, setServices] = useState([]);
  const [busyTimes, setBusyTimes] = useState([]);
  const [selectedManicurist, setSelectedManicurist] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [chosenDate, setChosenDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [client, setClient] = useState({ name: "", email: "", phone: "", notes: "" });
  const [loading, setLoading] = useState(true);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const date = chosenDate || today;

  useEffect(() => {
    let active = true;
    async function loadManicurists() {
      try {
        const { data, error: queryError } = await supabase
          .from("manicurists")
          .select("id, full_name, specialty, work_start_time, work_end_time")
          .eq("is_active", true)
          .order("full_name");
        if (!active) return;
        if (queryError) setError(`No se pudieron cargar las manicuristas: ${queryError.message}`);
        else setManicurists(data ?? []);
      } catch (requestError) {
        if (active) setError(`No se pudo conectar con Supabase: ${requestError.message}`);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadManicurists();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadServices() {
      if (!selectedManicurist) return;
      setServicesLoading(true);
      setServices([]);
      setError("");
      try {
        const { data, error: queryError } = await supabase
          .from("services")
          .select("id, name, description, duration_minutes, price")
          .eq("manicurist_id", selectedManicurist.id)
          .eq("is_active", true)
          .order("name");
        if (!active) return;
        if (queryError) setError(`No se pudieron cargar los servicios: ${queryError.message}`);
        else setServices(data ?? []);
      } catch (requestError) {
        if (active) setError(`No se pudieron cargar los servicios: ${requestError.message}`);
      } finally {
        if (active) setServicesLoading(false);
      }
    }
    loadServices();
    return () => {
      active = false;
    };
  }, [selectedManicurist]);

  useEffect(() => {
    let active = true;
    async function loadAvailability() {
      if (!selectedManicurist || !selectedService || !date) return;
      setAvailabilityLoading(true);
      setSelectedTime("");
      setBusyTimes([]);
      setError("");
      try {
        const { data, error: queryError } = await supabase.rpc("get_busy_times", {
          p_manicurist_id: selectedManicurist.id,
          p_date: date,
        });
        if (!active) return;
        if (queryError) setError(`No se pudieron consultar los horarios: ${queryError.message}`);
        else setBusyTimes(data ?? []);
      } catch (requestError) {
        if (active) setError(`No se pudieron consultar los horarios: ${requestError.message}`);
      } finally {
        if (active) setAvailabilityLoading(false);
      }
    }
    loadAvailability();
    return () => {
      active = false;
    };
  }, [selectedManicurist, selectedService, date]);

  const availableSlots = useMemo(() => {
    if (!selectedManicurist || !selectedService || !date) return [];
    const opening = timeToMinutes(selectedManicurist.work_start_time);
    const closing = timeToMinutes(selectedManicurist.work_end_time);
    const duration = selectedService.duration_minutes;
    const busy = busyTimes.map((item) => ({
      start: timeToMinutes(item.start_time),
      end: timeToMinutes(item.end_time),
    }));
    const isToday = date === today;
    const slots = [];

    for (let start = opening; start + duration <= closing; start += 30) {
      const end = start + duration;
      const overlaps = busy.some((appointment) => start < appointment.end && end > appointment.start);
      if (!overlaps && (!isToday || start > currentMinute)) slots.push(formatTime(start));
    }
    return slots;
  }, [selectedManicurist, selectedService, date, today, currentMinute, busyTimes]);

  const currency = useMemo(
    () => new Intl.NumberFormat("es", { style: "currency", currency: "USD" }),
    [],
  );

  function chooseManicurist(manicurist) {
    setSelectedManicurist(manicurist);
    setSelectedService(null);
    setSelectedTime("");
    setServices([]);
    setError("");
  }

  async function submitAppointment(event) {
    event.preventDefault();
    if (!selectedManicurist || !selectedService || !selectedTime) return;
    setSaving(true);
    setError("");
    try {
      const { error: insertError } = await supabase.from("appointments").insert({
        manicurist_id: selectedManicurist.id,
        service_id: selectedService.id,
        client_name: client.name.trim(),
        client_email: client.email.trim(),
        client_phone: client.phone.trim(),
        design_notes: client.notes.trim(),
        appointment_date: date,
        start_time: selectedTime,
      });
      if (insertError) {
        setError(`No se pudo enviar la solicitud. ${insertError.message}`);
        return;
      }
      setSuccess(true);
    } catch (requestError) {
      setError(`No se pudo enviar la solicitud. ${requestError.message}`);
    } finally {
      setSaving(false);
    }
  }

  function updateClient(event) {
    const { name, value } = event.target;
    setClient((previous) => ({ ...previous, [name]: value }));
  }

  if (success) {
    return (
      <section className="mx-auto flex min-h-[calc(100vh-76px)] max-w-3xl items-center px-5 py-16">
        <div className="w-full rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm sm:p-14">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <Check size={30} />
          </div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-[#b76e79]">Solicitud enviada</p>
          <h1 className="font-serif text-3xl text-stone-900 sm:text-4xl">¡Gracias, {client.name.split(" ")[0]}!</h1>
          <p className="mx-auto mt-4 max-w-lg leading-7 text-stone-600">
            Tu solicitud para <strong>{selectedService?.name}</strong> con{" "}
            <strong>{selectedManicurist?.full_name}</strong> el {date} a las {selectedTime} está pendiente de
            confirmación. Te enviaremos un correo cuando la manicurista confirme.
          </p>
          <button
            className="button-primary mt-8"
            onClick={() => router.push("/")}
          >
            Volver al inicio
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-5 pb-20 pt-10 sm:px-8 sm:pt-16">
      <section className="relative overflow-hidden rounded-[2rem] bg-[#f0e5df] px-7 py-10 sm:px-12 sm:py-14">
        <div className="absolute -right-10 -top-20 h-64 w-64 rounded-full border border-[#d4af37]/40 sm:right-16 sm:top-[-8rem] sm:h-96 sm:w-96" />
        <div className="absolute -right-2 -top-12 h-52 w-52 rounded-full border border-[#d4af37]/30 sm:right-24 sm:top-[-6rem] sm:h-80 sm:w-80" />
        <div className="relative max-w-2xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-xs font-semibold tracking-wide text-[#9e5a64]">
            <Sparkles size={14} /> TU MOMENTO, TU ESTILO
          </div>
          <h1 className="max-w-xl font-serif text-4xl leading-tight tracking-tight text-stone-900 sm:text-6xl">
            Un detalle bonito empieza con <span className="text-[#b76e79]">tus manos.</span>
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-7 text-stone-600 sm:text-base">
            Encuentra tu especialista, elige tu servicio favorito y reserva en unos pocos pasos.
          </p>
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-5xl">
        <div className="mb-8 grid grid-cols-4 gap-2 sm:gap-4">
          {steps.map((label, index) => {
            const number = index + 1;
            const completed = number < step;
            const current = number === step;
            return (
              <button
                type="button"
                key={label}
                onClick={() => number < step && setStep(number)}
                disabled={number > step}
                className="group flex min-w-0 items-center gap-2 text-left disabled:opacity-100 sm:gap-3"
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    completed || current ? "bg-[#b76e79] text-white" : "bg-stone-200 text-stone-500"
                  }`}
                >
                  {completed ? <Check size={15} /> : number}
                </span>
                <span className={`hidden truncate text-xs font-semibold sm:block ${current ? "text-stone-900" : "text-stone-500"}`}>
                  {label}
                </span>
                {number < steps.length && (
                  <span className={`ml-auto hidden h-px flex-1 sm:block ${completed ? "bg-[#b76e79]" : "bg-stone-200"}`} />
                )}
              </button>
            );
          })}
        </div>

        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-[0_12px_42px_rgba(28,25,23,0.04)] sm:p-9">
          <div className="mb-7">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b76e79]">Paso {step} de 4</p>
            <h2 className="mt-2 font-serif text-2xl sm:text-3xl">
              {["Elige a tu especialista", "Un servicio para ti", "¿Cuándo te viene bien?", "Cuéntanos cómo contactarte"][step - 1]}
            </h2>
          </div>

          {error && <div role="alert" className="notice mb-6 border border-red-200 bg-red-50 text-red-800">{error}</div>}

          {step === 1 && (
            loading ? (
              <div className="flex items-center gap-3 py-12 text-stone-500"><LoaderCircle className="animate-spin" size={20} /> Cargando especialistas...</div>
            ) : manicurists.length === 0 ? (
              <div className="rounded-2xl bg-stone-50 p-8 text-center text-stone-600">
                {error ? "Configura las credenciales de Supabase en .env.local y recarga la página para mostrar los perfiles." : "Aún no hay perfiles disponibles. Vuelve pronto para encontrar tu manicurista ideal."}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {manicurists.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => chooseManicurist(item)}
                    className={`rounded-2xl border p-5 text-left transition hover:border-[#b76e79] hover:shadow-md ${
                      selectedManicurist?.id === item.id ? "border-[#b76e79] bg-[#fdf7f7]" : "border-stone-200"
                    }`}
                  >
                    <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[#f6e8e8] text-[#a75f6b]"><Gem size={20} /></span>
                    <span className="block font-serif text-xl">{item.full_name}</span>
                    <span className="mt-1 block text-sm text-stone-600">{item.specialty}</span>
                    <span className="mt-4 flex items-center gap-2 text-xs text-stone-500"><Clock3 size={14} /> {formatTimeLabel(item.work_start_time)} – {formatTimeLabel(item.work_end_time)}</span>
                  </button>
                ))}
              </div>
            )
          )}

          {step === 2 && (
            servicesLoading ? (
              <div className="flex items-center gap-3 py-10 text-stone-500"><LoaderCircle className="animate-spin" size={20} /> Cargando servicios...</div>
            ) : services.length === 0 ? (
              <p className="rounded-2xl bg-stone-50 p-6 text-stone-600">Esta manicurista todavía no tiene servicios publicados.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {services.map((service) => (
                  <button
                    key={service.id}
                    onClick={() => setSelectedService(service)}
                    className={`rounded-2xl border p-5 text-left transition hover:border-[#b76e79] ${
                      selectedService?.id === service.id ? "border-[#b76e79] bg-[#fdf7f7]" : "border-stone-200"
                    }`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="font-serif text-xl">{service.name}</span>
                      <span className="whitespace-nowrap font-semibold text-[#9e5a64]">{currency.format(service.price)}</span>
                    </span>
                    <span className="mt-2 block min-h-10 text-sm leading-5 text-stone-600">{service.description || "Un servicio pensado para ti."}</span>
                    <span className="mt-4 flex items-center gap-2 text-xs font-semibold text-stone-500"><Clock3 size={14} /> {service.duration_minutes} minutos</span>
                  </button>
                ))}
              </div>
            )
          )}

          {step === 3 && (
            <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
              <label className="form-field">
                Fecha de tu cita
                <input className="form-control" type="date" min={today} value={date} onChange={(event) => {
                  if (event.target.value && event.target.value < today) {
                    setError("Selecciona hoy o una fecha futura.");
                    return;
                  }
                  setError("");
                  setChosenDate(event.target.value);
                }} />
                <span className="font-normal text-stone-500">Los horarios se muestran en la hora local.</span>
              </label>
              <div>
                <p className="mb-3 text-sm font-semibold text-stone-700">Horarios disponibles</p>
                {availabilityLoading ? (
                  <p className="flex items-center gap-2 rounded-xl bg-stone-50 p-4 text-sm text-stone-500"><LoaderCircle className="animate-spin" size={16} /> Buscando horarios...</p>
                ) : availableSlots.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {availableSlots.map((time) => (
                      <button
                        key={time}
                        onClick={() => setSelectedTime(time)}
                        className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                          selectedTime === time ? "border-[#b76e79] bg-[#b76e79] text-white" : "border-stone-200 hover:border-[#b76e79]"
                        }`}
                      >{time}</button>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-500">No hay horarios disponibles para esta fecha. Prueba otro día.</p>
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <form id="appointment-form" onSubmit={submitAppointment} className="grid gap-5 sm:grid-cols-2">
              <label className="form-field">Nombre completo
                <input className="form-control" name="name" autoComplete="name" required minLength={2} maxLength={120} value={client.name} onChange={updateClient} placeholder="Tu nombre" />
              </label>
              <label className="form-field">Correo electrónico
                <input className="form-control" type="email" name="email" autoComplete="email" required maxLength={254} value={client.email} onChange={updateClient} placeholder="tu@correo.com" />
              </label>
              <label className="form-field">Teléfono
                <input className="form-control" type="tel" name="phone" autoComplete="tel" required minLength={5} maxLength={40} value={client.phone} onChange={updateClient} placeholder="+1 555 000 0000" />
              </label>
              <label className="form-field sm:col-span-2">Notas del diseño <span className="font-normal text-stone-500">Opcional</span>
                <textarea className="form-control min-h-24 resize-y" name="notes" maxLength={1000} value={client.notes} onChange={updateClient} placeholder="Colores, inspiración o detalles que quieras compartir" />
              </label>
              <div className="sm:col-span-2 rounded-2xl bg-[#faf8f5] p-4 text-sm leading-6 text-stone-600">
                <strong className="text-stone-900">{selectedService?.name}</strong> con {selectedManicurist?.full_name} · {date} · {selectedTime} · {currency.format(selectedService?.price ?? 0)}
              </div>
            </form>
          )}

          <div className="mt-8 flex items-center justify-between border-t border-stone-100 pt-6">
            <button
              className="button-secondary"
              onClick={() => { setError(""); setStep(Math.max(1, step - 1)); }}
              disabled={step === 1 || saving}
            ><ArrowLeft size={16} /> Atrás</button>
            {step < 4 ? (
              <button
                className="button-primary"
                disabled={(step === 1 && (!selectedManicurist || servicesLoading)) || (step === 2 && !selectedService) || (step === 3 && (!selectedTime || availabilityLoading))}
                onClick={() => { setError(""); setStep(step + 1); }}
              >Continuar <ArrowRight size={16} /></button>
            ) : (
              <button className="button-primary" type="submit" form="appointment-form" disabled={saving}>
                {saving ? <><LoaderCircle size={17} className="animate-spin" /> Enviando...</> : <>Enviar solicitud <ArrowRight size={16} /></>}
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
