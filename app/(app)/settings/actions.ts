"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

const ROLES: Role[] = ["owner", "dispatcher", "accountant", "driver"];

async function ownerId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("role, active").eq("id", user.id).single();
  return data?.role === "owner" && data.active ? user.id : null;
}

export async function createUser(input: { email: string; password: string; full_name: string; role: Role; phone?: string }) {
  if (!(await ownerId())) return { error: "Додавати користувачів може лише власник." };
  if (!ROLES.includes(input.role)) return { error: "Невідома роль." };
  if (input.password.length < 8) return { error: "Пароль має бути не коротший за 8 символів." };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { error: "На сервері не налаштований секретний ключ Supabase (SUPABASE_SERVICE_ROLE_KEY)." };
  const admin = createServiceClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.full_name.trim(), role: input.role },
  });
  if (error) {
    if (/already/i.test(error.message)) return { error: "Користувач з такою поштою вже існує." };
    return { error: "Не вдалося створити користувача: " + error.message };
  }
  if (data.user) {
    // роль ставимо явно: тригер робить власником лише першого користувача
    await admin.from("profiles").update({ role: input.role, phone: input.phone?.trim() ?? "" }).eq("id", data.user.id);
  }
  return { ok: true };
}

export async function updateUser(id: string, patch: { role?: Role; active?: boolean; full_name?: string; phone?: string }) {
  const me = await ownerId();
  if (!me) return { error: "Змінювати користувачів може лише власник." };
  if (id === me && (patch.active === false || (patch.role && patch.role !== "owner"))) {
    return { error: "Не можна заблокувати себе або забрати в себе роль власника." };
  }
  if (patch.role && !ROLES.includes(patch.role)) return { error: "Невідома роль." };
  const admin = createServiceClient();
  const { error } = await admin.from("profiles").update(patch).eq("id", id);
  if (error) return { error: "Не вдалося зберегти зміни." };
  if (patch.active !== undefined) {
    // заблокований користувач не зможе увійти
    await admin.auth.admin.updateUserById(id, { ban_duration: patch.active ? "none" : "876000h" });
  }
  return { ok: true };
}

export async function resetPassword(id: string, password: string) {
  if (!(await ownerId())) return { error: "Змінювати паролі може лише власник." };
  if (password.length < 8) return { error: "Пароль має бути не коротший за 8 символів." };
  const { error } = await createServiceClient().auth.admin.updateUserById(id, { password });
  if (error) return { error: "Не вдалося змінити пароль." };
  return { ok: true };
}
