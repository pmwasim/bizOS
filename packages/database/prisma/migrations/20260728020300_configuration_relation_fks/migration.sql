-- Add missing relation foreign keys used by System Admin assignment/audit queries.

CREATE INDEX "business_configuration_assignments_assigned_by_membership_id_idx" ON "business_configuration_assignments"("assigned_by_membership_id");

ALTER TABLE "business_configuration_assignments" ADD CONSTRAINT "business_configuration_assignments_assigned_by_membership_id_fkey" FOREIGN KEY ("assigned_by_membership_id") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "configuration_audit_events" ADD CONSTRAINT "configuration_audit_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
