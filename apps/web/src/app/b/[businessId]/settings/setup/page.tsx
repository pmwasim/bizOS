import { type OnboardingQuestionnaire } from "@bizo/contracts/onboarding";

import { SetupQuestionnaire } from "@/components/setup-questionnaire";
import { apiJson } from "@/lib/api";

export default async function SettingsSetupPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const questionnaire = await apiJson<OnboardingQuestionnaire>("/onboarding/questionnaire");
  return <SetupQuestionnaire businessId={businessId} questionnaire={questionnaire} />;
}
