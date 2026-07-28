import { SetupChoice } from "@/components/setup-choice";

export default async function SetupPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  return <SetupChoice businessId={businessId} />;
}
