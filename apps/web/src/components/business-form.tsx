"use client";

import { useActionState, useState } from "react";

import { type ActionState, createBusinessAction } from "@/app/actions";
import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";

export function BusinessForm() {
  const countries = {
    SA: {
      name: "Saudi Arabia",
      currency: "SAR",
      timeZone: "Asia/Riyadh",
      taxName: "VAT",
      taxRate: "15",
    },
    AE: {
      name: "United Arab Emirates",
      currency: "AED",
      timeZone: "Asia/Dubai",
      taxName: "VAT",
      taxRate: "5",
    },
    IN: { name: "India", currency: "INR", timeZone: "Asia/Kolkata", taxName: "GST", taxRate: "18" },
    QA: { name: "Qatar", currency: "QAR", timeZone: "Asia/Qatar", taxName: "Tax", taxRate: "0" },
    BH: {
      name: "Bahrain",
      currency: "BHD",
      timeZone: "Asia/Bahrain",
      taxName: "VAT",
      taxRate: "10",
    },
    KW: { name: "Kuwait", currency: "KWD", timeZone: "Asia/Kuwait", taxName: "Tax", taxRate: "0" },
    OM: { name: "Oman", currency: "OMR", timeZone: "Asia/Muscat", taxName: "VAT", taxRate: "5" },
    GB: {
      name: "United Kingdom",
      currency: "GBP",
      timeZone: "Europe/London",
      taxName: "VAT",
      taxRate: "20",
    },
    US: {
      name: "United States",
      currency: "USD",
      timeZone: "America/New_York",
      taxName: "Tax",
      taxRate: "0",
    },
  } as const;

  const [country, setCountry] = useState<keyof typeof countries>("SA");
  const defaults = countries[country];
  const [state, formAction] = useActionState<ActionState, FormData>(createBusinessAction, {});

  return (
    <form action={formAction} className="form-stack">
      <ActionMessage error={state.error} />
      <label className="field">
        <span>Business name</span>
        <input name="name" required minLength={2} autoFocus placeholder="Acme Services" />
        <small>This is the business or agency name customers will see.</small>
      </label>
      <div className="field-grid">
        <label className="field">
          <span>Country</span>
          <select
            name="countryCode"
            value={country}
            onChange={(event) => setCountry(event.target.value as keyof typeof countries)}
          >
            {Object.entries(countries).map(([code, c]) => (
              <option key={code} value={code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Currency</span>
          <select name="baseCurrency" key={defaults.currency} defaultValue={defaults.currency}>
            <option value="SAR">SAR — Saudi Riyal</option>
            <option value="AED">AED — UAE Dirham</option>
            <option value="INR">INR — Indian Rupee</option>
            <option value="QAR">QAR — Qatari Riyal</option>
            <option value="BHD">BHD — Bahraini Dinar</option>
            <option value="KWD">KWD — Kuwaiti Dinar</option>
            <option value="OMR">OMR — Omani Rial</option>
            <option value="GBP">GBP — British Pound</option>
            <option value="USD">USD — US Dollar</option>
          </select>
        </label>
      </div>
      <input type="hidden" name="timeZone" value={defaults.timeZone} />
      <input type="hidden" name="taxName" value={defaults.taxName} />
      <input type="hidden" name="taxRatePercent" value={defaults.taxRate} />
      <label className="check-field">
        <input
          key={country}
          name="taxEnabled"
          type="checkbox"
          defaultChecked={Number(defaults.taxRate) > 0}
        />
        <span>
          <strong>
            {Number(defaults.taxRate) > 0
              ? `Add ${defaults.taxRate}% ${defaults.taxName} to new quotation lines`
              : "Add tax to new quotation lines"}
          </strong>
          <small>You can change this later in Settings.</small>
        </span>
      </label>
      <SubmitButton pendingText="Creating business…">Create business</SubmitButton>
    </form>
  );
}
