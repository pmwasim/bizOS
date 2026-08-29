import { NotFoundException } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { CrmActivitiesService } from "../crm/activities.service.js";
import { LeadsService } from "../crm/leads.service.js";
import { OpportunitiesService } from "../crm/opportunities.service.js";
import { ConfigurationService } from "../configuration/configuration.service.js";
import { DatabaseService } from "../database/database.service.js";
import { PdfService } from "../documents/pdf.service.js";
import { QuotationsService } from "../documents/quotations.service.js";
import { IdentityService } from "../identity/identity.service.js";
import { type MailService } from "../mail/mail.service.js";
import { PlatformService } from "../platform/platform.service.js";
import { BusinessAccessService } from "../security/business-access.service.js";

const databaseEnabled = process.env.RUN_DATABASE_TESTS === "true";
const RUN_ID = crypto.randomUUID().slice(0, 8);

// End-to-end verification gate for Sprint 7 (Commercial CRM): drives one lead
// all the way through scoring, lead→opportunity progression, the interaction
// journal (including the automatic stage-change entry), opportunity→quotation
// conversion and its idempotency, then asserts cross-tenant isolation — all
// against a real PostgreSQL instance with row-level security in force.
describe.runIf(databaseEnabled)(
  "CRM lifecycle gate (Sprint 7: leads → opportunities → journal)",
  () => {
    let database: DatabaseService;
    let identity: IdentityService;
    let platform: PlatformService;
    let leads: LeadsService;
    let opportunities: OpportunitiesService;
    let activities: CrmActivitiesService;

    async function provisionBusiness(label: string) {
      const owner = await identity.signUp({
        displayName: `${label} Owner`,
        email: `${label.toLowerCase()}-owner-${RUN_ID}@example.test`,
        password: "Production1Password",
      });
      const business = await platform.createBusiness(
        owner.id,
        {
          name: `${label} Co`,
          countryCode: "SA",
          baseCurrency: "SAR",
          currencyScale: 2,
          locale: "en",
          timeZone: "Asia/Riyadh",
          taxEnabled: true,
          taxName: "VAT",
          taxRatePercent: "15",
        },
        `integration-business-${label}`,
      );
      return { owner, business };
    }

    beforeAll(async () => {
      database = new DatabaseService();
      await database.onModuleInit();
      const access = new BusinessAccessService(database);
      const configuration = new ConfigurationService(database, access);
      identity = new IdentityService(database, {
        sendPasswordReset: async () => "test-message-id",
      } as never);
      platform = new PlatformService(database, access, configuration);
      leads = new LeadsService(database, access);
      const quotations = new QuotationsService(
        database,
        access,
        new PdfService(),
        {
          sendQuotation: vi.fn().mockResolvedValue("integration-message"),
        } as unknown as MailService,
        { isConfigured: () => false } as never,
        configuration,
      );
      opportunities = new OpportunitiesService(database, access, quotations);
      activities = new CrmActivitiesService(database, access);
    });

    afterAll(async () => {
      if (database) {
        await database.onModuleDestroy();
      }
    });

    it("scores a lead, progresses it, journals the interaction, and converts it to a quotation", async () => {
      const { owner, business } = await provisionBusiness("Primary");

      // 1) A well-qualified lead scores above zero (TASK-26).
      const lead = await leads.create(
        owner.id,
        business.id,
        {
          name: "Dana Prospect",
          company: "Prospect Industries",
          email: `lead-${RUN_ID}@example.test`,
          phone: "+966500000000",
          source: "referral",
          estimatedValue: "500000",
          currencyCode: "SAR",
        },
        "gate-lead-create",
      );
      expect(lead.score).toBeGreaterThan(0);

      // Advancing the lead to QUALIFIED raises the score (recomputed on update).
      const qualified = await leads.update(
        owner.id,
        business.id,
        lead.id,
        { name: lead.name, status: "QUALIFIED" },
        "gate-lead-qualify",
      );
      expect(qualified.score).toBeGreaterThan(lead.score);

      // 2) Converting the lead progresses it into a linked opportunity (TASK-26).
      const converted = await leads.convert(owner.id, business.id, lead.id, "gate-lead-convert");
      expect(converted.status).toBe("CONVERTED");
      expect(converted.opportunityId).not.toBeNull();
      const opportunityId = converted.opportunityId!;

      // 3) Log a manual interaction against the opportunity (TASK-28).
      const note = await activities.create(owner.id, business.id, {
        type: "CALL",
        subject: "Kickoff call",
        body: "Discussed scope and timeline.",
        occurredAt: "2026-08-20T09:00:00.000Z",
        opportunityId,
      });
      expect(note.type).toBe("CALL");

      // 4) Changing the opportunity stage auto-appends a STAGE_CHANGE entry (TASK-28).
      await opportunities.update(
        owner.id,
        business.id,
        opportunityId,
        { stage: "QUALIFICATION" },
        "gate-opp-stage",
      );
      const timeline = await activities.list(owner.id, business.id, {
        opportunityPublicId: opportunityId,
      });
      // Most-recent-first: the auto stage-change (now) precedes the back-dated call.
      expect(timeline).toHaveLength(2);
      expect(timeline[0]?.type).toBe("STAGE_CHANGE");
      expect(timeline[1]?.type).toBe("CALL");

      // 5) Convert the opportunity to a quotation (TASK-27); a customer is seeded
      //    from the lead and the opportunity is linked.
      const quoted = await opportunities.convertToQuotation(
        owner.id,
        business.id,
        opportunityId,
        {},
        "gate-opp-convert",
      );
      expect(quoted.quotationId).toBeTruthy();
      expect(quoted.quotation?.id).toBe(quoted.quotationId);

      // 6) Idempotent: a second conversion returns the same quotation.
      const again = await opportunities.convertToQuotation(
        owner.id,
        business.id,
        opportunityId,
        {},
        "gate-opp-convert-again",
      );
      expect(again.quotationId).toBe(quoted.quotationId);
    });

    it("isolates the interaction journal across tenants", async () => {
      const { owner, business } = await provisionBusiness("Tenant-A");
      const lead = await leads.create(
        owner.id,
        business.id,
        { name: "A Lead", email: `a-lead-${RUN_ID}@example.test`, source: "web" },
        "gate-iso-lead",
      );
      const converted = await leads.convert(owner.id, business.id, lead.id, "gate-iso-convert");
      const opportunityId = converted.opportunityId!;
      await activities.create(owner.id, business.id, {
        type: "NOTE",
        subject: "Private note",
        opportunityId,
      });

      const outsider = await provisionBusiness("Tenant-B");

      // The other tenant cannot resolve the opportunity to list its journal…
      await expect(
        activities.list(outsider.owner.id, outsider.business.id, {
          opportunityPublicId: opportunityId,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      // …nor attach an activity to it.
      await expect(
        activities.create(outsider.owner.id, outsider.business.id, {
          type: "NOTE",
          subject: "Intrusion",
          opportunityId,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  },
);
