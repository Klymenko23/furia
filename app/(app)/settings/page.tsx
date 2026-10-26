"use client";

import { useEffect, useState } from "react";
import { useData } from "@/components/DataProvider";
import { DocList } from "@/components/Docs";
import { ConfirmButton, Field, Sheet, dbError } from "@/components/ui";
import { catLabel, CATEGORIES, CURRENCIES, FIRM_KIND_NAME, ROLE_NAME, TAX_MODE_NAME } from "@/lib/constants";
import { initials, money, parseNum } from "@/lib/utils";
import type { DailyRate, Firm, Profile, Role, Supplier } from "@/lib/types";
import { createUser, resetPassword, updateUser } from "./actions";

export default function SettingsPage() {
  const { isOwner } = useData();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Налаштування</h1>
          <p>{isOwner ? "Фірми, добові, постачальники й доступи." : "Змінювати налаштування може лише власник."}</p>
        </div>
      </div>
      <Firms />
      <div className="cols">
        <DailyRates />
        <Suppliers />
      </div>
      {isOwner && <Users />}
    </>
  );
}

/* ---------- Фірми ---------- */
function Firms() {
  const { firms, isOwner } = useData();
  const [edit, setEdit] = useState<Partial<Firm> | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className="card" aria-labelledby="h-firms">
      <div className="sec-head">
        <h2 className="sec" id="h-firms">Фірми</h2>
        {isOwner && <button className="btn sm" onClick={() => setEdit({})}>+ Фірма</button>}
      </div>
      <p className="muted small" style={{ margin: 0 }}>На які ФОП, ТОВ чи ПП заходять гроші за рейси. Від цього залежать рахунок і податки рейсу.</p>
      {firms.length === 0 ? <div className="empty">Ще немає фірм.</div> : (
        <div className="list">
          {firms.map((f) => (
            <div key={f.id} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="li">
                <button type="button" className="li-btn" onClick={() => setOpen(open === f.id ? null : f.id)} aria-expanded={open === f.id}>
                  <span className="av" aria-hidden="true">{FIRM_KIND_NAME[f.kind]}</span>
                  <span className="li-main">
                    <span className="li-title">{f.name}{f.archived ? " · в архіві" : ""}</span>
                    <span className="li-sub">{[TAX_MODE_NAME[f.tax_mode], f.fee_percent ? `відсоток за проведення ${f.fee_percent}%` : "", f.code && `код ${f.code}`, open === f.id ? "сховати документи" : "документи фірми"].filter(Boolean).join(" · ")}</span>
                  </span>
                </button>
                {isOwner && <button type="button" className="btn ghost sm" onClick={() => setEdit(f)}>Змінити</button>}
              </div>
              {open === f.id && <DocList subject={{ kind: "firm", id: f.id }} />}
            </div>
          ))}
        </div>
      )}
      {edit && <FirmSheet firm={edit} onClose={() => setEdit(null)} />}
    </section>
  );
}

function FirmSheet({ firm, onClose }: { firm: Partial<Firm>; onClose: () => void }) {
  const { supabase, reload } = useData();
  const [name, setName] = useState(firm.name ?? "");
  const [kind, setKind] = useState<Firm["kind"]>(firm.kind ?? "fop");
  const [tax, setTax] = useState<Firm["tax_mode"]>(firm.tax_mode ?? "fop3");
  const [fee, setFee] = useState(firm.fee_percent ? String(firm.fee_percent) : "");
  const [code, setCode] = useState(firm.code ?? "");
  const [iban, setIban] = useState(firm.iban ?? "");
  const [note, setNote] = useState(firm.note ?? "");
  const [err, setErr] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setErr("Вкажіть назву.");
    const row = { name: name.trim(), kind, tax_mode: tax, fee_percent: parseNum(fee) ?? 0, code: code.trim(), iban: iban.replace(/\s/g, "").toUpperCase(), note: note.trim() };
    const { error } = firm.id ? await supabase.from("firms").update(row).eq("id", firm.id) : await supabase.from("firms").insert(row);
    if (error) return setErr(dbError(error));
    await reload(); onClose();
  }
  async function archive() {
    const { error } = await supabase.from("firms").update({ archived: !firm.archived }).eq("id", firm.id!);
    if (error) return setErr(dbError(error));
    await reload(); onClose();
  }

  return (
    <Sheet onClose={onClose} label="Фірма">
      <h2>{firm.id ? firm.name : "Нова фірма"}</h2>
      <form className="form" onSubmit={save}>
        <div className="fields">
          <Field label="Назва" htmlFor="f-name" wide><input id="f-name" placeholder="ФОП Клименко К. А." value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Тип" htmlFor="f-kind">
            <select id="f-kind" value={kind} onChange={(e) => setKind(e.target.value as Firm["kind"])}>
              {(Object.keys(FIRM_KIND_NAME) as Firm["kind"][]).map((k) => <option key={k} value={k}>{FIRM_KIND_NAME[k]}</option>)}
            </select>
          </Field>
          <Field label="Оподаткування" htmlFor="f-tax">
            <select id="f-tax" value={tax} onChange={(e) => setTax(e.target.value as Firm["tax_mode"])}>
              {(Object.keys(TAX_MODE_NAME) as Firm["tax_mode"][]).map((k) => <option key={k} value={k}>{TAX_MODE_NAME[k]}</option>)}
            </select>
          </Field>
          <Field label="Відсоток за проведення, %" htmlFor="f-fee" hint="Якщо гроші проходять через чужу фірму. Віднімається з фрахту">
            <input id="f-fee" inputMode="decimal" placeholder="0" value={fee} onChange={(e) => setFee(e.target.value)} />
          </Field>
          <Field label="ЄДРПОУ / ІПН" htmlFor="f-code"><input id="f-code" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} /></Field>
          <Field label="IBAN" htmlFor="f-iban" wide><input id="f-iban" autoCapitalize="characters" value={iban} onChange={(e) => setIban(e.target.value)} /></Field>
          <Field label="Нотатки" htmlFor="f-note" wide><input id="f-note" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>
        {err && <div className="error" role="alert">{err}</div>}
        <div className="row end">
          {firm.id && <ConfirmButton label={firm.archived ? "Повернути з архіву" : "В архів"} onConfirm={archive} className="btn ghost sm" />}
          <button type="button" className="btn ghost" onClick={onClose}>Скасувати</button>
          <button type="submit" className="btn primary">Зберегти</button>
        </div>
      </form>
    </Sheet>
  );
}

/* ---------- Добові по країнах ---------- */
const COUNTRIES: [string, string][] = [
  ["UA", "Україна"], ["PL", "Польща"], ["DE", "Німеччина"], ["CZ", "Чехія"], ["SK", "Словаччина"], ["HU", "Угорщина"],
  ["RO", "Румунія"], ["MD", "Молдова"], ["LT", "Литва"], ["LV", "Латвія"], ["EE", "Естонія"], ["AT", "Австрія"],
  ["NL", "Нідерланди"], ["BE", "Бельгія"], ["FR", "Франція"], ["IT", "Італія"], ["ES", "Іспанія"], ["BG", "Болгарія"], ["TR", "Туреччина"],
];
const countryName = (c: string) => COUNTRIES.find(([k]) => k === c)?.[1] ?? c;

function DailyRates() {
  const { supabase, isOwner } = useData();
  const [rates, setRates] = useState<DailyRate[]>([]);
  const [country, setCountry] = useState("PL");
  const [amount, setAmount] = useState("");
  const [cur, setCur] = useState("EUR");
  const [err, setErr] = useState("");
  const load = () => supabase.from("daily_rates").select("*").order("country").then(({ data }) => setRates((data as DailyRate[]) ?? []));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const a = parseNum(amount);
    if (!a) return setErr("Вкажіть суму.");
    const { error } = await supabase.from("daily_rates").upsert({ country, amount: a, currency: cur });
    if (error) return setErr(dbError(error));
    setAmount(""); setErr(""); load();
  }

  return (
    <section className="card" aria-labelledby="h-daily">
      <h2 className="sec" id="h-daily">Добові по країнах</h2>
      <p className="muted small" style={{ margin: 0 }}>Для водіїв зі схемою «відсоток + добові». Рахуватимуться в рейсах.</p>
      {rates.length === 0 ? <div className="empty">Ставки ще не задані.</div> : (
        <div className="list">
          {rates.map((r) => (
            <div key={r.country} className="li">
              <div className="li-main"><span className="li-title">{countryName(r.country)}</span></div>
              <div className="li-end" style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <b>{money(r.amount, r.currency)} / день</b>
                {isOwner && <ConfirmButton label="×" className="btn ghost sm" onConfirm={async () => { await supabase.from("daily_rates").delete().eq("country", r.country); load(); }} />}
              </div>
            </div>
          ))}
        </div>
      )}
      {isOwner && (
        <form className="row" onSubmit={add}>
          <select aria-label="Країна" value={country} onChange={(e) => setCountry(e.target.value)} style={{ flex: "1 1 140px", width: "auto" }}>
            {COUNTRIES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select>
          <input aria-label="Сума за день" inputMode="decimal" placeholder="Сума" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ flex: "1 1 80px", width: "auto" }} />
          <select aria-label="Валюта" value={cur} onChange={(e) => setCur(e.target.value)} style={{ width: 90 }}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
          <button className="btn sm" type="submit">Зберегти</button>
        </form>
      )}
      {err && <div className="error" role="alert">{err}</div>}
    </section>
  );
}

/* ---------- Постачальники ---------- */
function Suppliers() {
  const { suppliers } = useData();
  const [edit, setEdit] = useState<Supplier | null>(null);
  return (
    <section className="card" aria-labelledby="h-sup">
      <h2 className="sec" id="h-sup">Магазини й постачальники</h2>
      <p className="muted small" style={{ margin: 0 }}>Додаються самі, коли вносите витрату з новою назвою.</p>
      {suppliers.length === 0 ? <div className="empty">Поки порожньо.</div> : (
        <div className="list">
          {suppliers.map((s) => (
            <button key={s.id} type="button" className="li" onClick={() => setEdit(s)}>
              <div className="li-main">
                <span className="li-title">{s.name}</span>
                <span className="li-sub">{[s.category && catLabel(s.category), s.phone].filter(Boolean).join(" · ")}</span>
              </div>
            </button>
          ))}
        </div>
      )}
      {edit && <SupplierSheet s={edit} onClose={() => setEdit(null)} />}
    </section>
  );
}

function SupplierSheet({ s, onClose }: { s: Supplier; onClose: () => void }) {
  const { supabase, reload } = useData();
  const [name, setName] = useState(s.name);
  const [category, setCategory] = useState(s.category);
  const [phone, setPhone] = useState(s.phone);
  const [note, setNote] = useState(s.note);
  const [err, setErr] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("suppliers").update({ name: name.trim(), category, phone: phone.trim(), note: note.trim() }).eq("id", s.id);
    if (error) return setErr(dbError(error));
    await reload(); onClose();
  }
  async function remove() {
    const { error } = await supabase.from("suppliers").delete().eq("id", s.id);
    if (error) return setErr(dbError(error));
    await reload(); onClose();
  }
  return (
    <Sheet onClose={onClose} label="Постачальник">
      <h2>{s.name}</h2>
      <form className="form" onSubmit={save}>
        <div className="fields">
          <Field label="Назва" htmlFor="s-name" wide><input id="s-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Звична категорія" htmlFor="s-cat">
            <select id="s-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">— немає —</option>
              {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Телефон" htmlFor="s-phone"><input id="s-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          <Field label="Нотатки" htmlFor="s-note" wide><input id="s-note" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>
        {err && <div className="error" role="alert">{err}</div>}
        <div className="row end">
          <ConfirmButton label="Видалити" onConfirm={remove} />
          <button type="button" className="btn ghost" onClick={onClose}>Скасувати</button>
          <button type="submit" className="btn primary">Зберегти</button>
        </div>
      </form>
    </Sheet>
  );
}

/* ---------- Користувачі ---------- */
function Users() {
  const { supabase, me } = useData();
  const [users, setUsers] = useState<Profile[]>([]);
  const [add, setAdd] = useState(false);
  const [msg, setMsg] = useState("");
  const load = () => supabase.from("profiles").select("*").order("created_at").then(({ data }) => setUsers((data as Profile[]) ?? []));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  async function patch(id: string, p: { role?: Role; active?: boolean }) {
    const r = await updateUser(id, p);
    setMsg(r.error ?? "");
    load();
  }

  return (
    <section className="card" aria-labelledby="h-users">
      <div className="sec-head">
        <h2 className="sec" id="h-users">Доступ до системи</h2>
        <button className="btn sm" onClick={() => setAdd(true)}>+ Користувач</button>
      </div>
      <p className="muted small" style={{ margin: 0 }}>Диспетчер бачить і змінює все, крім фірм і доступів. Бухгалтер бачить усе і вносить витрати.</p>
      <div className="list">
        {users.map((u) => (
          <div key={u.id} className="li">
            <span className="av" aria-hidden="true">{initials(u.full_name)}</span>
            <div className="li-main">
              <span className="li-title">{u.full_name}{u.id === me.id ? " (ви)" : ""}{!u.active ? " · заблоковано" : ""}</span>
              <span className="li-sub">{u.phone}</span>
            </div>
            <div className="li-end" style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <select aria-label={`Роль: ${u.full_name}`} value={u.role} disabled={u.id === me.id} onChange={(e) => patch(u.id, { role: e.target.value as Role })} style={{ width: "auto", minHeight: 34, padding: "4px 8px" }}>
                {(Object.keys(ROLE_NAME) as Role[]).map((r) => <option key={r} value={r}>{ROLE_NAME[r]}</option>)}
              </select>
              {u.id !== me.id && (
                <>
                  <PasswordButton id={u.id} onDone={setMsg} />
                  <button className="btn ghost sm" onClick={() => patch(u.id, { active: !u.active })}>{u.active ? "Заблокувати" : "Розблокувати"}</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      {msg && <div className={msg.startsWith("Пароль") ? "note" : "error"} role="status">{msg}</div>}
      {add && <UserSheet onClose={() => { setAdd(false); load(); }} />}
    </section>
  );
}

function PasswordButton({ id, onDone }: { id: string; onDone: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  if (!open) return <button className="btn ghost sm" onClick={() => setOpen(true)}>Пароль</button>;
  return (
    <form className="row" style={{ gap: 6 }} onSubmit={async (e) => {
      e.preventDefault();
      const r = await resetPassword(id, pw);
      onDone(r.error ?? "Пароль змінено. Передайте його людині особисто.");
      if (!r.error) { setOpen(false); setPw(""); }
    }}>
      <input aria-label="Новий пароль" type="text" autoComplete="new-password" placeholder="Новий пароль" value={pw} onChange={(e) => setPw(e.target.value)} style={{ width: 150, minHeight: 34, padding: "4px 8px" }} />
      <button className="btn sm" type="submit">OK</button>
    </form>
  );
}

function UserSheet({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("dispatcher");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await createUser({ email, password: pw, full_name: name, role, phone });
    setBusy(false);
    if (r.error) return setErr(r.error);
    onClose();
  }
  return (
    <Sheet onClose={onClose} label="Новий користувач">
      <h2>Новий користувач</h2>
      <form className="form" onSubmit={save}>
        <div className="fields">
          <Field label="Імʼя та прізвище" htmlFor="u-name" wide><input id="u-name" required value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Пошта для входу" htmlFor="u-email"><input id="u-email" type="email" required autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Телефон" htmlFor="u-phone"><input id="u-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          <Field label="Роль" htmlFor="u-role">
            <select id="u-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {(["dispatcher", "accountant", "owner"] as Role[]).map((r) => <option key={r} value={r}>{ROLE_NAME[r]}</option>)}
            </select>
          </Field>
          <Field label="Пароль" htmlFor="u-pw" hint="Не коротше 8 символів. Передайте особисто, не в загальний чат">
            <input id="u-pw" type="text" autoComplete="new-password" required value={pw} onChange={(e) => setPw(e.target.value)} />
          </Field>
        </div>
        {err && <div className="error" role="alert">{err}</div>}
        <div className="row end">
          <button type="button" className="btn ghost" onClick={onClose}>Скасувати</button>
          <button type="submit" className="btn primary" disabled={busy}>{busy ? "Створюю…" : "Створити"}</button>
        </div>
      </form>
    </Sheet>
  );
}
