"use client";

import { Check, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type CountryCode = "SA" | "AE" | "IN";
type BillingCycle = "monthly" | "annual";

interface PlanTier {
  id: string;
  name: string;
  badge?: string;
  highlighted?: boolean;
  description: string;
  intendedCustomer: string;
  price: Record<CountryCode, { monthly: number; annual: number; currency: string; symbol: string }>;
  features: Array<string | { label: string; beta: true }>;
}

const PLANS: PlanTier[] = [
  {
    id: "trial",
    name: "Free Trial",
    description: "Try all bizOS capabilities with sample data or live proofing.",
    intendedCustomer: "Any new business getting started",
    price: {
      SA: { monthly: 0, annual: 0, currency: "SAR", symbol: "SAR" },
      AE: { monthly: 0, annual: 0, currency: "AED", symbol: "AED" },
      IN: { monthly: 0, annual: 0, currency: "INR", symbol: "₹" },
    },
    features: [
      "30-day full access",
      "One business workspace",
      "Quotations & compliant invoices",
      "Professional PDF generation",
      "No payment method required",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    description: "Essential ERP foundations for micro businesses and independent operators.",
    intendedCustomer: "Freelancers, micro agencies, and small practices",
    price: {
      SA: { monthly: 79, annual: 63, currency: "SAR", symbol: "SAR" },
      AE: { monthly: 79, annual: 63, currency: "AED", symbol: "AED" },
      IN: { monthly: 699, annual: 559, currency: "INR", symbol: "₹" },
    },
    features: [
      "One business entity",
      "Up to 2 team members",
      "100 business documents / month",
      "Customers & quotations",
      "Invoices & payment recording",
      // Beta until MMF-1 is verified against real data in a deployed environment.
      // See docs/mmf.md, "Claim readiness".
      { label: "Customer statements & ledger views", beta: true },
      "Standard email support",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    badge: "Most popular",
    highlighted: true,
    description: "Full document workflow, customer PO approvals, and procurement.",
    intendedCustomer: "Small service, contracting, and trading companies",
    price: {
      SA: { monthly: 169, annual: 135, currency: "SAR", symbol: "SAR" },
      AE: { monthly: 149, annual: 119, currency: "AED", symbol: "AED" },
      IN: { monthly: 1499, annual: 1199, currency: "INR", symbol: "₹" },
    },
    features: [
      "One business entity",
      "Up to 5 team members",
      "500 business documents / month",
      "Customer PO & approval evidence",
      "Supplier purchasing & supplier bills",
      "Delivery notes & service completion",
      // Phase 1 QR + unsigned UBL ship; Fatoora clearance does not. See pricing FAQ.
      { label: "ZATCA QR & UBL export · country tax summaries", beta: true },
      "Role-based permission controls",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    description: "Advanced packs, multi-business governance, and high-volume operations.",
    intendedCustomer: "Growing businesses with demanding workflows",
    price: {
      SA: { monthly: 349, annual: 279, currency: "SAR", symbol: "SAR" },
      AE: { monthly: 299, annual: 239, currency: "AED", symbol: "AED" },
      IN: { monthly: 2999, annual: 2399, currency: "INR", symbol: "₹" },
    },
    features: [
      "Multi-business administration",
      "Up to 10 team members",
      "2,000 business documents / month",
      "Governed custom fields & workflows",
      "Advanced document templates",
      { label: "API keys & signed webhook triggers", beta: true },
      "Priority assistance",
    ],
  },
];

const COUNTRIES: Array<{ code: CountryCode; label: string; flag: string }> = [
  { code: "SA", label: "Saudi Arabia (SAR)", flag: "🇸🇦" },
  { code: "AE", label: "United Arab Emirates (AED)", flag: "🇦🇪" },
  { code: "IN", label: "India (INR)", flag: "🇮🇳" },
];

export function PricingTable() {
  const [country, setCountry] = useState<CountryCode>("SA");
  const [cycle, setCycle] = useState<BillingCycle>("annual");

  return (
    <div className="pricing-container">
      <div className="pricing-controls">
        <div className="country-selector" role="group" aria-label="Select Country">
          {COUNTRIES.map((c) => (
            <button
              key={c.code}
              type="button"
              className={`country-btn ${country === c.code ? "active" : ""}`}
              onClick={() => setCountry(c.code)}
            >
              <span>{c.flag}</span>
              <span>{c.label}</span>
            </button>
          ))}
        </div>

        <div className="billing-cycle-toggle" role="group" aria-label="Billing cycle">
          <button
            type="button"
            className={`cycle-btn ${cycle === "monthly" ? "active" : ""}`}
            onClick={() => setCycle("monthly")}
          >
            Monthly billing
          </button>
          <button
            type="button"
            className={`cycle-btn ${cycle === "annual" ? "active" : ""}`}
            onClick={() => setCycle("annual")}
          >
            Annual billing
            <span className="discount-tag">Save 20%</span>
          </button>
        </div>
      </div>

      <div className="pricing-grid">
        {PLANS.map((plan) => {
          const pricing = plan.price[country];
          const displayPrice = cycle === "annual" ? pricing.annual : pricing.monthly;

          return (
            <div
              key={plan.id}
              className={`pricing-card ${plan.highlighted ? "pricing-card-highlighted" : ""}`}
            >
              {plan.badge && (
                <div className="pricing-badge">
                  <Sparkles size={14} aria-hidden="true" />
                  <span>{plan.badge}</span>
                </div>
              )}

              <div className="pricing-card-header">
                <h3>{plan.name}</h3>
                <p className="plan-desc">{plan.description}</p>
                <div className="plan-audience">
                  <span className="audience-label">Best for:</span> {plan.intendedCustomer}
                </div>
              </div>

              <div className="pricing-card-price">
                <div className="price-amount">
                  <span className="currency-symbol">{pricing.symbol}</span>
                  <span className="amount-number">{displayPrice}</span>
                  <span className="per-period">/ mo</span>
                </div>
                <div className="billing-note">
                  {plan.id === "trial"
                    ? "No credit card needed"
                    : cycle === "annual"
                      ? "Billed annually"
                      : "Billed monthly"}
                </div>
              </div>

              <div className="pricing-card-cta">
                <Link
                  href={
                    plan.id === "trial" ? "/signup" : `/signup?plan=${plan.id}&country=${country}`
                  }
                  className={`button ${plan.highlighted ? "button-primary" : "button-secondary"} button-full`}
                >
                  {plan.id === "trial"
                    ? "Start 30-day free trial"
                    : `Start free · ${plan.name} list`}
                </Link>
              </div>

              <div className="pricing-features">
                <div className="features-title">What&apos;s included:</div>
                <ul className="features-list">
                  {plan.features.map((feature, idx) => {
                    const label = typeof feature === "string" ? feature : feature.label;
                    const beta = typeof feature !== "string";
                    return (
                      <li key={idx}>
                        <Check className="feature-check" size={16} aria-hidden="true" />
                        <span>
                          {label}
                          {beta ? <span className="feature-beta"> — beta</span> : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      <p className="pricing-beta-note">
        Features marked <strong>beta</strong> are built and usable, but have not yet been verified
        against real business data in a deployed environment — or, for compliance exports, do not
        yet include regulator clearance. Seat and document numbers are published list terms;
        automated enforcement is not live yet and will arrive with advance notice. Paid self-serve
        checkout today is via <a href="/subscribe">Subscribe (Qloudi Pro)</a>; list tiers activate
        through trial signup and support.
      </p>
    </div>
  );
}
