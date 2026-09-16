/**
 * PANEL DE ADMINISTRACIÓN — CABAÑAS SILVESTRES
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import Swal from "sweetalert2";
import {
  Calendar, List, Settings, Home, ChevronLeft, ChevronRight,
  Plus, X, Edit2, Trash2, Check, Clock, Phone,
  DollarSign, Search, BarChart2, LogIn,
  Camera, MessageCircle, Airplay,
  Tag, FileText, Save, Eye, Menu
} from "lucide-react";

// ─── CONSTANTES ────────────────────────────────────────────────────────────────

const CABINS = {
  A: { id: "A", name: "Cabaña Blanca",  color: "#22c55e", short: "CB" },
  B: { id: "B", name: "Cabaña De Madera", color: "#f59e0b", short: "CM" },
};

const STATUS_CONFIG = {
  confirmed: { label: "Pago completo",     color: "#16a34a", icon: Check },
  pending:   { label: "Abono",             color: "#2563eb", icon: DollarSign },
  blocked:   { label: "Pendiente de pago", color: "#ea580c", icon: Clock },
};

const SOURCE_CONFIG = {
  whatsapp:  { label: "WhatsApp",  icon: MessageCircle, color: "#22c55e" },
  instagram: { label: "Instagram", icon: Camera,        color: "#e1306c" },
  airbnb:    { label: "Airbnb",    icon: Airplay,       color: "#ff5a5f" },
  directo:   { label: "Directo",   icon: Phone,         color: "#60a5fa" },
  otro:      { label: "Otro",      icon: Tag,           color: "#a78bfa" },
};

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DAYS_SHORT = ["Do","Lu","Ma","Mi","Ju","Vi","Sá"];
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || "https://nwcscnffgajlqxtsezeh.supabase.co").replace(/\/rest\/v1\/?$/, "");
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_RBPbM12aD03NzavEmop0Rw_9DzFcIKD";
const SUPABASE_TABLE = "reservations";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("[Supabase] Faltan variables de entorno: VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Diagnóstico inicial: verificar que el cliente está configurado
console.log("[Supabase] URL:", SUPABASE_URL);
console.log("[Supabase] Key prefix:", SUPABASE_ANON_KEY?.substring(0, 12) + "...");
console.log("[Supabase] Table:", SUPABASE_TABLE);

const SEED_DATA = [];

// ─── UTILIDADES ────────────────────────────────────────────────────────────────

function uid() {
  return "res" + Math.random().toString(36).slice(2, 9);
}
function toDate(str) {
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
    id: row.id, cabinId: row.cabin_id, guestName: row.guest_name,
    phone: row.phone || "", checkIn: row.check_in, checkOut: row.check_out,
    totalPrice: Number(row.total_price || 0), amountPaid: Number(row.amount_paid || 0),
    source: row.source || "otro", status: row.status || "pending",
    notes: row.notes || "", createdAt: row.created_at || new Date().toISOString(),
  };
}
function reservationToRow(reservation) {
  return {
    id: reservation.id, cabin_id: reservation.cabinId, guest_name: reservation.guestName,
    phone: reservation.phone || "", check_in: reservation.checkIn, check_out: reservation.checkOut,
    total_price: reservation.totalPrice || 0, amount_paid: reservation.amountPaid || 0,
    source: reservation.source || "otro", status: reservation.status || "pending",
    notes: reservation.notes || "", created_at: reservation.createdAt || new Date().toISOString(),
  };
}
function formatSupabaseError(error, context = "") {
  if (!error) return "Error desconocido";
  const parts = [];
  if (context) parts.push(`[${context}]`);
  if (error.message) parts.push(error.message);
  if (error.code) parts.push(`Código: ${error.code}`);
  if (error.details) parts.push(`Detalles: ${error.details}`);
  if (error.hint) parts.push(`Sugerencia: ${error.hint}`);
  if (error.status) parts.push(`HTTP ${error.status}`);
  const msg = parts.join(" | ");
  console.error("[Supabase Error]", msg, error);
  return msg;
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
      .from(SUPABASE_TABLE).select("*").order("check_in", { ascending: true });
    if (error) {
      formatSupabaseError(error, "fetchReservations");
      return;
    }
    setReservations(sortReservations((data || []).map(rowToReservation)));
  }, []);

  useEffect(() => {
    fetchReservations();
    const channel = supabase
      .channel("reservations-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: SUPABASE_TABLE }, () => fetchReservations())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchReservations]);

  const addReservation = async (data) => {
    const reservation = { ...data, id: uid(), createdAt: new Date().toISOString() };
    const row = reservationToRow(reservation);
    const { data: inserted, error } = await supabase
      .from(SUPABASE_TABLE)
      .insert(row)
      .select("*")
      .single();
    if (error) {
      const msg = formatSupabaseError(error, "addReservation");
      throw new Error(msg);
    }
    const mapped = rowToReservation(inserted);
    setReservations((prev) => sortReservations([...prev, mapped]));
    return mapped;
  };

  const updateReservation = async (id, data) => {
    const row = reservationToRow({ ...data, id });
    const { data: updated, error } = await supabase
      .from(SUPABASE_TABLE)
      .update(row)
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      const msg = formatSupabaseError(error, "updateReservation");
      throw new Error(msg);
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
      const msg = formatSupabaseError(error, "deleteReservation");
      throw new Error(msg);
    }
    setReservations((prev) => prev.filter((r) => r.id !== id));
  };

  const clearAllReservations = async () => {
    const { error } = await supabase
      .from(SUPABASE_TABLE)
      .delete()
      .neq("id", "");
    if (error) {
      const msg = formatSupabaseError(error, "clearAllReservations");
      throw new Error(msg);
    }
    setReservations([]);
  };

  return { reservations, addReservation, updateReservation, deleteReservation, clearAllReservations };
}

// ─── SIDEBAR (Drawer en móvil, fijo en desktop) ─────────────────────────────

function Sidebar({ activeView, onNavigate, reservations, isOpen, onClose }) {
  const pendingCount = reservations.filter(r => r.status !== "confirmed").length;

  const navItems = [
    { id: "calendar", label: "Calendario", icon: Calendar },
    { id: "list",     label: "Reservas",   icon: List,     badge: pendingCount },
    { id: "settings", label: "Configuración", icon: Settings },
  ];

  return (
    <>
      {/* Overlay oscuro — solo visible en móvil cuando el drawer está abierto */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-200 md:hidden ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50
          w-64 md:w-56 flex flex-col
          bg-zinc-950 border-r border-zinc-800
          sidebar-drawer
          ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        {/* Logo + botón cerrar */}
        <div className="px-5 py-5 border-b border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Home size={14} className="text-emerald-400" />
              </div>
              <span className="text-white font-semibold text-sm tracking-wide">Cabañas Admin</span>
            </div>
            <button onClick={onClose} className="md:hidden text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition">
              <X size={18} />
            </button>
          </div>
          <p className="text-zinc-500 text-xs pl-9 mt-0.5">Panel de control</p>
        </div>

        {/* Leyenda de cabañas */}
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
                onClick={() => { onNavigate(id); onClose(); }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all duration-150"
                style={{
                  background: isActive ? "#27272a" : "transparent",
                  color: isActive ? "#fff" : "#a1a1aa",
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

        <div className="px-4 py-3 border-t border-zinc-800">
          <p className="text-zinc-600 text-xs">☁️ Datos en Supabase</p>
        </div>
      </aside>
    </>
  );
}

// ─── KPI CARDS ───────────────────────────────────────────────────────────────

function KpiCards({ reservations }) {
  const today = new Date();
  today.setHours(0,0,0,0);

  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = getDaysInMonth(year, month);

  function occupiedDaysThisMonth(cabinId) {
    let occupied = new Set();
    for (let d = 1; d <= daysInMonth; d++) {
      const key = toKey(new Date(year, month, d));
      if (reservations.some(r => r.cabinId === cabinId && r.status !== "blocked" && isDateInReservation(key, r))) {
        occupied.add(key);
      }
    }
    return occupied.size;
  }

  const occA = Math.round((occupiedDaysThisMonth("A") / daysInMonth) * 100);
  const occB = Math.round((occupiedDaysThisMonth("B") / daysInMonth) * 100);

  const weekCheckins = reservations.filter(r => {
    const diff = Math.round((toDate(r.checkIn) - today) / 86400000);
    return diff >= 0 && diff < 7;
  });

  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const normalizeAmount = (v) => typeof v === "number" ? v : parseMoneyInput(String(v ?? ""));
  const isInCurrentMonth = (dv) => {
    if (!dv) return false;
    const raw = String(dv).trim();
    if (raw.startsWith(monthPrefix)) return true;
    const dmy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`.startsWith(monthPrefix);
    const p = new Date(raw);
    return !Number.isNaN(p.getTime()) && p.getFullYear() === year && p.getMonth() === month;
  };

  const monthRevenue = reservations
    .filter(r => r.status !== "blocked" && isInCurrentMonth(r.checkIn))
    .reduce((sum, r) => sum + normalizeAmount(r.amountPaid), 0);

  const pendingRevenue = reservations
    .filter(r => r.status === "pending")
    .reduce((sum, r) => sum + ((r.totalPrice || 0) - (r.amountPaid || 0)), 0);

  const kpis = [
    { label: `Ocupación ${CABINS.A.name.split(" ")[0]}`, value: `${occA}%`, sub: MONTHS[month], color: CABINS.A.color, icon: BarChart2, bar: occA },
    { label: `Ocupación ${CABINS.B.name.split(" ")[0]}`, value: `${occB}%`, sub: MONTHS[month], color: CABINS.B.color, icon: BarChart2, bar: occB },
    { label: "Check-ins próximos", value: weekCheckins.length, sub: "Esta semana", color: "#60a5fa", icon: LogIn },
    { label: "Cobrado este mes", value: formatCOP(monthRevenue), sub: `${formatCOP(pendingRevenue)} pendiente`, color: "#a78bfa", icon: DollarSign },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-4 md:mb-6">
      {kpis.map((kpi, i) => {
        const Icon = kpi.icon;
        return (
          <div key={i} className="bg-zinc-50 rounded-xl p-3 md:p-4 border border-zinc-200">
            <div className="flex items-start justify-between mb-2 md:mb-3">
              <p className="text-zinc-500 text-[10px] md:text-xs leading-snug">{kpi.label}</p>
              <div className="w-6 h-6 md:w-7 md:h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${kpi.color}15` }}>
                <Icon size={11} style={{ color: kpi.color }} />
              </div>
            </div>
            <p className="text-zinc-900 font-bold text-lg md:text-xl mb-0.5">{kpi.value}</p>
            <p className="text-zinc-400 text-[10px] md:text-xs">{kpi.sub}</p>
            {kpi.bar !== undefined && (
              <div className="mt-1.5 md:mt-2 h-1 bg-zinc-200 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${kpi.bar}%`, background: kpi.color }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── MODAL DE RESERVA ───────────────────────────────────────────────────────

function ReservationModal({ mode, reservation, defaultDate, defaultCabin, onSave, onDelete, onClose }) {
  const isEdit = mode === "edit";
  const today = toKey(new Date());

  const [form, setForm] = useState(() => {
    if (isEdit && reservation) {
      return { ...reservation, totalPrice: formatMoneyInput(reservation.totalPrice), amountPaid: formatMoneyInput(reservation.amountPaid) };
    }
    return {
      cabinId: defaultCabin || "A", guestName: "", phone: "",
      checkIn: defaultDate || today, checkOut: "",
      totalPrice: "", amountPaid: "", source: "whatsapp", status: "confirmed", notes: "",
    };
  });

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const setMoney = (k) => (e) => setForm(f => ({ ...f, [k]: formatMoneyInput(e.target.value) }));

  const totalPriceValue = parseMoneyInput(form.totalPrice);
  const amountPaidValue = parseMoneyInput(form.amountPaid);
  const nights = form.checkIn && form.checkOut ? diffDays(form.checkIn, form.checkOut) : 0;
  const pending = totalPriceValue - amountPaidValue;
  const hasCheckedOut = form.checkOut && form.checkOut < today;

  const handleSave = () => {
    if (!form.guestName || !form.checkIn || !form.checkOut) return;
    onSave({ ...form, totalPrice: totalPriceValue, amountPaid: amountPaidValue });
  };

  const inputClass = "w-full bg-zinc-50 border border-zinc-300 rounded-lg px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-300 transition";
  const labelClass = "block text-xs text-zinc-500 mb-1.5 font-medium";

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-lg border border-zinc-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 flex-shrink-0">
          <h2 className="text-zinc-900 font-semibold text-base">
            {isEdit ? "Editar reserva" : "Nueva reserva"}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 transition p-1 rounded-lg hover:bg-zinc-100">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Cabaña</label>
              <select value={form.cabinId} onChange={set("cabinId")} className={inputClass}>
                {Object.values(CABINS).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Estado</label>
              <select value={form.status} onChange={set("status")} className={inputClass}>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Nombre del cliente *</label>
              <input value={form.guestName} onChange={set("guestName")} placeholder="Ej. Valentina Ríos" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Teléfono</label>
              <input value={form.phone} onChange={set("phone")} placeholder="+57 300..." className={inputClass} />
            </div>
          </div>

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
            <p className="text-xs text-zinc-400 -mt-1">
              {nights} noche{nights > 1 ? "s" : ""}
              {totalPriceValue > 0 && ` · ${formatCOP(totalPriceValue / nights)} por noche`}
            </p>
          )}

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

          {(totalPriceValue > 0 || amountPaidValue > 0) && (
            <div className="bg-zinc-100 rounded-xl p-3 flex items-center justify-between text-xs">
              <span className="text-zinc-500">Saldo pendiente</span>
              <span className={`font-bold ${pending > 0 || !hasCheckedOut ? "text-amber-600" : "text-emerald-600"}`}>
                {pending > 0 ? formatCOP(pending) : (hasCheckedOut ? "✓ Pagado" : "Se liquida al check-out")}
              </span>
            </div>
          )}

          <div>
            <label className={labelClass}>Fuente de la reserva</label>
            <div className="flex gap-1.5 flex-wrap">
              {Object.entries(SOURCE_CONFIG).map(([k, v]) => {
                const Icon = v.icon;
                const isActive = form.source === k;
                return (
                  <button
                    key={k}
                    onClick={() => setForm(f => ({ ...f, source: k }))}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-all border"
                    style={{
                      background: isActive ? `${v.color}15` : "transparent",
                      borderColor: isActive ? v.color : "#e5e7eb",
                      color: isActive ? v.color : "#71717a",
                    }}
                  >
                    <Icon size={10} />{v.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className={labelClass}>Notas internas</label>
            <textarea value={form.notes} onChange={set("notes")} rows={2} placeholder="Peticiones especiales..." className={inputClass + " resize-none"} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-200 flex items-center justify-between flex-shrink-0">
          <div>
            {isEdit && (
              <button onClick={() => onDelete(reservation.id)} className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 transition px-2 py-1.5 rounded-lg hover:bg-red-50">
                <Trash2 size={12} /> Eliminar
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 transition">
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

// ─── CALENDARIO MAESTRO ─────────────────────────────────────────────────────

function MasterCalendar({ reservations, onDayClick, onReservationClick }) {
  const today = new Date();
  today.setHours(0,0,0,0);

  const [viewDate, setViewDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d;
  });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = getFirstDayOfMonth(year, month);
  const totalDays = getDaysInMonth(year, month);

  const prevMonth = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const goToday = () => setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);

  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 md:px-5 md:py-4 border-b border-zinc-200">
        <div className="flex items-center gap-2 md:gap-3">
          <h3 className="text-zinc-900 font-semibold text-base md:text-lg">
            {MONTHS[month]} <span className="text-zinc-400">{year}</span>
          </h3>
          <button onClick={goToday} className="text-[10px] md:text-xs text-zinc-500 hover:text-zinc-900 border border-zinc-300 hover:border-zinc-400 px-2 py-0.5 rounded transition">
            Hoy
          </button>
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition">
            <ChevronLeft size={16} />
          </button>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Leyenda desktop */}
      <div className="hidden md:flex items-center gap-4 px-5 py-2 border-b border-zinc-200 bg-zinc-50">
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
              <span className="text-xs text-zinc-400">{v.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Leyenda móvil */}
      <div className="flex md:hidden items-center justify-center gap-4 px-3 py-2 border-b border-zinc-200 bg-zinc-50">
        {Object.values(CABINS).map(c => (
          <div key={c.id} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
            <span className="text-[10px] text-zinc-500">{c.short}</span>
          </div>
        ))}
      </div>

      {/* Días de la semana */}
      <div className="grid grid-cols-7 border-b border-zinc-200">
        {DAYS_SHORT.map(d => (
          <div key={d} className="text-center text-[10px] md:text-xs font-medium text-zinc-400 py-1.5 md:py-2">{d}</div>
        ))}
      </div>

      {/* Grid de días */}
      <div className="grid grid-cols-7 calendar-grid">
        {cells.map((day, idx) => {
          if (!day) {
            return <div key={`empty-${idx}`} className="min-h-[44px] md:min-h-[90px]" />;
          }

          const date = new Date(year, month, day);
          const key = toKey(date);
          const isToday = key === toKey(today);
          const isPast = date < today;

          const resA = reservations.filter(r => r.cabinId === "A" && isDateInReservation(key, r));
          const resB = reservations.filter(r => r.cabinId === "B" && isDateInReservation(key, r));
          const hasAnyReservation = resA.length > 0 || resB.length > 0;

          return (
            <div
              key={day}
              onClick={() => onDayClick(key)}
              className="min-h-[44px] md:min-h-[90px] px-0.5 pt-1 pb-0.5 md:p-1.5 cursor-pointer hover:bg-zinc-50 transition-colors group relative border-b border-zinc-100"
            >
              {/* Número del día */}
              <div className="flex items-center justify-center md:justify-start md:mb-1">
                <span
                  className="text-xs md:text-sm font-medium w-6 h-6 md:w-7 md:h-7 flex items-center justify-center rounded-full transition"
                  style={{
                    color: isToday ? "#ffffff" : isPast ? "#a1a1aa" : "#3f3f46",
                    background: isToday ? "#ef4444" : "transparent",
                    fontWeight: isToday ? "700" : "500",
                  }}
                >
                  {day}
                </span>
              </div>

              {/* Desktop: chips de texto */}
              <div className="hidden md:block space-y-0.5">
                {resA.map(r => (
                  <ReservationChip key={r.id} reservation={r} cabin={CABINS.A} dateKey={key} onClick={(e) => { e.stopPropagation(); onReservationClick(r); }} />
                ))}
                {resB.map(r => (
                  <ReservationChip key={r.id} reservation={r} cabin={CABINS.B} dateKey={key} onClick={(e) => { e.stopPropagation(); onReservationClick(r); }} />
                ))}
              </div>

              {/* Móvil: dots de color */}
              {hasAnyReservation && (
                <div className="flex md:hidden items-center justify-center gap-[3px] mt-0.5">
                  {resA.length > 0 && <span className="w-[5px] h-[5px] rounded-full" style={{ background: CABINS.A.color }} />}
                  {resB.length > 0 && <span className="w-[5px] h-[5px] rounded-full" style={{ background: CABINS.B.color }} />}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Chip de reserva (solo desktop)
function ReservationChip({ reservation, cabin, dateKey, onClick }) {
  const isStart = reservation.checkIn === dateKey;
  const isEnd = reservation.checkOut === dateKey;
  const StatusIcon = STATUS_CONFIG[reservation.status]?.icon || Check;

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-1 py-0.5 rounded text-[10px] transition-all hover:opacity-80 truncate flex items-center gap-1"
      style={{
        width: isEnd ? "50%" : "100%",
        background: `${cabin.color}18`,
        color: cabin.color,
        borderLeft: `2px solid ${cabin.color}`,
        opacity: isEnd ? 0.6 : 1,
      }}
      title={`${cabin.name} · ${reservation.guestName}`}
    >
      <StatusIcon size={7} className="flex-shrink-0 opacity-70" />
      <span className="truncate">{isStart ? reservation.guestName : (isEnd ? "Salida" : "·")}</span>
    </button>
  );
}

// ─── LISTA DE RESERVAS ──────────────────────────────────────────────────────

function ReservationList({ reservations, onEdit }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const today = toKey(new Date());

  const filtered = useMemo(() => {
    return reservations
      .filter(r => {
        if (filter === "A" || filter === "B") return r.cabinId === filter;
        if (["pending","confirmed","blocked"].includes(filter)) return r.status === filter;
        return true;
      })
      .filter(r => !search || r.guestName.toLowerCase().includes(search.toLowerCase()) || r.phone.includes(search))
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  }, [reservations, filter, search]);

  const filterButtons = [
    { id: "all", label: "Todas" },
    { id: "A", label: CABINS.A.short },
    { id: "B", label: CABINS.B.short },
    { id: "confirmed", label: "Pago" },
    { id: "pending", label: "Abono" },
    { id: "blocked", label: "Pendiente" },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="w-full bg-zinc-50 border border-zinc-200 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-400"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {filterButtons.map(fb => (
            <button
              key={fb.id} onClick={() => setFilter(fb.id)}
              className="px-2.5 py-1 rounded-lg text-[11px] md:text-xs transition-all border"
              style={{
                background: filter === fb.id ? "#18181b" : "transparent",
                borderColor: filter === fb.id ? "#18181b" : "#e5e7eb",
                color: filter === fb.id ? "#fff" : "#71717a",
              }}
            >
              {fb.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tarjetas en móvil, tabla en desktop */}
      <div className="md:hidden space-y-2">
        {filtered.length === 0 && (
          <p className="text-zinc-400 text-sm text-center py-10">No se encontraron reservas</p>
        )}
        {filtered.map(r => {
          const cabin = CABINS[r.cabinId];
          const status = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
          const StatusIcon = status.icon;
          const isPast = r.checkOut < today;
          return (
            <div
              key={r.id}
              onClick={() => onEdit(r)}
              className="bg-zinc-50 rounded-xl border border-zinc-200 p-3 cursor-pointer active:bg-zinc-100 transition"
              style={{ opacity: isPast ? 0.5 : 1 }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: cabin.color }} />
                  <span className="text-zinc-900 font-medium text-sm">{r.guestName}</span>
                </div>
                <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${status.color}12`, color: status.color }}>
                  <StatusIcon size={9} />{status.label}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                <span>{r.checkIn} → {r.checkOut}</span>
                <span>{diffDays(r.checkIn, r.checkOut)}n</span>
                <span className="ml-auto font-medium text-zinc-600">{formatCOP(r.totalPrice)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden md:block bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200">
              {["Cliente","Cabaña","Check-in","Check-out","Noches","Pago","Fuente","Estado",""].map(h => (
                <th key={h} className="text-left text-xs text-zinc-400 font-medium px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="text-center text-zinc-400 py-12 text-sm">No se encontraron reservas</td></tr>
            )}
            {filtered.map(r => {
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
                <tr key={r.id} className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors" style={{ opacity: isPast ? 0.5 : 1 }}>
                  <td className="px-4 py-3">
                    <p className="text-zinc-900 font-medium text-xs">{r.guestName}</p>
                    {r.phone && <p className="text-zinc-400 text-xs">{r.phone}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-xs" style={{ color: cabin.color }}>
                      <span className="w-2 h-2 rounded-full" style={{ background: cabin.color }} />{cabin.short}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 text-xs font-mono">{r.checkIn}</td>
                  <td className="px-4 py-3 text-zinc-600 text-xs font-mono">{r.checkOut}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs text-center">{nights}</td>
                  <td className="px-4 py-3">
                    <p className="text-zinc-900 text-xs">{formatCOP(r.totalPrice)}</p>
                    {pending > 0 && <p className="text-amber-500 text-xs">-{formatCOP(pending)}</p>}
                    {canMarkAsPaid && <p className="text-emerald-500 text-xs">✓ Pagado</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-xs" style={{ color: source?.color || "#999" }}>
                      <SourceIcon size={10} /> {source?.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: `${status.color}12`, color: status.color }}>
                      <StatusIcon size={9} /> {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => onEdit(r)} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition">
                      <Edit2 size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-zinc-400 text-xs mt-3 text-right">{filtered.length} reserva{filtered.length !== 1 ? "s" : ""}</p>
    </div>
  );
}

// ─── CONFIGURACIÓN ───────────────────────────────────────────────────────────

function SettingsView({ reservations, onClearAll }) {
  const dataStr = JSON.stringify(reservations, null, 2);
  const [copied, setCopied] = useState(false);

  const handleClearAll = async () => {
    const result = await Swal.fire({
      title: "¿Borrar todas las reservas?", text: "Esta acción no se puede deshacer.",
      icon: "warning", confirmButtonText: "Sí, borrar todo", cancelButtonText: "Cancelar",
      showCancelButton: true, reverseButtons: true, confirmButtonColor: "#dc2626", cancelButtonColor: "#d4d4d8",
    });
    if (result.isConfirmed) {
      onClearAll();
      await Swal.fire({ title: "Eliminadas", text: "Reservas borradas.", icon: "success", timer: 1500, showConfirmButton: false });
    }
  };

  const handleCopy = () => { navigator.clipboard.writeText(dataStr); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const handleExport = () => {
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `reservas_${toKey(new Date())}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-2xl space-y-4 md:space-y-6">
      <div className="bg-zinc-50 rounded-xl border border-zinc-200 p-4 md:p-5">
        <h3 className="text-zinc-900 font-semibold mb-1 text-sm md:text-base">Persistencia de datos</h3>
        <p className="text-zinc-500 text-xs md:text-sm mb-3">
          Las reservas se guardan en <code className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded text-xs">Supabase</code>. Todos los usuarios ven los mismos cambios.
        </p>
        <div className="flex items-center gap-2 p-3 bg-white rounded-lg border border-zinc-200">
          <Check size={14} className="text-emerald-500 flex-shrink-0" />
          <span className="text-zinc-600 text-sm">{reservations.length} reserva{reservations.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      <div className="bg-zinc-50 rounded-xl border border-zinc-200 p-4 md:p-5">
        <h3 className="text-zinc-900 font-semibold mb-1 text-sm md:text-base">Exportar datos</h3>
        <p className="text-zinc-500 text-xs md:text-sm mb-3">Descarga un backup JSON.</p>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-700 text-xs md:text-sm transition">
            <FileText size={13} /> Descargar
          </button>
          <button onClick={handleCopy} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-zinc-200 hover:bg-zinc-100 text-xs md:text-sm transition" style={{ color: copied ? "#16a34a" : "#71717a" }}>
            {copied ? <><Check size={13} /> Copiado</> : <><Eye size={13} /> Copiar</>}
          </button>
        </div>
      </div>

      <div className="bg-zinc-50 rounded-xl border border-zinc-200 p-4 md:p-5">
        <h3 className="text-zinc-900 font-semibold mb-1 text-sm md:text-base">Vista previa JSON</h3>
        <pre className="text-[10px] md:text-xs text-emerald-700 bg-white rounded-lg p-3 md:p-4 overflow-auto max-h-40 md:max-h-48 border border-zinc-200">
          {JSON.stringify(reservations[0] || {}, null, 2)}
        </pre>
      </div>

      <div className="bg-red-50 rounded-xl border border-red-200 p-4 md:p-5">
        <h3 className="text-zinc-900 font-semibold mb-1 text-sm md:text-base">Zona de peligro</h3>
        <p className="text-zinc-500 text-xs md:text-sm mb-3">Borra TODAS las reservas. No hay vuelta atrás.</p>
        <button onClick={handleClearAll} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-red-200 text-red-500 hover:bg-red-50 text-xs md:text-sm transition">
          <Trash2 size={13} /> Borrar todo
        </button>
      </div>
    </div>
  );
}

// ─── APP PRINCIPAL ───────────────────────────────────────────────────────────

export default function App() {
  const { reservations, addReservation, updateReservation, deleteReservation, clearAllReservations } = useReservations();
  const [activeView, setActiveView] = useState("calendar");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modal, setModal] = useState(null);

  const handleDayClick = (dateKey) => setModal({ mode: "create", defaultDate: dateKey });
  const handleReservationClick = (res) => setModal({ mode: "edit", reservation: res });

  const handleSave = async (data) => {
    const conflict = hasReservationConflict(data, reservations);
    if (conflict) {
      await Swal.fire({
        title: "Conflicto de reserva",
        text: `${CABINS[data.cabinId]?.name} ya está ocupada entre ${conflict.checkIn} y ${conflict.checkOut}.`,
        icon: "error", confirmButtonText: "Entendido", confirmButtonColor: "#2563eb",
      });
      return;
    }
    try {
      if (modal.mode === "edit") await updateReservation(data.id, data);
      else await addReservation(data);
    } catch (error) {
      const detail = error?.message || "Error desconocido al guardar.";
      console.error("[handleSave]", detail, error);
      await Swal.fire({
        title: "Error al guardar",
        html: `<div style="text-align:left;font-size:13px;word-break:break-word;">${detail.replace(/\|/g, "<br>")}</div>`,
        icon: "error",
        confirmButtonText: "Entendido",
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
      const detail = error?.message || "Error desconocido al eliminar.";
      console.error("[handleDelete]", detail, error);
      await Swal.fire({
        title: "Error al eliminar",
        html: `<div style="text-align:left;font-size:13px;word-break:break-word;">${detail.replace(/\|/g, "<br>")}</div>`,
        icon: "error",
        confirmButtonText: "Entendido",
        confirmButtonColor: "#2563eb",
      });
      return;
    }
    setModal(null);
  };

  const VIEW_TITLES = { calendar: "Calendario", list: "Reservas", settings: "Configuración" };

  return (
    <div className="theme-light flex min-h-screen bg-white text-zinc-900" style={{ fontFamily: "'system-ui', -apple-system, sans-serif" }}>
      <Sidebar activeView={activeView} onNavigate={setActiveView} reservations={reservations} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 min-w-0 overflow-auto bg-white">
        {/* TopBar */}
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-zinc-200 bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2 md:gap-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-500 transition">
              <Menu size={20} />
            </button>
            <h1 className="text-zinc-900 font-semibold text-sm md:text-base">{VIEW_TITLES[activeView]}</h1>
          </div>
          <button
            onClick={() => setModal({ mode: "create" })}
            className="flex items-center gap-1.5 px-3 md:px-4 py-1.5 md:py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs md:text-sm font-medium transition"
          >
            <Plus size={13} /> <span className="hidden sm:inline">Nueva reserva</span>
          </button>
        </div>

        {/* Contenido */}
        <div className="p-3 md:p-6">
          {activeView === "calendar" && (
            <>
              <KpiCards reservations={reservations} />
              <MasterCalendar reservations={reservations} onDayClick={handleDayClick} onReservationClick={handleReservationClick} />
            </>
          )}
          {activeView === "list" && <ReservationList reservations={reservations} onEdit={handleReservationClick} />}
          {activeView === "settings" && <SettingsView reservations={reservations} onClearAll={clearAllReservations} />}
        </div>
      </main>

      {modal && (
        <ReservationModal mode={modal.mode} reservation={modal.reservation} defaultDate={modal.defaultDate} defaultCabin={modal.defaultCabin} onSave={handleSave} onDelete={handleDelete} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
