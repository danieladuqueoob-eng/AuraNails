import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function formatDate(date) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("es", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "El cuerpo de la solicitud no es JSON válido." }, { status: 400 });
  }

  const appointmentId = body?.appointmentId;
  const accessToken = body?.access_token;
  if (typeof appointmentId !== "string" || !appointmentId || typeof accessToken !== "string" || !accessToken) {
    return Response.json({ error: "Faltan el identificador de la cita o la sesión." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const gmailUser = process.env.GMAIL_USER;
  const gmailPassword = process.env.GMAIL_APP_PASSWORD;
  if (!supabaseUrl || !supabaseAnonKey || !gmailUser || !gmailPassword) {
    return Response.json({ error: "Falta configurar Supabase o las credenciales de Gmail en las variables de entorno." }, { status: 503 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: userData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !userData.user) {
    return Response.json({ error: "La sesión no es válida o expiró. Inicia sesión nuevamente." }, { status: 401 });
  }

  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .select("id, manicurist_id, client_name, client_email, appointment_date, start_time, end_time, status, booked_service_name, booked_price")
    .eq("id", appointmentId)
    .eq("manicurist_id", userData.user.id)
    .eq("status", "pendiente")
    .maybeSingle();

  if (appointmentError) {
    return Response.json({ error: `No se pudo consultar la cita: ${appointmentError.message}` }, { status: 500 });
  }
  if (!appointment) {
    return Response.json({ error: "La cita no existe, ya fue procesada o no pertenece a tu perfil." }, { status: 404 });
  }

  const { data: manicurist, error: manicuristError } = await supabase
    .from("manicurists")
    .select("full_name")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (manicuristError || !manicurist) {
    return Response.json({ error: manicuristError?.message || "No se encontró el perfil de la manicurista." }, { status: 500 });
  }

  const confirmedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("appointments")
    .update({ status: "confirmada", confirmation_sent_at: confirmedAt })
    .eq("id", appointment.id)
    .eq("manicurist_id", userData.user.id)
    .eq("status", "pendiente")
    .select("id")
    .maybeSingle();

  if (updateError) {
    return Response.json({ error: `No se pudo confirmar la cita: ${updateError.message}` }, { status: 500 });
  }
  if (!updated) {
    return Response.json({ error: "Otra solicitud ya procesó esta cita. Actualiza el panel." }, { status: 409 });
  }

  const clientName = escapeHtml(appointment.client_name);
  const manicuristName = escapeHtml(manicurist.full_name);
  const serviceName = escapeHtml(appointment.booked_service_name);
  const date = escapeHtml(formatDate(appointment.appointment_date));
  const startTime = escapeHtml(appointment.start_time.slice(0, 5));
  const endTime = escapeHtml(appointment.end_time.slice(0, 5));
  const price = new Intl.NumberFormat("es-US", { style: "currency", currency: "USD" }).format(Number(appointment.booked_price));
  const safePrice = escapeHtml(price);

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailPassword },
    });
    await transporter.sendMail({
      from: `"AuraNails" <${gmailUser}>`,
      to: appointment.client_email,
      subject: `Tu cita está confirmada | AuraNails`,
      text: `Hola ${appointment.client_name}, tu cita con ${manicurist.full_name} está confirmada. Servicio: ${appointment.booked_service_name}. Fecha: ${date}. Horario: ${startTime}–${endTime}. Precio: ${price}. Recomendaciones: llega unos minutos antes, trae inspiración de tu diseño y evita aplicar aceites en las uñas antes de tu cita.`,
      html: `<!doctype html><html lang="es"><body style="margin:0;background:#faf8f5;font-family:Arial,sans-serif;color:#1c1917"><div style="max-width:620px;margin:32px auto;background:#fff;border:1px solid #e7e5e4;border-radius:20px;overflow:hidden"><div style="padding:32px;background:#f0e5df;text-align:center"><p style="margin:0;color:#9e5a64;font-size:12px;letter-spacing:3px;text-transform:uppercase">AuraNails</p><h1 style="margin:12px 0 0;font-family:Georgia,serif;font-size:30px;font-weight:normal">Tu cita está confirmada</h1></div><div style="padding:32px"><p style="font-size:16px;line-height:1.7">Hola ${clientName},</p><p style="font-size:15px;line-height:1.7">Tu cita con <strong>${manicuristName}</strong> ya está confirmada. Nos encantará recibirte.</p><div style="margin:24px 0;padding:20px;border-radius:14px;background:#faf8f5;line-height:1.9"><strong>${serviceName}</strong><br>${date}<br>${startTime}–${endTime}<br>Precio: ${safePrice}</div><h2 style="font-family:Georgia,serif;font-size:20px;font-weight:normal">Antes de tu cita</h2><ul style="padding-left:20px;color:#57534e;line-height:1.8"><li>Llega unos minutos antes para comenzar a tiempo.</li><li>Trae referencias o inspiración para tu diseño.</li><li>Evita aplicar aceites o cremas en las uñas justo antes de la cita.</li></ul><p style="margin-top:28px;color:#78716c;font-size:13px">Gracias por reservar con AuraNails.</p></div></div></body></html>`,
    });
  } catch (mailError) {
    const { error: rollbackError } = await supabase
      .from("appointments")
      .update({ status: "pendiente", confirmation_sent_at: null })
      .eq("id", appointment.id)
      .eq("manicurist_id", userData.user.id)
      .eq("status", "confirmada")
      .eq("confirmation_sent_at", confirmedAt);
    if (rollbackError) {
      console.error("Could not roll back appointment after email failure:", rollbackError.message);
      return Response.json({ error: `La cita se confirmó, pero falló el correo y no se pudo revertir el estado. Contacta a la clienta manualmente. Detalle: ${mailError.message}` }, { status: 502 });
    }
    return Response.json({ error: `No se pudo enviar el correo; la cita quedó pendiente para que puedas volver a intentarlo. ${mailError.message}` }, { status: 502 });
  }

  return Response.json({ success: true, appointmentId: appointment.id });
}
