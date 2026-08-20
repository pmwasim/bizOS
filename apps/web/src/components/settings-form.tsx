"use client";

import { useActionState } from "react";

import { type BusinessSettings } from "@bizo/contracts/platform";

import { type ActionState, updateSettingsAction } from "@/app/actions";
import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";

export function SettingsForm({
  businessId,
  settings,
}: {
  businessId: string;
  settings: BusinessSettings;
}) {
  const action = updateSettingsAction.bind(null, businessId);
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  return (
    <form action={formAction} className="settings-form">
      <ActionMessage error={state.error} />
      <section className="settings-section">
        <div>
          <h2>Business profile</h2>
          <p>Shown on your quotation.</p>
        </div>
        <div className="form-stack">
          <label className="field">
            <span>Business name</span>
            <input name="name" defaultValue={settings.name} required />
          </label>
          <label className="field">
            <span>
              Legal name <em>Optional</em>
            </span>
            <input name="legalName" defaultValue={settings.legalName ?? ""} />
          </label>
          <div className="field-grid">
            <label className="field">
              <span>
                Email <em>Optional</em>
              </span>
              <input name="email" type="email" defaultValue={settings.email ?? ""} />
            </label>
            <label className="field">
              <span>
                Phone <em>Optional</em>
              </span>
              <input name="phone" type="tel" defaultValue={settings.phone ?? ""} />
            </label>
          </div>
          <label className="field">
            <span>
              Address <em>Optional</em>
            </span>
            <input name="addressLine1" defaultValue={settings.addressLine1 ?? ""} />
          </label>
          <input type="hidden" name="addressLine2" value={settings.addressLine2 ?? ""} />
          <div className="field-grid">
            <label className="field">
              <span>
                City <em>Optional</em>
              </span>
              <input name="city" defaultValue={settings.city ?? ""} />
            </label>
            <label className="field">
              <span>
                Postal code <em>Optional</em>
              </span>
              <input name="postalCode" defaultValue={settings.postalCode ?? ""} />
            </label>
          </div>
        </div>
      </section>
      <section className="settings-section">
        <div>
          <h2>Quotation defaults</h2>
          <p>Applied automatically to new quotations.</p>
        </div>
        <div className="form-stack">
          <div className="field-grid">
            <label className="field">
              <span>Number prefix</span>
              <input name="quotationPrefix" defaultValue={settings.quotationPrefix} required />
            </label>
            <label className="field">
              <span>Valid for</span>
              <select
                name="quotationValidityDays"
                defaultValue={String(settings.quotationValidityDays)}
              >
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
                <option value="60">60 days</option>
                <option value="90">90 days</option>
              </select>
            </label>
          </div>
          <div className="field-grid">
            <label className="field">
              <span>Currency</span>
              <select name="baseCurrency" defaultValue={settings.baseCurrency}>
                <option value="SAR">SAR — Saudi Riyal</option>
                <option value="AED">AED — UAE Dirham</option>
                <option value="GBP">GBP — British Pound</option>
                <option value="USD">USD — US Dollar</option>
              </select>
            </label>
            <label className="field">
              <span>Time zone</span>
              <select name="timeZone" defaultValue={settings.timeZone}>
                <option value="Asia/Riyadh">Riyadh</option>
                <option value="Asia/Dubai">Dubai</option>
                <option value="Europe/London">London</option>
                <option value="America/New_York">New York</option>
              </select>
            </label>
          </div>
          <input type="hidden" name="currencyScale" value={settings.currencyScale} />
          <input type="hidden" name="locale" value={settings.locale} />
          <input type="hidden" name="countryCode" value={settings.countryCode} />
          <input type="hidden" name="defaultMessage" value={settings.defaultMessage ?? ""} />
        </div>
      </section>
      <section className="settings-section">
        <div>
          <h2>Document numbering</h2>
          <p>Prefixes and padding applied to new document numbers, e.g. INV-0001.</p>
        </div>
        <div className="form-stack">
          <div className="field-grid">
            <label className="field">
              <span>Invoice prefix</span>
              <input name="invoicePrefix" defaultValue={settings.invoicePrefix} required />
            </label>
            <label className="field">
              <span>Sales order prefix</span>
              <input name="salesOrderPrefix" defaultValue={settings.salesOrderPrefix} required />
            </label>
          </div>
          <div className="field-grid">
            <label className="field">
              <span>Delivery note prefix</span>
              <input
                name="deliveryNotePrefix"
                defaultValue={settings.deliveryNotePrefix}
                required
              />
            </label>
            <label className="field">
              <span>Credit note prefix</span>
              <input name="creditNotePrefix" defaultValue={settings.creditNotePrefix} required />
            </label>
          </div>
          <div className="field-grid">
            <label className="field">
              <span>Purchase order prefix</span>
              <input
                name="purchaseOrderPrefix"
                defaultValue={settings.purchaseOrderPrefix}
                required
              />
            </label>
            <label className="field">
              <span>Supplier bill prefix</span>
              <input
                name="supplierBillPrefix"
                defaultValue={settings.supplierBillPrefix}
                required
              />
            </label>
          </div>
          <div className="field-grid">
            <label className="field">
              <span>Payment prefix</span>
              <input name="paymentPrefix" defaultValue={settings.paymentPrefix} required />
            </label>
            <label className="field">
              <span>Number padding</span>
              <select name="numberPadWidth" defaultValue={String(settings.numberPadWidth)}>
                <option value="3">3 digits — 001</option>
                <option value="4">4 digits — 0001</option>
                <option value="5">5 digits — 00001</option>
                <option value="6">6 digits — 000001</option>
              </select>
            </label>
          </div>
          <input type="hidden" name="supplierPoPrefix" value={settings.supplierPoPrefix} />
        </div>
      </section>
      <section className="settings-section">
        <div>
          <h2>Tax</h2>
          <p>Use plain labels your customers recognize.</p>
        </div>
        <div className="form-stack">
          <label className="check-field">
            <input name="taxEnabled" type="checkbox" defaultChecked={settings.taxEnabled} />
            <span>
              <strong>Add tax to new quotation lines</strong>
            </span>
          </label>
          <div className="field-grid">
            <label className="field">
              <span>Tax name</span>
              <input name="taxName" defaultValue={settings.taxName} required />
            </label>
            <label className="field">
              <span>Default rate</span>
              <div className="suffix-input">
                <input name="taxRatePercent" defaultValue={settings.taxRatePercent} required />
                <span>%</span>
              </div>
            </label>
          </div>
          <label className="field">
            <span>
              Tax registration number <em>Optional</em>
            </span>
            <input
              name="taxRegistrationNumber"
              defaultValue={settings.taxRegistrationNumber ?? ""}
            />
          </label>
        </div>
      </section>
      <div className="settings-save">
        <SubmitButton pendingText="Saving changes…">Save changes</SubmitButton>
      </div>
    </form>
  );
}
