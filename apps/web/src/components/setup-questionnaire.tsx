"use client";

import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import {
  type OnboardingAnswers,
  type OnboardingQuestion,
  type OnboardingQuestionnaire,
  type OnboardingRecommendation,
} from "@bizo/contracts/onboarding";

import { applyRecommendationAction, fetchRecommendation } from "@/app/actions";
import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";

interface SetupQuestionnaireProps {
  businessId: string;
  questionnaire: OnboardingQuestionnaire;
}

type Screen =
  | { kind: "questions"; stepIndex: number }
  | { kind: "review"; recommendation: OnboardingRecommendation };

export function SetupQuestionnaire({ businessId, questionnaire }: SetupQuestionnaireProps) {
  const [answers, setAnswers] = useState<OnboardingAnswers>({});
  const [screen, setScreen] = useState<Screen>({ kind: "questions", stepIndex: 0 });
  const [recommendError, setRecommendError] = useState<string | undefined>();
  const [applyError, setApplyError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const visibleSteps = useMemo(
    () =>
      questionnaire.steps
        .map((step, index) => ({
          step,
          index,
          visibleQuestions: step.questions.filter((question) =>
            isQuestionVisible(question, answers),
          ),
        }))
        .filter((entry) => entry.visibleQuestions.length > 0),
    [questionnaire, answers],
  );

  const totalSteps = visibleSteps.length;

  function setAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  function setMultiAnswer(questionId: string, value: string, checked: boolean) {
    setAnswers((prev) => {
      const existing = prev[questionId as keyof OnboardingAnswers];
      const current = Array.isArray(existing)
        ? existing
        : existing !== undefined
          ? [existing as string]
          : [];
      const next = checked ? [...current, value] : current.filter((v) => v !== value);
      const nextValue: string | string[] = next.length === 1 ? next[0]! : next;
      return { ...prev, [questionId]: nextValue };
    });
  }

  function next() {
    setScreen((current) => {
      if (current.kind !== "questions") return current;
      const nextIndex = current.stepIndex + 1;
      if (nextIndex >= totalSteps) {
        // Last step — submit answers to get a recommendation.
        void submitAnswers();
        return current;
      }
      return { kind: "questions", stepIndex: nextIndex };
    });
  }

  function back() {
    setScreen((current) => {
      if (current.kind !== "questions") return { kind: "questions", stepIndex: totalSteps - 1 };
      const prevIndex = current.stepIndex - 1;
      if (prevIndex < 0) return current;
      return { kind: "questions", stepIndex: prevIndex };
    });
  }

  async function submitAnswers() {
    setRecommendError(undefined);
    try {
      const recommendation = await fetchRecommendation(businessId, answers);
      setScreen({ kind: "review", recommendation });
    } catch (error) {
      setRecommendError(
        error instanceof Error ? error.message : "We could not generate a recommendation.",
      );
    }
  }

  function apply(formData: FormData) {
    startTransition(async () => {
      const action = applyRecommendationAction.bind(null, businessId);
      const state = await action({}, formData);
      if (state.error) {
        setApplyError(state.error);
      }
    });
  }

  if (screen.kind === "review") {
    return (
      <ReviewScreen
        businessId={businessId}
        recommendation={screen.recommendation}
        onBack={back}
        applyError={applyError}
        apply={apply}
        pending={pending}
      />
    );
  }

  const currentStep = visibleSteps[screen.stepIndex];
  if (!currentStep) {
    return (
      <div className="setup-page">
        <div className="setup-panel">
          <p>No questions are available right now.</p>
        </div>
      </div>
    );
  }

  const isLastStep = screen.stepIndex === totalSteps - 1;
  const stepNumber = screen.stepIndex + 1;
  const allAnswered = currentStep.visibleQuestions.every((question) => {
    const value = answers[question.id as keyof OnboardingAnswers];
    return value !== undefined && (!Array.isArray(value) || value.length > 0);
  });

  return (
    <div className="setup-page">
      <div className="setup-progress" aria-label="Setup progress">
        {visibleSteps.map((entry, index) => (
          <span
            key={entry.step.id}
            className={
              index < screen.stepIndex ? "done" : index === screen.stepIndex ? "active" : ""
            }
          >
            {entry.step.title}
          </span>
        ))}
      </div>
      <div className="setup-panel">
        <div className="page-heading compact">
          <span className="step-label">
            Step {stepNumber} of {totalSteps}
          </span>
          <h1>{currentStep.step.title}</h1>
          {currentStep.step.description ? <p>{currentStep.step.description}</p> : null}
        </div>
        <ActionMessage error={recommendError} />
        <div className="form-stack">
          {currentStep.visibleQuestions.map((question) => (
            <QuestionField
              key={question.id}
              question={question}
              value={answers[question.id as keyof OnboardingAnswers]}
              onSingle={(value) => setAnswer(question.id, value)}
              onMulti={(value, checked) => setMultiAnswer(question.id, value, checked)}
            />
          ))}
        </div>
        <div className="setup-nav">
          {screen.stepIndex > 0 ? (
            <button type="button" className="button button-quiet" onClick={back}>
              <ArrowLeft aria-hidden="true" size={16} /> Back
            </button>
          ) : null}
          <button
            type="button"
            className="button button-primary"
            onClick={next}
            disabled={!allAnswered}
          >
            {isLastStep ? "See recommendation" : "Continue"}
            <ArrowRight aria-hidden="true" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function isQuestionVisible(question: OnboardingQuestion, answers: OnboardingAnswers): boolean {
  if (!question.showWhen) return true;
  const dependentValue = answers[question.showWhen.questionId as keyof OnboardingAnswers];
  const values = question.showWhen.values;
  if (Array.isArray(dependentValue)) {
    return dependentValue.some((v) => values.includes(v));
  }
  return typeof dependentValue === "string" && values.includes(dependentValue);
}

function QuestionField({
  question,
  value,
  onSingle,
  onMulti,
}: {
  question: OnboardingQuestion;
  value: string | string[] | undefined;
  onSingle: (value: string) => void;
  onMulti: (value: string, checked: boolean) => void;
}) {
  const selected = Array.isArray(value) ? value : value !== undefined ? [value] : [];

  if (question.type === "boolean") {
    return (
      <fieldset className="field">
        <legend>{question.prompt}</legend>
        {question.helpText ? <small>{question.helpText}</small> : null}
        <div className="choice-row">
          {question.options?.map((option) => {
            const disabled = question.disabledOptions?.includes(option.value);
            return (
              <label
                key={option.value}
                className={`choice-card ${disabled ? "choice-card-disabled" : ""}`}
              >
                <input
                  type="radio"
                  name={question.id}
                  value={option.value}
                  checked={selected.includes(option.value)}
                  disabled={disabled}
                  onChange={() => onSingle(option.value)}
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  }

  if (question.type === "multi-select") {
    return (
      <fieldset className="field">
        <legend>{question.prompt}</legend>
        {question.helpText ? <small>{question.helpText}</small> : null}
        <div className="choice-row">
          {question.options?.map((option) => {
            const disabled = question.disabledOptions?.includes(option.value);
            return (
              <label
                key={option.value}
                className={`choice-card ${disabled ? "choice-card-disabled" : ""}`}
              >
                <input
                  type="checkbox"
                  name={question.id}
                  value={option.value}
                  checked={selected.includes(option.value)}
                  disabled={disabled}
                  onChange={(event) => onMulti(option.value, event.target.checked)}
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  }

  // single-select
  return (
    <fieldset className="field">
      <legend>{question.prompt}</legend>
      {question.helpText ? <small>{question.helpText}</small> : null}
      <div className="choice-row">
        {question.options?.map((option) => {
          const disabled = question.disabledOptions?.includes(option.value);
          return (
            <label
              key={option.value}
              className={`choice-card ${disabled ? "choice-card-disabled" : ""}`}
            >
              <input
                type="radio"
                name={question.id}
                value={option.value}
                checked={selected.includes(option.value)}
                disabled={disabled}
                onChange={() => onSingle(option.value)}
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function ReviewScreen({
  businessId,
  recommendation,
  onBack,
  applyError,
  apply,
  pending,
}: {
  businessId: string;
  recommendation: OnboardingRecommendation;
  onBack: () => void;
  applyError: string | undefined;
  apply: (formData: FormData) => void;
  pending: boolean;
}) {
  const enabledModules = recommendation.enabledModules.filter((m) => m.enabled);
  const disabledModules = recommendation.enabledModules.filter((m) => !m.enabled);

  return (
    <div className="setup-page">
      <div className="setup-panel setup-panel-wide">
        <div className="page-heading compact">
          <span className="eyebrow">Review your setup</span>
          <h1>Here&apos;s what we&apos;ll configure</h1>
          <p>
            You can change any of this later in Settings. Applying this will replace your current
            configuration.
          </p>
        </div>
        <ActionMessage error={applyError} />
        <div className="review-summary">
          <div className="review-section">
            <h2>Configuration</h2>
            <p className="review-template">
              <Check aria-hidden="true" size={16} />
              {recommendation.configurationTemplateCode} v
              {recommendation.configurationTemplateVersion}
            </p>
            {recommendation.fellBackToDefault ? (
              <p className="review-note">
                We fell back to the Default ERP because some answers conflicted. You can adjust your
                answers and try again.
              </p>
            ) : null}
          </div>
          <div className="review-section">
            <h2>Enabled modules</h2>
            <ul className="review-list">
              {enabledModules.map((module) => (
                <li key={module.code}>
                  <Check aria-hidden="true" size={15} />
                  {module.code}
                </li>
              ))}
            </ul>
            {disabledModules.length > 0 ? (
              <p className="review-muted">
                Not enabled: {disabledModules.map((m) => m.code).join(", ")}
              </p>
            ) : null}
          </div>
          {recommendation.workflowRefs.length > 0 ? (
            <div className="review-section">
              <h2>Workflows</h2>
              <ul className="review-list">
                {recommendation.workflowRefs.map((ref) => (
                  <li key={`${ref.documentType}-${ref.workflowTemplateCode}`}>
                    <Check aria-hidden="true" size={15} />
                    {ref.documentType} → {ref.workflowTemplateCode}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {recommendation.taxDefaults ? (
            <div className="review-section">
              <h2>Tax</h2>
              <p>
                {recommendation.taxDefaults.name} at {recommendation.taxDefaults.ratePercent}%
              </p>
            </div>
          ) : null}
          {recommendation.currencyDefaults ? (
            <div className="review-section">
              <h2>Currency</h2>
              <p>
                {recommendation.currencyDefaults.currencyCode} (scale{" "}
                {recommendation.currencyDefaults.currencyScale})
              </p>
            </div>
          ) : null}
          {recommendation.numbering ? (
            <div className="review-section">
              <h2>Numbering</h2>
              <p>
                Quotations: {recommendation.numbering.quotationPrefix} · Invoices:{" "}
                {recommendation.numbering.invoicePrefix}
              </p>
            </div>
          ) : null}
          {recommendation.summary.length > 0 ? (
            <div className="review-section">
              <h2>Summary</h2>
              <ul className="review-list">
                {recommendation.summary.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <form action={apply}>
          <input
            type="hidden"
            name="recommendation"
            value={JSON.stringify(recommendation)}
            readOnly
          />
          <div className="setup-nav">
            <button
              type="button"
              className="button button-quiet"
              onClick={onBack}
              disabled={pending}
            >
              <ArrowLeft aria-hidden="true" size={16} /> Back
            </button>
            <SubmitButton pendingText="Applying…" className="button button-primary">
              Apply configuration
              <ArrowRight aria-hidden="true" size={16} />
            </SubmitButton>
          </div>
        </form>
        <p className="review-footnote">
          This will be assigned to <code>{businessId}</code> as your primary configuration.
        </p>
      </div>
    </div>
  );
}
