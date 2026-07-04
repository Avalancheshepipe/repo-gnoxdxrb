"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@heroui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm, type FieldErrors } from "react-hook-form";
import { z } from "zod";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/components/providers/i18n-provider";
import { authClient } from "@/lib/auth-client";

type Mode = "sign-in" | "sign-up";

type AuthFormValues = {
  name?: string;
  email: string;
  password: string;
  confirmPassword?: string;
};

function createSignInSchema(t: (key: string) => string) {
  return z.object({
    email: z
      .string()
      .min(1, t("auth.validation.emailRequired"))
      .email(t("auth.validation.emailInvalid")),
    password: z
      .string()
      .min(1, t("auth.validation.passwordRequired"))
      .min(8, t("auth.validation.passwordMin")),
  });
}

function createSignUpSchema(t: (key: string) => string) {
  return z
    .object({
      name: z.string().min(1, t("auth.validation.nameRequired")),
      email: z
        .string()
        .min(1, t("auth.validation.emailRequired"))
        .email(t("auth.validation.emailInvalid")),
      password: z
        .string()
        .min(1, t("auth.validation.passwordRequired"))
        .min(8, t("auth.validation.passwordMin")),
      confirmPassword: z.string().min(1, t("auth.validation.confirmRequired")),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("auth.validation.passwordMatch"),
      path: ["confirmPassword"],
    });
}

export function AuthForm({
  mode,
  redirectTo = "/app/inbox",
}: {
  mode: Mode;
  redirectTo?: string;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const isSignUp = mode === "sign-up";

  const schema = useMemo(
    () => (isSignUp ? createSignUpSchema(t) : createSignInSchema(t)),
    [isSignUp, t],
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AuthFormValues>({
    resolver: zodResolver(schema),
    defaultValues: isSignUp
      ? { name: "", email: "", password: "", confirmPassword: "" }
      : { email: "", password: "" },
  });

  const formErrors = errors as FieldErrors<AuthFormValues>;

  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(values: AuthFormValues) {
    if (loading) return;
    setServerError(null);
    setLoading(true);

    try {
      const res = isSignUp
        ? await authClient.signUp.email({
            name: values.name?.trim() || values.email.split("@")[0],
            email: values.email.trim(),
            password: values.password,
          })
        : await authClient.signIn.email({
            email: values.email.trim(),
            password: values.password,
          });

      if (res.error) {
        setServerError(res.error.message ?? t("auth.error.generic"));
        setLoading(false);
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setServerError(t("auth.error.server"));
      setLoading(false);
    }
  }

  const switchHref = isSignUp ? "/sign-in" : "/sign-up";
  const suffix =
    redirectTo && redirectTo !== "/app"
      ? `?redirect=${encodeURIComponent(redirectTo)}`
      : "";

  const titleKey = isSignUp ? "auth.signUp.title" : "auth.signIn.title";
  const subtitleKey = isSignUp ? "auth.signUp.subtitle" : "auth.signIn.subtitle";
  const ctaKey = isSignUp ? "auth.signUp.cta" : "auth.signIn.cta";
  const switchLabelKey = isSignUp ? "auth.switch.signUp.label" : "auth.switch.signIn.label";
  const switchCtaKey = isSignUp ? "auth.switch.signUp.cta" : "auth.switch.signIn.cta";

  return (
    <div className="julow-auth-shell relative min-h-dvh">
      <div className="julow-auth-bg pointer-events-none" aria-hidden>
        <div className="julow-auth-illustration__mesh" />
        <div className="julow-auth-illustration__grid" />
        <div className="julow-auth-orb julow-auth-orb--1" />
        <div className="julow-auth-orb julow-auth-orb--2" />
        <div className="julow-auth-orb julow-auth-orb--3" />
      </div>

      <header className="julow-auth-header relative z-10 flex items-center justify-between gap-4 px-6 py-5 md:px-10">
        <Logo href="/" size={36} showWordmark className="shrink-0" />
        <div className="flex shrink-0 items-center gap-2">
          <LanguageSwitcher compact />
          <ThemeToggle />
        </div>
      </header>

      <aside
        className="julow-auth-tagline pointer-events-none"
        aria-hidden
      >
        <p className="julow-auth-enter text-xs font-semibold uppercase tracking-[0.2em] text-julow-muted">
          {t("auth.illustration.tagline")}
        </p>
        <h2 className="julow-auth-enter julow-auth-enter--delay mt-3 max-w-md text-balance text-xl font-semibold leading-tight tracking-tight md:text-2xl lg:text-3xl">
          {t("auth.illustration.headline")}
        </h2>
      </aside>

      <main className="relative z-10 flex flex-1 items-center justify-center px-6 pb-8 pt-2 md:px-10 md:pb-12">
        <div className="julow-auth-form-enter glass-panel w-full max-w-md rounded-2xl p-6 md:p-8">
          <div className="mb-8 flex flex-col items-center text-center">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              {t(titleKey)}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-julow-muted md:text-base">
              {t(subtitleKey)}
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {isSignUp && (
              <div>
                <label htmlFor="name" className="julow-field-label">
                  {t("auth.field.name")}
                </label>
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  aria-invalid={!!formErrors.name}
                  aria-describedby={formErrors.name ? "name-error" : undefined}
                  placeholder={t("auth.placeholder.name")}
                  className={`julow-input ${formErrors.name ? "julow-input--error" : ""}`}
                  {...register("name")}
                />
                {formErrors.name && (
                  <p id="name-error" className="julow-field-error" role="alert">
                    {formErrors.name.message}
                  </p>
                )}
              </div>
            )}

            <div>
              <label htmlFor="email" className="julow-field-label">
                {t("auth.field.email")}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                aria-invalid={!!formErrors.email}
                aria-describedby={formErrors.email ? "email-error" : undefined}
                placeholder={t("auth.placeholder.email")}
                className={`julow-input ${formErrors.email ? "julow-input--error" : ""}`}
                {...register("email")}
              />
              {formErrors.email && (
                <p id="email-error" className="julow-field-error" role="alert">
                  {formErrors.email.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="julow-field-label">
                {t("auth.field.password")}
              </label>
              <input
                id="password"
                type="password"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                aria-invalid={!!formErrors.password}
                aria-describedby={formErrors.password ? "password-error" : undefined}
                placeholder={
                  isSignUp
                    ? t("auth.placeholder.passwordSignUp")
                    : t("auth.placeholder.passwordSignIn")
                }
                className={`julow-input ${formErrors.password ? "julow-input--error" : ""}`}
                {...register("password")}
              />
              {formErrors.password && (
                <p id="password-error" className="julow-field-error" role="alert">
                  {formErrors.password.message}
                </p>
              )}
            </div>

            {isSignUp && (
              <div>
                <label htmlFor="confirmPassword" className="julow-field-label">
                  {t("auth.field.confirmPassword")}
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={!!formErrors.confirmPassword}
                  aria-describedby={
                    formErrors.confirmPassword ? "confirm-password-error" : undefined
                  }
                  placeholder={t("auth.placeholder.passwordSignUp")}
                  className={`julow-input ${
                    formErrors.confirmPassword ? "julow-input--error" : ""
                  }`}
                  {...register("confirmPassword")}
                />
                {formErrors.confirmPassword && (
                  <p id="confirm-password-error" className="julow-field-error" role="alert">
                    {formErrors.confirmPassword.message}
                  </p>
                )}
              </div>
            )}

            {serverError && (
              <div
                className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger"
                role="alert"
              >
                {serverError}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              isDisabled={loading}
              className="mt-2"
            >
              {loading ? t("auth.loading") : t(ctaKey)}
              {!loading && <Icon icon={ArrowRight01Icon} size={18} />}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-julow-muted">
            {t(switchLabelKey)}{" "}
            <Link
              href={`${switchHref}${suffix}`}
              className="font-medium text-accent transition-colors hover:text-accent/80"
            >
              {t(switchCtaKey)}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
