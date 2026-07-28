"use client";

import { ArrowRight, FileText, Settings, Sparkles } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { type ActionState, applyDefaultConfigurationAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

export function SetupChoice({ businessId }: { businessId: string }) {
  const action = applyDefaultConfigurationAction.bind(null, businessId);
  const [, formAction] = useActionState<ActionState, FormData>(action, {});

  return (
    <div className="setup-page">
      <div className="setup-panel">
        <div className="page-heading compact">
          <span className="eyebrow">Almost there</span>
          <h1>How would you like to set up your workspace?</h1>
          <p>
            You can change everything later in Settings. Your workspace already has the Default
            bizOS ERP configuration ready to go.
          </p>
        </div>
        <div className="setup-choices">
          <form action={formAction} className="setup-choice">
            <div className="setup-choice-icon">
              <Sparkles aria-hidden="true" size={22} />
            </div>
            <div className="setup-choice-body">
              <h2>Use default bizOS ERP</h2>
              <p>Start with customers, quotations, purchase orders, and invoices ready to go.</p>
            </div>
            <SubmitButton pendingText="Setting up…">
              Use default
              <ArrowRight aria-hidden="true" size={16} />
            </SubmitButton>
          </form>

          <Link href={`/b/${businessId}/settings/setup`} className="setup-choice setup-choice-link">
            <div className="setup-choice-icon">
              <FileText aria-hidden="true" size={22} />
            </div>
            <div className="setup-choice-body">
              <h2>Customize my setup</h2>
              <p>Answer a few questions and we&apos;ll recommend the right configuration.</p>
            </div>
            <span className="setup-choice-cta">
              Customize
              <ArrowRight aria-hidden="true" size={16} />
            </span>
          </Link>

          <form action={formAction} className="setup-choice">
            <div className="setup-choice-icon">
              <Settings aria-hidden="true" size={22} />
            </div>
            <div className="setup-choice-body">
              <h2>Configure later</h2>
              <p>Use the default for now. You can run guided setup anytime from Settings.</p>
            </div>
            <SubmitButton pendingText="Setting up…" className="button button-quiet">
              Configure later
              <ArrowRight aria-hidden="true" size={16} />
            </SubmitButton>
          </form>
        </div>
      </div>
    </div>
  );
}
