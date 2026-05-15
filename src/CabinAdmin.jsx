/**
 * PANEL DE ADMINISTRACIÓN — CABAÑAS SILVESTRES
 * =============================================
 * App interna para gestionar reservas de 2 cabañas.
 * Datos guardados en localStorage (persisten al cerrar el navegador).
 *
 * ESTRUCTURA DE DATOS (JSON):
 * {
 *   id: string (uuid corto),
 *   cabinId: "A" | "B",
 *   guestName: string,
 *   phone: string,
 *   checkIn: "YYYY-MM-DD",
 *   checkOut: "YYYY-MM-DD",
 *   totalPrice: number,
 *   amountPaid: number,
 *   source: "whatsapp" | "instagram" | "airbnb" | "directo" | "otro",
 *   status: "confirmed" | "pending" | "blocked",
 *   notes: string,
 *   createdAt: string (ISO)
 * }
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import Swal from "sweetalert2";
import {
  Calendar, List, Settings, Home, Users, ChevronLeft, ChevronRight,
  Plus, X, Edit2, Trash2, Check, Clock, Wrench, AlertCircle, Phone,
  TrendingUp, Moon, LogIn, DollarSign, Filter, Search, ChevronDown,
  Bell, BarChart2, CheckSquare, Wifi, Camera, MessageCircle, Airplay,
  Tag, FileText, Save, Eye
} from "lucide-react";

// ─── CONSTANTES ────────────────────────────────────────────────────────────────

const CABINS = {
  A: { id: "A", name: "Cabaña Blanca",         color: "#22c55e", bg: "#052e16", light: "#bbf7d0", short: "CB" },
  B: { id: "B", name: "Cabaña De Madera",        color: "#f59e0b", bg: "#451a03", light: "#fef3c7", short: "CM" },
};

const STATUS_CONFIG = {
  confirmed: { label: "Pago completo",       color: "#16a34a", bg: "#052e16", icon: Check },
  pending:   { label: "Abono",               color: "#2563eb", bg: "#172554", icon: DollarSign },
  blocked:   { label: "Pendiente de pago",   color: "#ea580c", bg: "#431407", icon: Clock },
};

const SOURCE_CONFIG = {
  whatsapp:  { label: "WhatsApp",   icon: MessageCircle, color: "#22c55e" },
  instagram: { label: "Instagram",  icon: Camera,        color: "#e1306c" },
  airbnb:    { label: "Airbnb",     icon: Airplay,       color: "#ff5a5f" },
  directo:   { label: "Directo",    icon: Phone,         color: "#60a5fa" },
  otro:      { label: "Otro",       icon: Tag,           color: "#a78bfa" },
};

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DAYS_SHORT = ["Do","Lu","Ma","Mi","Ju","Vi","Sá"];
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || "https://taqqsiwepkiqexaimeyr.supabase.co").replace(/\/rest\/v1\/?$/, "");
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_BpHIUWG-rv6BdFmkp1zTZw_BYyA4btz";
const SUPABASE_TABLE = "reservations";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── DATOS INICIALES DE EJEMPLO ────────────────────────────────────────────────
const SEED_DATA = [];

// ─── UTILIDADES ────────────────────────────────────────────────────────────────

function uid() {
  return "res" + Math.random().toString(36).slice(2, 9);
}
function toDate(str) {
  // Parse YYYY-MM-DD as local date (not UTC)
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function toKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function formatCOP(n) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);
}
function parseMoneyInput(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}
function formatMoneyInput(value) {
  const amount = parseMoneyInput(value);
  return amount ? new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(amount) : "";
}
function diffDays(a, b) {
  return Math.max(0, Math.round((toDate(b) - toDate(a)) / 86400000));
}
function isDateInReservation(dateKey, res) {
  return dateKey >= res.checkIn && dateKey <= res.checkOut;
}
function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

function hasReservationConflict(candidate, reservations) {
  return reservations.find((r) => {
    if (r.id === candidate.id) return false;
    if (r.cabinId !== candidate.cabinId) return false;
    return candidate.checkIn < r.checkOut && r.checkIn < candidate.checkOut;
  });
}

function rowToReservation(row) {
  return {
    id: row.id,
    cabinId: row.cabin_id,
    guestName: row.guest_name,
    phone: row.phone || "",
    checkIn: row.check_in,
    checkOut: row.check_out,
    totalPrice: Number(row.total_price || 0),
    amountPaid: Number(row.amount_paid || 0),
    source: row.source || "otro",
    status: row.status || "pending",
    notes: row.notes || "",
    createdAt: row.created_at || new Date().toISOString(),
  };
}

function reservationToRow(reservation) {
  return {
    id: reservation.id,
    cabin_id: reservation.cabinId,
    guest_name: reservation.guestName,
    phone: reservation.phone || "",
    check_in: reservation.checkIn,
    check_out: reservation.checkOut,
    total_price: reservation.totalPrice || 0,
    amount_paid: reservation.amountPaid || 0,
    source: reservation.source || "otro",
    status: reservation.status || "pending",
    notes: reservation.notes || "",
    created_at: reservation.createdAt || new Date().toISOString(),
  };
}

function sortReservations(list) {
  return [...list].sort((a, b) => {
    const byDate = a.checkIn.localeCompare(b.checkIn);
    if (byDate !== 0) return byDate;
    return (b.createdAt || "").localeCompare(a.createdAt || "");
  });
}

// ─── HOOK: PERSISTENCIA EN SUPABASE ───────────────────────────────────────────

function useReservations() {
  const [reservations, setReservations] = useState(SEED_DATA);

  const fetchReservations = useCallback(async () => {
    const { data, error } = await supabase
      .from(SUPABASE_TABLE)
      .select("*")
      .order("check_in", { ascending: true });

    if (error) {
      console.error("Error cargando reservas:", error);
      return;
    }

    setReservations(sortReservations((data || []).map(rowToReservation)));
  }, []);

  useEffect(() => {
    fetchReservations();

    const channel = supabase
      .channel("reservations-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: SUPABASE_TABLE },
        () => fetchReservations()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchReservations]);

  const addReservation = async (data) => {
    const reservation = { ...data, id: uid(), createdAt: new Date().toISOString() };
    const payload = reservationToRow(reservation);

    const { data: inserted, error } = await supabase
      .from(SUPABASE_TABLE)
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    const mapped = rowToReservation(inserted);
    setReservations((prev) => sortReservations([...prev, mapped]));
    return mapped;
  };

  const updateReservation = async (id, data) => {
    const payload = reservationToRow({ ...data, id });
    const { data: updated, error } = await supabase
      .from(SUPABASE_TABLE)
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    const mapped = rowToReservation(updated);
    setReservations((prev) => sortReservations(prev.map((r) => (r.id === id ? mapped : r))));
  };

  const deleteReservation = async (id) => {
    const { error } = await supabase
      .from(SUPABASE_TABLE)
      .delete()
      .eq("id", id);

    if (error) {
      throw error;
    }

    setReservations((prev) => prev.filter((r) => r.id !== id));
  };

  const clearAllReservations = async () => {
    const { error } = await supabase
      .from(SUPABASE_TABLE)
      .delete()
      .neq("id", "");

    if (error) {
      throw error;
    }

    setReservations([]);
  };

  return { reservations, addReservation, updateReservation, deleteReservation, clearAllReservations };
}

// ─── COMPONENTE: SIDEBAR ──────────────────────────────────────────────────────

function Sidebar({ activeView, onNavigate, reservations }) {
  // Contar reservas que no tienen pago completo para el badge
  const pendingCount = reservations.filter(r => r.status !== "confirmed").length;

  const navItems = [
    { id: "calendar", label: "Calendario", icon: Calendar },
    { id: "list",     label: "Reservas",   icon: List,     badge: pendingCount },
    { id: "settings", label: "Configuración", icon: Settings },
  ];

  return (
    <aside className="w-56 min-h-screen flex flex-col border-r border-zinc-800 bg-zinc-950">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-zinc-800">
        <div className="flex items-center gap-2.5 mb-0.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <Home size={14} className="text-emerald-400" />
          </div>
          <span className="text-white font-semibold text-sm tracking-wide">Cabañas Admin</span>
        </div>
        <p className="text-zinc-600 text-xs pl-9">Panel de control</p>
      </div>

      {/* Indicadores de cabañas */}
      <div className="px-4 py-3 border-b border-zinc-800 space-y-1.5">
        {Object.values(CABINS).map(c => (
          <div key={c.id} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
            <span className="text-zinc-400 text-xs truncate">{c.name}</span>
          </div>
        ))}
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ id, label, icon: Icon, badge }) => {
          const isActive = activeView === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group"
              style={{
                background: isActive ? "#18181b" : "transparent",
                color: isActive ? "#fff" : "#71717a",
              }}
            >
              <div className="flex items-center gap-2.5">
                <Icon size={15} style={{ color: isActive ? "#22c55e" : "#52525b" }} />
                <span>{label}</span>
              </div>
              {badge > 0 && (
                <span className="bg-amber-500 text-black text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer del sidebar */}
      <div className="px-4 py-3 border-t border-zinc-800">
        <p className="text-zinc-600 text-xs">☁️ Datos en Supabase</p>
      </div>
    </aside>
  );
}

// ─── COMPONENTE: KPI CARDS ─────────────────────────────────────────────────────

function KpiCards({ reservations }) {
  const today = new Date();
  today.setHours(0,0,0,0);
  const todayKey = toKey(today);

  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = getDaysInMonth(year, month);

  // Calcular días ocupados por cabaña en el mes actual
  function occupiedDaysThisMonth(cabinId) {
    let occupied = new Set();
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(year, month, d);
      const key = toKey(dt);
      const hasRes = reservations.some(r => r.cabinId === cabinId && r.status !== "blocked" && isDateInReservation(key, r));
      if (hasRes) occupied.add(key);
    }
    return occupied.size;
  }

  const occA = Math.round((occupiedDaysThisMonth("A") / daysInMonth) * 100);
  const occB = Math.round((occupiedDaysThisMonth("B") / daysInMonth) * 100);

  // Check-ins esta semana (próximos 7 días)
  const weekCheckins = reservations.filter(r => {
    const ci = toDate(r.checkIn);
    const diff = Math.round((ci - today) / 86400000);
    return diff >= 0 && diff < 7;
  });

  // Ingresos del mes
  const monthRevenue = reservations
    .filter(r => r.checkIn.startsWith(`${year}-${String(month+1).padStart(2,"0")}`) && r.status === "confirmed")
    .reduce((sum, r) => sum + (r.amountPaid || 0), 0);

  // Reservas pendientes de cobro
  const pendingRevenue = reservations
    .filter(r => r.status === "pending")
    .reduce((sum, r) => sum + ((r.totalPrice || 0) - (r.amountPaid || 0)), 0);

  const kpis = [
    {
      label: `Ocupación ${CABINS.A.name.split(" ")[0]}`,
      value: `${occA}%`,
      sub: `${MONTHS[month]}`,
      color: CABINS.A.color,
      icon: BarChart2,
      bar: occA,
    },
    {
      label: `Ocupación ${CABINS.B.name.split(" ")[0]}`,
      value: `${occB}%`,
      sub: `${MONTHS[month]}`,
      color: CABINS.B.color,
      icon: BarChart2,
      bar: occB,
    },
    {
      label: "Check-ins próximos",
      value: weekCheckins.length,
      sub: "Esta semana",
      color: "#60a5fa",
      icon: LogIn,
    },
    {
      label: "Cobrado este mes",
      value: formatCOP(monthRevenue),
      sub: `${formatCOP(pendingRevenue)} pendiente`,
      color: "#a78bfa",
      icon: DollarSign,
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {kpis.map((kpi, i) => {
        const Icon = kpi.icon;
        return (
          <div key={i} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
            <div className="flex items-start justify-between mb-3">
              <p className="text-zinc-400 text-xs leading-snug">{kpi.label}</p>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${kpi.color}20` }}>
                <Icon size={13} style={{ color: kpi.color }} />
              </div>
            </div>
            <p className="text-white font-bold text-xl mb-1">{kpi.value}</p>
            <p className="text-zinc-600 text-xs">{kpi.sub}</p>
            {kpi.bar !== undefined && (
              <div className="mt-2 h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${kpi.bar}%`, background: kpi.color }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── COMPONENTE: MODAL DE RESERVA ─────────────────────────────────────────────

function ReservationModal({ mode, reservation, defaultDate, defaultCabin, onSave, onDelete, onClose }) {
  const isEdit = mode === "edit";
  const today = toKey(new Date());

  const [form, setForm] = useState(() => {
    if (isEdit && reservation) {
      return {
        ...reservation,
        totalPrice: formatMoneyInput(reservation.totalPrice),
        amountPaid: formatMoneyInput(reservation.amountPaid),
      };
    }
    return {
      cabinId: defaultCabin || "A",
      guestName: "",
      phone: "",
      checkIn: defaultDate || today,
      checkOut: "",
      totalPrice: "",
      amountPaid: "",
      source: "whatsapp",
      status: "confirmed",
      notes: "",
    };
  });

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const setMoney = (k) => (e) => {
    setForm((f) => ({
      ...f,
      [k]: formatMoneyInput(e.target.value),
    }));
  };

  const totalPriceValue = parseMoneyInput(form.totalPrice);
  const amountPaidValue = parseMoneyInput(form.amountPaid);
  const nights = form.checkIn && form.checkOut ? diffDays(form.checkIn, form.checkOut) : 0;
  const pending = totalPriceValue - amountPaidValue;
  const hasCheckedOut = form.checkOut && form.checkOut < today;

  const handleSave = () => {
    if (!form.guestName || !form.checkIn || !form.checkOut) return;
    onSave({
      ...form,
      totalPrice: totalPriceValue,
      amountPaid: amountPaidValue,
    });
  };

  const inputClass = "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition";
  const labelClass = "block text-xs text-zinc-400 mb-1.5 font-medium";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="bg-zinc-900 rounded-2xl w-full max-w-lg border border-zinc-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-white font-semibold text-base">
            {isEdit ? "Editar reserva" : "Nueva reserva"}
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition p-1 rounded-lg hover:bg-zinc-800">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Cabaña y estado */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Cabaña</label>
              <select value={form.cabinId} onChange={set("cabinId")} className={inputClass}>
                {Object.values(CABINS).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Estado</label>
              <select value={form.status} onChange={set("status")} className={inputClass}>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Nombre y teléfono */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Nombre del cliente *</label>
              <input value={form.guestName} onChange={set("guestName")} placeholder="Ej. Valentina Ríos" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Teléfono / WhatsApp</label>
              <input value={form.phone} onChange={set("phone")} placeholder="+57 300..." className={inputClass} />
            </div>
          </div>

          {/* Check-in y Check-out */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Check-in *</label>
              <input type="date" value={form.checkIn} onChange={set("checkIn")} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Check-out *</label>
              <input type="date" value={form.checkOut} onChange={set("checkOut")} min={form.checkIn} className={inputClass} />
            </div>
          </div>

          {nights > 0 && (
            <p className="text-xs text-zinc-500 -mt-1">
              {nights} noche{nights > 1 ? "s" : ""}
              {totalPriceValue > 0 && ` · ${formatCOP(totalPriceValue / nights)} por noche`}
            </p>
          )}

          {/* Precios */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Precio total (COP)</label>
              <input type="text" inputMode="numeric" value={form.totalPrice} onChange={setMoney("totalPrice")} placeholder="660.000" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Abono recibido (COP)</label>
              <input type="text" inputMode="numeric" value={form.amountPaid} onChange={setMoney("amountPaid")} placeholder="330.000" className={inputClass} />
            </div>
          </div>

          {/* Resumen de pago */}
          {(totalPriceValue > 0 || amountPaidValue > 0) && (
            <div className="bg-zinc-800 rounded-xl p-3 flex items-center justify-between text-xs">
              <span className="text-zinc-400">Saldo pendiente</span>
              <span className={`font-bold ${pending > 0 || !hasCheckedOut ? "text-amber-400" : "text-emerald-400"}`}>
                {pending > 0 ? formatCOP(pending) : (hasCheckedOut ? "✓ Pagado" : "Se liquida al check-out")}
              </span>
            </div>
          )}

          {/* Fuente */}
          <div>
            <label className={labelClass}>Fuente de la reserva</label>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(SOURCE_CONFIG).map(([k, v]) => {
                const Icon = v.icon;
                const isActive = form.source === k;
                return (
                  <button
                    key={k}
                    onClick={() => setForm(f => ({ ...f, source: k }))}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all border"
                    style={{
                      background: isActive ? `${v.color}20` : "transparent",
                      borderColor: isActive ? v.color : "#3f3f46",
                      color: isActive ? v.color : "#71717a",
                    }}
                  >
                    <Icon size={11} />
                    {v.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className={labelClass}>Notas internas</label>
            <textarea value={form.notes} onChange={set("notes")} rows={2} placeholder="Peticiones especiales, recordatorios..." className={inputClass + " resize-none"} />
          </div>
        </div>

        {/* Footer del modal */}
        <div className="px-6 py-4 border-t border-zinc-800 flex items-center justify-between">
          <div>
            {isEdit && (
              <button onClick={() => onDelete(reservation.id)} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition px-3 py-2 rounded-lg hover:bg-red-500/10">
                <Trash2 size={13} /> Eliminar
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition">
              Cancelar
            </button>
            <button onClick={handleSave} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition">
              <Save size={13} /> Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── COMPONENTE: CALENDARIO MAESTRO ───────────────────────────────────────────

function MasterCalendar({ reservations, onDayClick, onReservationClick }) {
  const today = new Date();
  today.setHours(0,0,0,0);

  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = getFirstDayOfMonth(year, month);
  const totalDays = getDaysInMonth(year, month);

  const prevMonth = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const goToday = () => setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));

  // Construir celdas del calendario
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
      {/* Header del calendario */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <h3 className="text-white font-semibold">
            {MONTHS[month]} <span className="text-zinc-500">{year}</span>
          </h3>
          <button onClick={goToday} className="text-xs text-zinc-500 hover:text-white border border-zinc-700 hover:border-zinc-500 px-2 py-0.5 rounded transition">
            Hoy
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition">
            <ChevronLeft size={15} />
          </button>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition">
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-4 px-5 py-2 border-b border-zinc-800 bg-zinc-950">
        {Object.values(CABINS).map(c => (
          <div key={c.id} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: c.color }} />
            <span className="text-xs text-zinc-500">{c.short} · {c.name}</span>
          </div>
        ))}
        <div className="ml-auto flex gap-3">
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: v.color }} />
              <span className="text-xs text-zinc-600">{v.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Nombres de días */}
      <div className="grid grid-cols-7 border-b border-zinc-800">
        {DAYS_SHORT.map(d => (
          <div key={d} className="text-center text-xs font-medium text-zinc-600 py-2">{d}</div>
        ))}
      </div>

      {/* Cuadrícula de días */}
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} className="border-b border-r border-zinc-800/50 min-h-[90px]" />;

          const date = new Date(year, month, day);
          const key = toKey(date);
          const isToday = key === toKey(today);
          const isPast = date < today;

          // Obtener reservas de cada cabaña para este día
          const resA = reservations.filter(r => r.cabinId === "A" && isDateInReservation(key, r));
          const resB = reservations.filter(r => r.cabinId === "B" && isDateInReservation(key, r));

          return (
            <div
              key={day}
              onClick={() => onDayClick(key)}
              className="border-b border-r border-zinc-800/50 min-h-[90px] p-1.5 cursor-pointer hover:bg-zinc-800/40 transition-colors group relative"
              style={{ background: isToday ? "rgba(34,197,94,0.05)" : undefined }}
            >
              {/* Número del día */}
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className="text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full transition"
                  style={{
                    color: isToday ? "#000" : isPast ? "#3f3f46" : "#a1a1aa",
                    background: isToday ? "#22c55e" : "transparent",
                  }}
                >
                  {day}
                </span>
                {/* Botón añadir (visible en hover) */}
                <Plus size={11} className="text-zinc-700 opacity-0 group-hover:opacity-100 transition" />
              </div>

              {/* Indicadores de reservas */}
              <div className="space-y-1">
                {resA.map(r => (
                  <ReservationChip
                    key={r.id}
                    reservation={r}
                    cabin={CABINS.A}
                    dateKey={key}
                    onClick={(e) => { e.stopPropagation(); onReservationClick(r); }}
                  />
                ))}
                {resB.map(r => (
                  <ReservationChip
                    key={r.id}
                    reservation={r}
                    cabin={CABINS.B}
                    dateKey={key}
                    onClick={(e) => { e.stopPropagation(); onReservationClick(r); }}
                  />
                ))}
                {/* Indicador visual si ambas están libres */}
                {resA.length === 0 && resB.length === 0 && !isPast && (
                  <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: CABINS.A.color + "60" }} />
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: CABINS.B.color + "60" }} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Chip de reserva dentro del día del calendario
function ReservationChip({ reservation, cabin, dateKey, onClick }) {
  const isStart = reservation.checkIn === dateKey;
  const isEnd = reservation.checkOut === dateKey;
  const StatusIcon = STATUS_CONFIG[reservation.status]?.icon || Check;

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-1.5 py-0.5 rounded text-xs transition-all hover:opacity-80 truncate flex items-center gap-1"
      style={{
        width: isEnd ? "50%" : "100%",
        background: `${cabin.color}25`,
        color: cabin.color,
        borderLeft: `2px solid ${cabin.color}`,
        opacity: isEnd ? 0.7 : 1,
      }}
      title={`${cabin.name} · ${reservation.guestName}`}
    >
      <span className="flex-shrink-0 opacity-70"><StatusIcon size={8} /></span>
      <span className="truncate">{isStart ? reservation.guestName : (isEnd ? "Salida" : "·")}</span>
    </button>
  );
}

// ─── COMPONENTE: LISTA DE RESERVAS ────────────────────────────────────────────

function ReservationList({ reservations, onEdit }) {
  const [filter, setFilter] = useState("all"); // "all" | "A" | "B" | "pending" | "confirmed" | "blocked"
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("checkIn"); // "checkIn" | "createdAt" | "name"

  const today = toKey(new Date());

  const filtered = useMemo(() => {
    return reservations
      .filter(r => {
        if (filter === "A" || filter === "B") return r.cabinId === filter;
        if (filter === "pending" || filter === "confirmed" || filter === "blocked") return r.status === filter;
        return true;
      })
      .filter(r => {
        if (!search) return true;
        return r.guestName.toLowerCase().includes(search.toLowerCase()) ||
               r.phone.includes(search);
      })
      .sort((a, b) => {
        if (sort === "checkIn") return a.checkIn.localeCompare(b.checkIn);
        if (sort === "createdAt") return b.createdAt.localeCompare(a.createdAt);
        return a.guestName.localeCompare(b.guestName);
      });
  }, [reservations, filter, search, sort]);

  const filterButtons = [
    { id: "all", label: "Todas" },
    { id: "A", label: CABINS.A.short },
    { id: "B", label: CABINS.B.short },
    { id: "confirmed", label: "Pago completo" },
    { id: "pending", label: "Abono" },
    { id: "blocked", label: "Pendiente de pago" },
  ];

  return (
    <div>
      {/* Barra de búsqueda y filtros */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o teléfono..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
          />
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {filterButtons.map(fb => (
            <button
              key={fb.id}
              onClick={() => setFilter(fb.id)}
              className="px-3 py-1.5 rounded-lg text-xs transition-all border"
              style={{
                background: filter === fb.id ? "#18181b" : "transparent",
                borderColor: filter === fb.id ? "#52525b" : "#27272a",
                color: filter === fb.id ? "#fff" : "#71717a",
              }}
            >
              {fb.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              {["Cliente", "Cabaña", "Check-in", "Check-out", "Noches", "Pago", "Fuente", "Estado", ""].map(h => (
                <th key={h} className="text-left text-xs text-zinc-500 font-medium px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center text-zinc-600 py-12 text-sm">
                  No se encontraron reservas
                </td>
              </tr>
            )}
            {filtered.map((r, i) => {
              const cabin = CABINS[r.cabinId];
              const status = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
              const source = SOURCE_CONFIG[r.source];
              const SourceIcon = source?.icon || Tag;
              const nights = diffDays(r.checkIn, r.checkOut);
              const pending = r.totalPrice - r.amountPaid;
              const isPast = r.checkOut < today;
              const canMarkAsPaid = isPast && pending <= 0 && r.totalPrice > 0;
              const StatusIcon = status.icon;

              return (
                <tr
                  key={r.id}
                  className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                  style={{ opacity: isPast ? 0.5 : 1 }}
                >
                  <td className="px-4 py-3">
                    <p className="text-white font-medium text-xs">{r.guestName}</p>
                    {r.phone && <p className="text-zinc-600 text-xs">{r.phone}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-xs" style={{ color: cabin.color }}>
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cabin.color }} />
                      {cabin.short}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-300 text-xs font-mono">{r.checkIn}</td>
                  <td className="px-4 py-3 text-zinc-300 text-xs font-mono">{r.checkOut}</td>
                  <td className="px-4 py-3 text-zinc-400 text-xs text-center">{nights}</td>
                  <td className="px-4 py-3">
                    <p className="text-white text-xs">{formatCOP(r.totalPrice)}</p>
                    {pending > 0 && (
                      <p className="text-amber-400 text-xs">-{formatCOP(pending)}</p>
                    )}
                    {canMarkAsPaid && (
                      <p className="text-emerald-500 text-xs">✓ Pagado</p>
                    )}
                    {!canMarkAsPaid && pending <= 0 && r.totalPrice > 0 && (
                      <p className="text-amber-400 text-xs">Se liquida al check-out</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-xs" style={{ color: source?.color || "#999" }}>
                      <SourceIcon size={10} /> {source?.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                      style={{ background: `${status.color}15`, color: status.color }}
                    >
                      <StatusIcon size={9} /> {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => onEdit(r)} className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-500 hover:text-white transition">
                      <Edit2 size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-zinc-600 text-xs mt-3 text-right">{filtered.length} reserva{filtered.length !== 1 ? "s" : ""} encontrada{filtered.length !== 1 ? "s" : ""}</p>
    </div>
  );
}

// ─── COMPONENTE: CONFIGURACIÓN ────────────────────────────────────────────────

function SettingsView({ reservations, onClearAll }) {
  const dataStr = JSON.stringify(reservations, null, 2);
  const [copied, setCopied] = useState(false);

  const handleClearAll = async () => {
    const result = await Swal.fire({
      title: "¿Borrar todas las reservas?",
      text: "Esta acción no se puede deshacer.",
      icon: "warning",
      background: "#18181b",
      color: "#f4f4f5",
      confirmButtonText: "Sí, borrar todo",
      cancelButtonText: "Cancelar",
      showCancelButton: true,
      reverseButtons: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#3f3f46",
    });

    if (result.isConfirmed) {
      onClearAll();
      await Swal.fire({
        title: "Reservas eliminadas",
        text: "El historial fue borrado correctamente.",
        icon: "success",
        timer: 1600,
        showConfirmButton: false,
        background: "#18181b",
        color: "#f4f4f5",
      });
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(dataStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = () => {
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reservas_${toKey(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
        <h3 className="text-white font-semibold mb-1">Persistencia de datos</h3>
        <p className="text-zinc-500 text-sm mb-4">
          Las reservas se guardan automáticamente en <code className="text-emerald-400 bg-zinc-800 px-1.5 py-0.5 rounded text-xs">Supabase</code>. Todos los usuarios con acceso al sistema ven los mismos cambios.
        </p>
        <div className="flex items-center gap-2 p-3 bg-zinc-800 rounded-lg">
          <Check size={14} className="text-emerald-400 flex-shrink-0" />
          <span className="text-zinc-300 text-sm">
            {reservations.length} reserva{reservations.length !== 1 ? "s" : ""} guardada{reservations.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
        <h3 className="text-white font-semibold mb-1">Exportar datos</h3>
        <p className="text-zinc-500 text-sm mb-4">Descarga un backup JSON de todas tus reservas.</p>
        <div className="flex gap-2">
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-sm transition">
            <FileText size={13} /> Descargar JSON
          </button>
          <button onClick={handleCopy} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm transition" style={{ color: copied ? "#22c55e" : "#a1a1aa" }}>
            {copied ? <><Check size={13} /> Copiado</> : <><Eye size={13} /> Copiar al portapapeles</>}
          </button>
        </div>
      </div>

      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
        <h3 className="text-white font-semibold mb-1">Vista previa — Estructura JSON</h3>
        <p className="text-zinc-500 text-sm mb-3">Así se almacenan las reservas. Cada campo está documentado al inicio del archivo.</p>
        <pre className="text-xs text-emerald-400 bg-zinc-950 rounded-lg p-4 overflow-auto max-h-48 border border-zinc-800">
          {JSON.stringify(reservations[0] || {}, null, 2)}
        </pre>
      </div>

      <div className="bg-zinc-900 rounded-xl border border-red-900/30 p-5">
        <h3 className="text-white font-semibold mb-1">Zona de peligro</h3>
        <p className="text-zinc-500 text-sm mb-4">Esto borrará TODAS las reservas del localStorage. No hay vuelta atrás.</p>
        <button
          onClick={handleClearAll}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-950 hover:bg-red-900 text-red-400 hover:text-red-300 text-sm border border-red-900 transition"
        >
          <Trash2 size={13} /> Borrar todas las reservas
        </button>
      </div>
    </div>
  );
}

// ─── APP PRINCIPAL ─────────────────────────────────────────────────────────────

export default function App() {
  const { reservations, addReservation, updateReservation, deleteReservation, clearAllReservations } = useReservations();
  const [activeView, setActiveView] = useState("calendar");

  // Estado del modal
  const [modal, setModal] = useState(null);
  // { mode: "create" | "edit", reservation?: obj, defaultDate?: string, defaultCabin?: string }

  // Abrir modal al hacer clic en un día del calendario
  const handleDayClick = (dateKey) => {
    setModal({ mode: "create", defaultDate: dateKey });
  };

  // Abrir modal al hacer clic en una reserva existente
  const handleReservationClick = (res) => {
    setModal({ mode: "edit", reservation: res });
  };

  // Guardar desde el modal
  const handleSave = async (data) => {
    const conflict = hasReservationConflict(data, reservations);
    if (conflict) {
      const cabinName = CABINS[data.cabinId]?.name || "cabaña";
      await Swal.fire({
        title: "Reserva en conflicto",
        text: `No se puede guardar: ${cabinName} ya está ocupada entre ${conflict.checkIn} y ${conflict.checkOut}.`,
        icon: "error",
        confirmButtonText: "Entendido",
        background: "#18181b",
        color: "#f4f4f5",
        confirmButtonColor: "#2563eb",
      });
      return;
    }

    try {
      if (modal.mode === "edit") {
        await updateReservation(data.id, data);
      } else {
        await addReservation(data);
      }
    } catch (error) {
      await Swal.fire({
        title: "Error guardando reserva",
        text: error?.message || "No fue posible guardar la reserva en Supabase.",
        icon: "error",
        confirmButtonText: "Entendido",
        background: "#18181b",
        color: "#f4f4f5",
        confirmButtonColor: "#2563eb",
      });
      return;
    }

    setModal(null);
  };

  const handleDelete = async (id) => {
    try {
      await deleteReservation(id);
    } catch (error) {
      await Swal.fire({
        title: "Error eliminando reserva",
        text: error?.message || "No fue posible eliminar la reserva en Supabase.",
        icon: "error",
        confirmButtonText: "Entendido",
        background: "#18181b",
        color: "#f4f4f5",
        confirmButtonColor: "#2563eb",
      });
      return;
    }

    setModal(null);
  };

  const VIEW_TITLES = {
    calendar: "Calendario general",
    list: "Lista de reservas",
    settings: "Configuración",
  };

  return (
    <div className="theme-light flex min-h-screen bg-white text-zinc-900" style={{ fontFamily: "'system-ui', -apple-system, sans-serif" }}>
      {/* Sidebar */}
      <Sidebar activeView={activeView} onNavigate={setActiveView} reservations={reservations} />

      {/* Contenido principal */}
      <main className="flex-1 overflow-auto bg-white">
        {/* Topbar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 bg-white sticky top-0 z-10">
          <h1 className="text-zinc-900 font-semibold text-base">{VIEW_TITLES[activeView]}</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setModal({ mode: "create" })}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition"
            >
              <Plus size={14} /> Nueva reserva
            </button>
          </div>
        </div>

        {/* Vistas */}
        <div className="p-6">
          {activeView === "calendar" && (
            <>
              <KpiCards reservations={reservations} />
              <MasterCalendar
                reservations={reservations}
                onDayClick={handleDayClick}
                onReservationClick={handleReservationClick}
              />
            </>
          )}
          {activeView === "list" && (
            <ReservationList reservations={reservations} onEdit={handleReservationClick} />
          )}
          {activeView === "settings" && (
            <SettingsView
              reservations={reservations}
              onClearAll={clearAllReservations}
            />
          )}
        </div>
      </main>

      {/* Modal */}
      {modal && (
        <ReservationModal
          mode={modal.mode}
          reservation={modal.reservation}
          defaultDate={modal.defaultDate}
          defaultCabin={modal.defaultCabin}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
