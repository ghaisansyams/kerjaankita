"use server";

import { redirect } from "next/navigation";
import { signIn as nextAuthSignIn, signOut as nextAuthSignOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isDatabaseConfigured } from "@/lib/env";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "./schema";

export type AuthActionState = { error?: string; success?: string } | undefined;

const NOT_CONNECTED = {
  error: "Database isn't connected yet. Check DATABASE_URL in .env.local.",
};

function firstError(issues: { message: string }[]): string {
  return issues[0]?.message ?? "Please check the form and try again.";
}

export async function signIn(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isDatabaseConfigured) return NOT_CONNECTED;

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: firstError(parsed.error.issues) };

  const raw = (formData.get("redirectTo") as string) || "";
  const redirectTo =
    raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";

  try {
    await nextAuthSignIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "Invalid email or password." };
        default:
          return { error: "Something went wrong. Please try again." };
      }
    }
    // Next.js redirect() throws a NEXT_REDIRECT error which must be re-thrown
    throw error;
  }
}

export async function signUp(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isDatabaseConfigured) return NOT_CONNECTED;

  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: firstError(parsed.error.issues) };

  const email = parsed.data.email.toLowerCase().trim();

  // Check if profile with email already exists
  const existing = await prisma.profile.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, deletedAt: null },
  });
  if (existing) {
    return { error: "An account with this email already exists." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const profileId = crypto.randomUUID();

  await prisma.profile.create({
    data: {
      id: profileId,
      email,
      fullName: parsed.data.fullName,
      passwordHash,
      isActive: true,
    },
  });

  const raw = (formData.get("redirectTo") as string) || "";
  const redirectTo =
    raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";

  try {
    await nextAuthSignIn("credentials", {
      email,
      password: parsed.data.password,
      redirectTo,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Registered successfully! Please sign in." };
    }
    throw error;
  }
}

export async function signOut(): Promise<void> {
  await nextAuthSignOut({ redirectTo: "/login" });
}

export async function requestPasswordReset(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isDatabaseConfigured) return NOT_CONNECTED;

  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) return { error: firstError(parsed.error.issues) };

  return {
    success:
      "If an account exists for that email, password reset instructions will be sent.",
  };
}

export async function updatePassword(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isDatabaseConfigured) return NOT_CONNECTED;

  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: firstError(parsed.error.issues) };

  redirect("/login");
}
