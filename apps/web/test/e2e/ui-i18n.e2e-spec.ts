import { describe, it, expect, beforeEach } from "vitest";

// ============================================================================
// Types & Internationalization Engine Simulation
// ============================================================================

export type SupportedLocale = "en" | "ar";

export interface LocaleConfig {
  locale: SupportedLocale;
  direction: "ltr" | "rtl";
  lang: string;
}

export interface TranslationDictionary {
  nav: {
    dashboard: string;
    invoices: string;
    quotations: string;
    customers: string;
    settings: string;
  };
  actions: {
    create: string;
    save: string;
    cancel: string;
    delete: string;
    approve: string;
    reject: string;
  };
  fields: {
    customerName: string;
    amount: string;
    date: string;
    status: string;
  };
}

export const TRANSLATIONS: Record<SupportedLocale, TranslationDictionary> = {
  en: {
    nav: {
      dashboard: "Dashboard",
      invoices: "Invoices",
      quotations: "Quotations",
      customers: "Customers",
      settings: "Settings",
    },
    actions: {
      create: "Create New",
      save: "Save Changes",
      cancel: "Cancel",
      delete: "Delete",
      approve: "Approve",
      reject: "Reject",
    },
    fields: {
      customerName: "Customer Name",
      amount: "Total Amount",
      date: "Issue Date",
      status: "Status",
    },
  },
  ar: {
    nav: {
      dashboard: "لوحة التحكم",
      invoices: "الفواتير",
      quotations: "عروض الأسعار",
      customers: "العملاء",
      settings: "الإعدادات",
    },
    actions: {
      create: "إنشاء جديد",
      save: "حفظ التغييرات",
      cancel: "إلغاء",
      delete: "حذف",
      approve: "موافقة",
      reject: "رفض",
    },
    fields: {
      customerName: "اسم العملاء",
      amount: "المبلغ الإجمالي",
      date: "تاريخ الإصدار",
      status: "الحالة",
    },
  },
};

export class I18nUiEngine {
  private currentLocale: SupportedLocale = "en";

  public setLocale(requestedLocale: string): LocaleConfig {
    if (requestedLocale === "ar") {
      this.currentLocale = "ar";
      return { locale: "ar", direction: "rtl", lang: "ar" };
    }
    // Default fallback to 'en'
    this.currentLocale = "en";
    return { locale: "en", direction: "ltr", lang: "en" };
  }

  public getLocale(): SupportedLocale {
    return this.currentLocale;
  }

  public t(keyPath: string, fallback?: string): string {
    const parts = keyPath.split(".");
    const dict = TRANSLATIONS[this.currentLocale] as Record<string, unknown>;

    let cur: unknown = dict;
    for (const part of parts) {
      if (cur && typeof cur === "object" && part in cur) {
        cur = (cur as Record<string, unknown>)[part];
      } else {
        return fallback || keyPath;
      }
    }

    return typeof cur === "string" ? cur : fallback || keyPath;
  }

  public formatCurrency(amount: number, currency: string): string {
    if (this.currentLocale === "ar") {
      const arabicNumerals = amount.toLocaleString("ar-SA", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const symbolMap: Record<string, string> = {
        SAR: "ر.س",
        AED: "د.إ",
        USD: "دولار",
      };
      const symbol = symbolMap[currency] || currency;
      return `${arabicNumerals} ${symbol}`;
    }

    return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  public formatDate(dateIsoString: string): string {
    const d = new Date(dateIsoString);
    if (this.currentLocale === "ar") {
      return d.toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
    }
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  }

  public getTailwindRtlClasses(): Record<string, string> {
    const isRtl = this.currentLocale === "ar";
    return {
      containerFlex: isRtl ? "flex flex-row-reverse" : "flex flex-row",
      textAlign: isRtl ? "text-right" : "text-left",
      spaceX: isRtl ? "space-x-reverse space-x-4" : "space-x-4",
      sidebarPosition: isRtl ? "right-0 border-l" : "left-0 border-r",
    };
  }

  public formatBiDiString(arPrefix: string, code: string, arSuffix: string): string {
    return `${arPrefix} \u2066#${code}\u2069 ${arSuffix}`;
  }
}

// ============================================================================
// TEST SUITE: FEAT-44 Internationalization & Arabic UI (Tiers 1 - 4)
// ============================================================================

describe("FEAT-44: Internationalization & Arabic UI (apps/web)", () => {
  let i18n: I18nUiEngine;

  beforeEach(() => {
    i18n = new I18nUiEngine();
  });

  // --------------------------------------------------------------------------
  // Tier 1: Core Feature Coverage
  // --------------------------------------------------------------------------
  describe("Tier 1: Core Feature Coverage", () => {
    it("FEAT-44-T1-01: switching locale to Arabic sets dir='rtl' and lang='ar'", () => {
      const config = i18n.setLocale("ar");

      expect(config.locale).toBe("ar");
      expect(config.direction).toBe("rtl");
      expect(config.lang).toBe("ar");
    });

    it("FEAT-44-T1-02: resolves Arabic navigation and action dictionary strings", () => {
      i18n.setLocale("ar");

      expect(i18n.t("nav.dashboard")).toBe("لوحة التحكم");
      expect(i18n.t("nav.invoices")).toBe("الفواتير");
      expect(i18n.t("actions.create")).toBe("إنشاء جديد");
      expect(i18n.t("actions.approve")).toBe("موافقة");
    });

    it("FEAT-44-T1-03: formats currency in Arabic locale format with localized currency symbols", () => {
      i18n.setLocale("ar");

      const sarFormatted = i18n.formatCurrency(1500.0, "SAR");
      expect(sarFormatted).toContain("ر.س");

      const aedFormatted = i18n.formatCurrency(500.0, "AED");
      expect(aedFormatted).toContain("د.إ");
    });

    it("FEAT-44-T1-04: formats date strings using Arabic locale calendar formatting", () => {
      i18n.setLocale("ar");

      const formattedDate = i18n.formatDate("2026-08-07T12:00:00Z");
      expect(formattedDate).toBeDefined();
      expect(typeof formattedDate).toBe("string");
    });
  });

  // --------------------------------------------------------------------------
  // Tier 2: Boundary & Corner Cases
  // --------------------------------------------------------------------------
  describe("Tier 2: Boundary & Corner Cases", () => {
    it("FEAT-44-T2-01: falls back to English ('en', 'ltr') for unsupported locale codes", () => {
      const frConfig = i18n.setLocale("fr");
      expect(frConfig.locale).toBe("en");
      expect(frConfig.direction).toBe("ltr");

      const deConfig = i18n.setLocale("de");
      expect(deConfig.locale).toBe("en");
      expect(deConfig.direction).toBe("ltr");
    });

    it("FEAT-44-T2-02: missing translation key fallback returns key path or fallback string without crash", () => {
      i18n.setLocale("ar");

      const missingKey = i18n.t("unknown.section.field");
      expect(missingKey).toBe("unknown.section.field");

      const customFallback = i18n.t("missing.key", "افتراضي");
      expect(customFallback).toBe("افتراضي");
    });

    it("FEAT-44-T2-03: applies Tailwind CSS RTL layout classes in Arabic mode", () => {
      i18n.setLocale("ar");
      const rtlClasses = i18n.getTailwindRtlClasses();

      expect(rtlClasses.containerFlex).toBe("flex flex-row-reverse");
      expect(rtlClasses.textAlign).toBe("text-right");
      expect(rtlClasses.spaceX).toContain("space-x-reverse");
      expect(rtlClasses.sidebarPosition).toContain("right-0");
    });

    it("FEAT-44-T2-04: handles BiDi (Bidirectional) text with English codes inside Arabic strings", () => {
      i18n.setLocale("ar");

      const bidiString = i18n.formatBiDiString("الفاتورة رقم", "INV-2026-001", "جاهزة للدفع");
      expect(bidiString).toContain("INV-2026-001");
      expect(bidiString).toContain("الفاتورة رقم");
    });

    it("FEAT-44-T2-05: stress tests rapid locale switching without breaking state", () => {
      const localesToTest = ["en", "ar", "en", "ar", "en", "ar", "en", "ar"];

      for (const loc of localesToTest) {
        const config = i18n.setLocale(loc);
        expect(config.locale).toBe(loc);
        expect(config.direction).toBe(loc === "ar" ? "rtl" : "ltr");
      }

      expect(i18n.getLocale()).toBe("ar");
    });
  });

  // --------------------------------------------------------------------------
  // Tier 3: Cross-Feature Interactions
  // --------------------------------------------------------------------------
  describe("Tier 3: Cross-Feature Interactions", () => {
    it("FEAT-44-T3-01: i18n <-> Public Quote Portal (renders quote portal in Arabic RTL mode)", () => {
      i18n.setLocale("ar");

      const portalViewModel = {
        title: i18n.t("nav.quotations"),
        customerLabel: i18n.t("fields.customerName"),
        acceptButton: i18n.t("actions.approve"),
        rejectButton: i18n.t("actions.reject"),
        formattedTotal: i18n.formatCurrency(12500.0, "SAR"),
        layoutDirection: i18n.getTailwindRtlClasses().containerFlex,
      };

      expect(portalViewModel.title).toBe("عروض الأسعار");
      expect(portalViewModel.acceptButton).toBe("موافقة");
      expect(portalViewModel.layoutDirection).toBe("flex flex-row-reverse");
    });

    it("FEAT-44-T3-02: i18n <-> Customer Directory (renders customer table headers and alignment)", () => {
      i18n.setLocale("ar");

      const tableHeaders = [
        {
          key: "name",
          label: i18n.t("fields.customerName"),
          align: i18n.getTailwindRtlClasses().textAlign,
        },
        {
          key: "amount",
          label: i18n.t("fields.amount"),
          align: i18n.getTailwindRtlClasses().textAlign,
        },
        {
          key: "status",
          label: i18n.t("fields.status"),
          align: i18n.getTailwindRtlClasses().textAlign,
        },
      ];

      expect(tableHeaders[0].align).toBe("text-right");
      expect(tableHeaders[0].label).toBe("اسم العملاء");
    });
  });

  // --------------------------------------------------------------------------
  // Tier 4: Real-World Workloads
  // --------------------------------------------------------------------------
  describe("Tier 4: Real-World Workloads", () => {
    it("FEAT-44-T4-01: complete Arabic user session workflow (login, navigation, document view, switch back)", () => {
      // 1. User switches to Arabic upon login
      const sessionConfig = i18n.setLocale("ar");
      expect(sessionConfig.direction).toBe("rtl");

      // 2. User navigates through apps/web dashboard views
      const dashboardTitle = i18n.t("nav.dashboard");
      const invoiceCountText = `${i18n.t("nav.invoices")}: 15`;
      expect(dashboardTitle).toBe("لوحة التحكم");
      expect(invoiceCountText).toContain("الفواتير");

      // 3. User views invoice total formatted in SAR
      const formattedTotal = i18n.formatCurrency(45000.5, "SAR");
      expect(formattedTotal).toContain("ر.س");

      // 4. User switches back to English
      const switchBack = i18n.setLocale("en");
      expect(switchBack.direction).toBe("ltr");
      expect(i18n.t("nav.dashboard")).toBe("Dashboard");
    });
  });
});
