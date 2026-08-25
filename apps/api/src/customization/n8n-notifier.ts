// Phase 11 compatibility surface. Implementation lives in the shared ops notifier
// so document delivery, onboarding, and System Admin events share one contract.

export {
  notifyCustomizationRequestCreated,
  signPayload,
  verifyPayloadSignature,
  type CustomizationRequestNotificationPayload,
} from "../common/n8n-ops-notifier.js";
