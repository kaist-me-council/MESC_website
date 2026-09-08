"use client";

import Link from "next/link";
import { NotificationToggle } from "@/components/notification-toggle";
import { Settings, MapPin, Mail, ExternalLink } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { FOOTER_FALLBACK, type FooterData } from "@/lib/site-settings";

/** 데이터는 서버(app/layout.tsx)에서 읽어 props 로 내려온다 — 페이지마다 API 를 호출하지 않는다. */
export default function Footer({ data = FOOTER_FALLBACK }: { data?: FooterData }) {
  const currentYear = new Date().getFullYear();
  const { t, lang } = useLanguage();

  const { contact, sns } = data;

  const quickLinks = [
    { label: t("navbar.notices"), href: "/notices" },
    { label: t("navbar.calendar"), href: "/calendar" },
    { label: t("navbar.checkFee"), href: "/check-fee" },
  ];

  const resourceLinks = [
    { label: t("navbar.resources"), href: "/resources", external: false },
    { label: t("navbar.members"), href: "/members", external: false },
    {
      label: lang === "ko" ? "학교 홈페이지" : "KAIST Website",
      href: "https://www.kaist.ac.kr/",
      external: true,
    },
    {
      label: lang === "ko" ? "학과 홈페이지" : "ME Dept.",
      href: "https://me.kaist.ac.kr/",
      external: true,
    },
  ];

  const contactInfo = [
    {
      icon: MapPin,
      label: lang === "ko" ? contact.locationKo : contact.locationEn,
      href: null,
    },
    {
      icon: Mail,
      label: contact.email,
      href: `mailto:${contact.email}`,
    },
  ];

  const snsLinks = sns.map((s) => ({
    label: lang === "ko" ? s.label : s.labelEn || s.label,
    href: s.url,
  }));

  const title = t("footer.title");
  const subtitle = lang === "ko" ? "KAIST Mechanical Engineering Student Council" : "KAIST 기계공학과 학생회";

  return (
    <footer className="border-t border-border/40 bg-muted/20 mt-auto">
      <div className="container mx-auto px-4 py-16">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-12 mb-12">
          {/* Brand Section */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary group-hover:rotate-12 transition-transform duration-300">
                <Settings className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-lg tracking-tight">{title}</p>
                <p className="text-xs text-muted-foreground font-medium">{subtitle}</p>
              </div>
            </div>
            <NotificationToggle />
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              {t("footer.description")}
            </p>
            {/* SNS Links */}
            <div className="flex flex-wrap gap-2 pt-2">
              {snsLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold px-3 py-1.5 rounded-full border border-border/60 text-muted-foreground hover:text-primary hover:border-primary/40 transition-all duration-300 flex items-center gap-1.5"
                >
                  <ExternalLink className="h-3 w-3" />
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="font-bold text-sm tracking-tight">{t("footer.quickServices")}</h4>
            <ul className="space-y-2.5">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors duration-300 flex items-center gap-2 group"
                  >
                    <span className="w-1 h-1 bg-border rounded-full group-hover:bg-primary transition-colors duration-300" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div className="space-y-4">
            <h4 className="font-bold text-sm tracking-tight">{t("footer.resources")}</h4>
            <ul className="space-y-2.5">
              {resourceLinks.map((link) => (
                <li key={link.href}>
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-primary transition-colors duration-300 flex items-center gap-2 group"
                    >
                      <span className="w-1 h-1 bg-border rounded-full group-hover:bg-primary transition-colors duration-300" />
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors duration-300 flex items-center gap-2 group"
                    >
                      <span className="w-1 h-1 bg-border rounded-full group-hover:bg-primary transition-colors duration-300" />
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h4 className="font-bold text-sm tracking-tight">{t("footer.contact")}</h4>
            <ul className="space-y-3">
              {contactInfo.map((info, idx) => {
                const Icon = info.icon;
                return (
                  <li key={idx}>
                    {info.href ? (
                      <a
                        href={info.href}
                        className="text-sm text-muted-foreground hover:text-primary transition-colors duration-300 flex items-start gap-2.5 group"
                      >
                        <Icon className="h-4 w-4 mt-0.5 text-primary/60 group-hover:text-primary transition-colors duration-300 shrink-0" />
                        <span>{info.label}</span>
                      </a>
                    ) : (
                      <div className="text-sm text-muted-foreground flex items-start gap-2.5">
                        <Icon className="h-4 w-4 mt-0.5 text-primary/60 shrink-0" />
                        <span>{info.label}</span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="section-divider mb-8" />

        {/* Bottom Footer */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-xs text-muted-foreground font-medium">
            {t("footer.copyright").replace("{year}", String(currentYear))}
          </p>
          <div className="flex items-center gap-6 text-xs">
            <Link
              href="/privacy"
              className="text-muted-foreground hover:text-primary transition-colors duration-300 font-medium"
            >
              {t("footer.privacy")}
            </Link>
            <div className="w-px h-3 bg-border/40" />
            <Link
              href="/terms"
              className="text-muted-foreground hover:text-primary transition-colors duration-300 font-medium"
            >
              {t("footer.terms")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
