import type { PaidBy, PayScheme, Role, VehicleKind, VehicleStatus } from "./types";

export const ROLE_NAME: Record<Role, string> = {
  owner: "Власник",
  dispatcher: "Диспетчер",
  accountant: "Бухгалтер",
  driver: "Водій",
};

export const KIND_NAME: Record<VehicleKind, string> = { tractor: "Тягач", trailer: "Причіп" };

export const STATUS_NAME: Record<VehicleStatus, string> = { free: "Вільна", trip: "У рейсі", repair: "На ремонті" };

export const BODY_TYPES = ["Тент", "Реф", "Ізотерм", "Контейнеровоз", "Самоскид", "Цистерна", "Платформа", "Мега", "Інше"];

export const PAY_SCHEME_NAME: Record<PayScheme, string> = {
  percent: "Відсоток від фрахту",
  percent_daily: "Відсоток + добові",
  salary: "Ставка на місяць",
  per_trip: "Фіксована сума за рейс",
};

export const FIRM_KIND_NAME = { fop: "ФОП", tov: "ТОВ", pp: "ПП", other: "Інше" } as const;
export const TAX_MODE_NAME = {
  fop3: "ФОП 3 група, без ПДВ",
  vat: "Платник ПДВ",
  no_vat: "Без ПДВ",
  other: "Інше",
} as const;

export const CURRENCIES = ["UAH", "EUR", "USD", "PLN"];
export const CUR_SIGN: Record<string, string> = { UAH: "грн", EUR: "€", USD: "$", PLN: "zł" };

/** До чого належить документ: vehicle — машина (any), tractor/trailer — лише такий тип, driver, firm */
type Scope = "vehicle" | "tractor" | "trailer" | "driver" | "firm";
export type DocType = { key: string; label: string; scope: Scope[]; hint?: string };

/** Типові документи з термінами. «other» — своя назва. */
export const DOC_TYPES: DocType[] = [
  { key: "oscpv", label: "ОСЦПВ (автоцивілка)", scope: ["vehicle"] },
  { key: "green_card", label: "Зелена карта", scope: ["vehicle"] },
  { key: "kasko", label: "КАСКО", scope: ["vehicle"] },
  { key: "inspection", label: "Техогляд (ОТК)", scope: ["vehicle"] },
  { key: "tacho", label: "Перевірка тахографа", scope: ["tractor"], hint: "Раз на 2 роки" },
  { key: "license_card", label: "Ліцензійна картка", scope: ["tractor"] },
  { key: "ecmt", label: "Дозвіл ЄКМТ", scope: ["tractor"] },
  { key: "adr_vehicle", label: "Свідоцтво ADR", scope: ["vehicle"] },
  { key: "cmr_insurance", label: "CMR-страхування", scope: ["firm", "vehicle"] },
  { key: "license", label: "Ліцензія перевізника", scope: ["firm"] },
  { key: "driver_license", label: "Посвідчення водія", scope: ["driver"] },
  { key: "tacho_card", label: "Картка водія (тахограф)", scope: ["driver"] },
  { key: "medical", label: "Медична довідка", scope: ["driver"] },
  { key: "code95", label: "Код 95", scope: ["driver"] },
  { key: "adr_driver", label: "ADR-свідоцтво водія", scope: ["driver"] },
  { key: "passport", label: "Закордонний паспорт", scope: ["driver"] },
  { key: "visa", label: "Віза / дозвіл на роботу", scope: ["driver"] },
  { key: "other", label: "Інший документ", scope: ["vehicle", "tractor", "trailer", "driver", "firm"] },
];

export function docTypesFor(subject: "tractor" | "trailer" | "driver" | "firm") {
  return DOC_TYPES.filter((d) =>
    d.scope.includes(subject) || ((subject === "tractor" || subject === "trailer") && d.scope.includes("vehicle")));
}
export function docLabel(key: string, title?: string) {
  if (key === "other") return title?.trim() || "Інший документ";
  return DOC_TYPES.find((d) => d.key === key)?.label ?? key;
}

/** Категорії витрат */
export type Category = { key: string; label: string; icon: string; attach: "trip" | "vehicle" | "driver" | "any"; mileage?: boolean };
export const CATEGORIES: Category[] = [
  { key: "fuel", label: "Пальне", icon: "⛽", attach: "trip" },
  { key: "adblue", label: "AdBlue", icon: "💧", attach: "trip" },
  { key: "roads", label: "Дороги й віньєтки", icon: "🛣", attach: "trip" },
  { key: "fines", label: "Штрафи", icon: "🚨", attach: "trip" },
  { key: "parking", label: "Стоянки й мийки", icon: "🅿", attach: "trip" },
  { key: "tires", label: "Колеса", icon: "🛞", attach: "vehicle", mileage: true },
  { key: "parts", label: "Запчастини й ремонт", icon: "🔧", attach: "vehicle", mileage: true },
  { key: "service", label: "ТО й масло", icon: "🛢", attach: "vehicle", mileage: true },
  { key: "docs", label: "Документи й страховки", icon: "📄", attach: "vehicle" },
  { key: "driver", label: "Витрати водія", icon: "👤", attach: "driver" },
  { key: "daily", label: "Добові", icon: "🗓", attach: "driver" },
  { key: "other", label: "Інше", icon: "•", attach: "any" },
];
export const catLabel = (k: string) => CATEGORIES.find((c) => c.key === k)?.label ?? k;
export const catIcon = (k: string) => CATEGORIES.find((c) => c.key === k)?.icon ?? "•";

export const PAID_BY_NAME: Record<PaidBy, string> = {
  firm: "З рахунку фірми",
  cash: "Готівка офісу",
  driver: "Водій зі своїх",
  fuel_card: "Паливна картка",
};

/** За скільки днів попереджати про кінець терміну */
export const WARN_DAYS = 30;
export const URGENT_DAYS = 7;
