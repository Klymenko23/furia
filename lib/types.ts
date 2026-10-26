export type Role = "owner" | "dispatcher" | "accountant" | "driver";

export type Profile = {
  id: string;
  full_name: string;
  role: Role;
  phone: string;
  active: boolean;
  created_at: string;
};

export type Firm = {
  id: string;
  name: string;
  kind: "fop" | "tov" | "pp" | "other";
  tax_mode: "fop3" | "vat" | "no_vat" | "other";
  fee_percent: number;
  code: string;
  iban: string;
  note: string;
  archived: boolean;
};

export type VehicleKind = "tractor" | "trailer";
export type VehicleStatus = "free" | "trip" | "repair";

export type Vehicle = {
  id: string;
  kind: VehicleKind;
  plate: string;
  make: string;
  model: string;
  year: number | null;
  vin: string;
  body_type: string;
  volume_m3: number | null;
  capacity_t: number | null;
  firm_id: string | null;
  default_trailer_id: string | null;
  status: VehicleStatus;
  mileage: number | null;
  wialon_unit: string;
  note: string;
  archived: boolean;
  created_at: string;
};

export type PayScheme = "percent" | "percent_daily" | "salary" | "per_trip";

export type Driver = {
  id: string;
  full_name: string;
  phone: string;
  messenger: string;
  default_tractor_id: string | null;
  pay_scheme: PayScheme;
  pay_percent: number | null;
  salary: number | null;
  salary_currency: string;
  note: string;
  archived: boolean;
  created_at: string;
};

export type Doc = {
  id: string;
  vehicle_id: string | null;
  driver_id: string | null;
  firm_id: string | null;
  doc_type: string;
  title: string;
  number: string;
  expires_on: string | null;
  note: string;
  created_at: string;
};

export type Supplier = {
  id: string;
  name: string;
  category: string;
  phone: string;
  note: string;
};

export type PaidBy = "firm" | "cash" | "driver" | "fuel_card";

export type Expense = {
  id: string;
  spent_on: string;
  amount: number;
  currency: string;
  category: string;
  supplier_id: string | null;
  vehicle_id: string | null;
  driver_id: string | null;
  trip_id: string | null;
  paid_by: PaidBy;
  mileage: number | null;
  note: string;
  created_by: string | null;
  created_at: string;
};

export type DailyRate = { country: string; amount: number; currency: string };

export type Client = {
  id: string;
  name: string;
  contact: string;
  phone: string;
  channel: string;
  directions: string;
  payment_days: number | null;
  note: string;
};

export type Stage = "request" | "loading" | "transit" | "customs" | "unloading" | "docs" | "invoiced" | "originals" | "awaiting" | "paid" | "cancelled";

export type Stop = { kind: "load" | "unload"; place: string; country: string; date: string; address?: string; note?: string };

export type Trip = {
  id: string;
  number: number;
  client_id: string | null;
  client_ref: string;
  stage: Stage;
  stops: Stop[];
  cargo: string;
  weight_t: number | null;
  pallets: string;
  customs_export: string;
  customs_import: string;
  border: string;
  via_poland: boolean;
  rmpd_number: string;
  tractor_id: string | null;
  trailer_id: string | null;
  driver_id: string | null;
  freight: number | null;
  currency: string;
  firm_id: string | null;
  payment_form: "bank" | "cash" | "card";
  vat: boolean;
  payment_days: number | null;
  driver_pay: number | null;
  driver_pay_currency: string;
  daily_country: string;
  driver_advance: number | null;
  driver_advance_currency: string;
  km: number | null;
  docs_received_on: string | null;
  invoice_sent_on: string | null;
  tax_invoice_done: boolean;
  originals_sent_on: string | null;
  originals_tracking: string;
  originals_received_on: string | null;
  paid_on: string | null;
  paid_amount: number | null;
  note: string;
  created_at: string;
  updated_at: string;
};
