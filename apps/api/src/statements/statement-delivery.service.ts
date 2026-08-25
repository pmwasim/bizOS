import { createHash } from "node:crypto";

import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";

import {
  type CustomerStatement,
  type SendStatementRequest,
  type StatementDelivery,
  type StatementQuery,
} from "@bizo/contracts/statements";

import { notifyDocumentDeliveryFailed } from "../common/n8n-ops-notifier.js";
import { DatabaseService } from "../database/database.service.js";
import { type StatementSnapshot } from "../documents/statement-snapshot.js";
import { PdfService } from "../documents/pdf.service.js";
import { MailService } from "../mail/mail.service.js";
import {
  type AuthorizationAction,
  type BusinessAccessContext,
  BusinessAccessService,
} from "../security/business-access.service.js";
import { StatementsService } from "./statements.service.js";

/** The transaction handle `DatabaseService.withScope` hands to its callback. */
type TransactionLike = Parameters<Parameters<DatabaseService["withScope"]>[1]>[0];

/** The event type every statement email shares in the outbox, so dedupe can scope to it. */
const STATEMENT_EMAIL_EVENT = "statement.email";

interface HeaderContext {
  business: StatementSnapshot["business"];
  customer: StatementSnapshot["customer"];
}

/**
 * Exports a customer statement to PDF and emails it over SMTP.
 *
 * This is deliberately separate from {@link StatementsService}: statements are read models, and the
 * read model stays untouched by the delivery concern. The send path is idempotent — a customer +
 * period + recipient combination is recorded in the transactional outbox before the mail leaves, so
 * asking twice emails once (the second call reports the first delivery rather than sending again).
 */
@Injectable()
export class StatementDeliveryService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(BusinessAccessService) private readonly businessAccess: BusinessAccessService,
    @Inject(StatementsService) private readonly statements: StatementsService,
    @Inject(PdfService) private readonly pdf: PdfService,
    @Inject(MailService) private readonly mail: MailService,
  ) {}

  /** Render a customer's statement to a PDF buffer, ready to stream or attach. */
  async renderPdf(
    userPublicId: string,
    businessPublicId: string,
    customerPublicId: string,
    query: StatementQuery = {},
  ): Promise<{ buffer: Buffer; filename: string }> {
    // Exporting the statement PDF is a read-shaped capability, gated on the "export" action so it
    // mirrors invoice/quotation PDF export (read-only finance roles keep it).
    const access = await this.authorize(userPublicId, businessPublicId, "export");
    const statement = await this.statements.customer(
      userPublicId,
      businessPublicId,
      customerPublicId,
      query,
    );
    const snapshot = await this.buildSnapshot(access, customerPublicId, statement);
    return {
      buffer: await this.pdf.renderStatement(snapshot),
      filename: this.filename(statement),
    };
  }

  /**
   * Email a customer's statement. Idempotent per customer + period + recipient.
   *
   * The outbox row is written inside a scoped transaction before the PDF is rendered or the mail is
   * sent, so a crash after sending cannot lose the record and a retry after a failure does not
   * double-send a message that already went out.
   */
  async send(
    userPublicId: string,
    businessPublicId: string,
    customerPublicId: string,
    input: SendStatementRequest,
    requestId: string,
  ): Promise<StatementDelivery> {
    // Emailing a statement sends mail from the business identity, so it requires a send-capable
    // permission ("send"), not merely read access. Read-only finance roles (ACCOUNTANT,
    // EXTERNAL_AUDITOR) can export the PDF but must not be able to dispatch the email.
    const access = await this.authorize(userPublicId, businessPublicId, "send");
    const statement = await this.statements.customer(
      userPublicId,
      businessPublicId,
      customerPublicId,
      { startDate: input.startDate, endDate: input.endDate },
    );

    const idempotencyKey = this.idempotencyKey(customerPublicId, statement, input.recipientEmail);

    // Dedupe first: if this exact statement already reached this recipient, report that delivery
    // and send nothing. Only a published (successfully sent) row blocks a resend; a prior failure
    // left its row unpublished and must be allowed to retry.
    const prepared = await this.database.withScope(access, async (transaction) => {
      // Serialize identical concurrent sends before the no-published-row check. The
      // transaction-scoped advisory lock (keyed on the freshness-aware idempotency key) is released
      // on commit or rollback, so two identical sends run one-after-another and only one dispatches.
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`statement-send:${idempotencyKey}`}))`;

      const alreadySent = (await transaction.outboxEvent.findFirst({
        where: {
          businessId: access.businessId,
          eventType: STATEMENT_EMAIL_EVENT,
          publishedAt: { not: null },
          payload: { path: ["idempotencyKey"], equals: idempotencyKey },
        },
        orderBy: { publishedAt: "desc" },
      })) as { publishedAt: Date | null } | null;

      if (alreadySent) {
        return { deduped: true as const, sentAt: alreadySent.publishedAt };
      }

      const event = (await transaction.outboxEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          eventType: STATEMENT_EMAIL_EVENT,
          aggregateType: "customer_statement",
          aggregatePublicId: customerPublicId,
          payload: {
            idempotencyKey,
            requestId,
            recipientEmail: input.recipientEmail,
            periodStart: statement.periodStart,
            periodEnd: statement.periodEnd,
            asOf: statement.asOf,
            message: input.message,
          },
        },
        select: { id: true },
      })) as { id: string };

      return { deduped: false as const, eventId: event.id };
    });

    if (prepared.deduped) {
      return {
        id: idempotencyKey,
        status: "ALREADY_SENT",
        recipientEmail: input.recipientEmail,
        periodStart: statement.periodStart,
        periodEnd: statement.periodEnd,
        sentAt: (prepared.sentAt ?? new Date()).toISOString(),
      };
    }

    // Render and dispatch. On failure the outbox row is left unpublished (its attempt count bumped)
    // so the same request can be retried without the earlier intent being lost.
    try {
      const snapshot = await this.buildSnapshot(access, customerPublicId, statement);
      const attachment = await this.pdf.renderStatement(snapshot);
      await this.mail.sendStatement({
        attachment,
        body: input.message,
        businessName: snapshot.business.name,
        filename: this.filename(statement),
        reference: `as of ${statement.asOf}`,
        recipient: input.recipientEmail,
      });
    } catch (error) {
      await this.markAttempt(access, prepared.eventId);
      void notifyDocumentDeliveryFailed({
        tenantId: access.tenantPublicId,
        businessId: access.businessPublicId,
        documentType: "statement",
        documentId: customerPublicId,
        documentNumber: `as of ${statement.asOf}`,
        deliveryId: prepared.eventId,
        failureReason: error instanceof Error ? error.message : "unknown error",
      }).catch(() => undefined);
      throw new ServiceUnavailableException({
        code: "STATEMENT_DELIVERY_FAILED",
        detail:
          "The statement could not be emailed. It was not recorded as sent — you can retry the send.",
        cause: error instanceof Error ? error.message : undefined,
      });
    }

    const sentAt = new Date();
    await this.database.withScope(access, async (transaction) => {
      await transaction.outboxEvent.update({
        where: { id: prepared.eventId },
        data: { publishedAt: sentAt, attempts: { increment: 1 } },
      });
    });

    return {
      id: idempotencyKey,
      status: "SENT",
      recipientEmail: input.recipientEmail,
      periodStart: statement.periodStart,
      periodEnd: statement.periodEnd,
      sentAt: sentAt.toISOString(),
    };
  }

  /**
   * A key for "this version of this statement to this recipient". The key must dedupe an identical
   * immediate retry, yet let a genuinely-changed statement re-send. When the UI omits explicit
   * start/end dates the period is open-ended and constant, so the key also folds in the statement's
   * freshness: its `asOf` date and a signature of the rendered figures (opening/closing balances,
   * totals, and each line). A changed statement therefore yields a new key and is delivered, while
   * an identical resend collapses onto the same key and dedupes.
   */
  private idempotencyKey(
    customerPublicId: string,
    statement: CustomerStatement,
    recipientEmail: string,
  ): string {
    return createHash("sha256")
      .update(
        [
          "statement.v2",
          customerPublicId,
          statement.periodStart ?? "",
          statement.periodEnd ?? "",
          recipientEmail.trim().toLowerCase(),
          statement.asOf ?? "",
          this.contentSignature(statement),
        ].join(" "),
      )
      .digest("hex");
  }

  /**
   * A compact hash of the statement figures that advance as invoices, payments, and credits land.
   * Two statements with the same balances and lines share a signature (an identical retry dedupes);
   * any change to the balances or lines changes it (a fresh statement re-sends).
   */
  private contentSignature(statement: CustomerStatement): string {
    const parts = [
      statement.openingBalanceMinor,
      statement.totalInvoicedMinor,
      statement.totalPaidMinor,
      statement.totalCreditedMinor,
      statement.closingBalanceMinor,
      ...statement.items.map((item) =>
        [
          item.date,
          item.referenceNumber ?? "",
          item.debitMinor,
          item.creditMinor,
          item.balanceMinor,
        ].join("|"),
      ),
    ];
    return createHash("sha256").update(parts.join(" ")).digest("hex");
  }

  private async markAttempt(access: BusinessAccessContext, eventId: string): Promise<void> {
    await this.database.withScope(access, async (transaction) => {
      await transaction.outboxEvent.update({
        where: { id: eventId },
        data: { attempts: { increment: 1 } },
      });
    });
  }

  private filename(statement: CustomerStatement): string {
    return `statement-${statement.asOf}.pdf`;
  }

  private async buildSnapshot(
    access: BusinessAccessContext,
    customerPublicId: string,
    statement: CustomerStatement,
  ): Promise<StatementSnapshot> {
    const headers = await this.database.withScope(access, (transaction) =>
      this.loadHeaders(transaction, access, customerPublicId),
    );
    return {
      business: headers.business,
      customer: headers.customer,
      currencyCode: statement.currency,
      currencyScale: statement.currencyScale,
      periodStart: statement.periodStart,
      periodEnd: statement.periodEnd,
      asOf: statement.asOf,
      openingBalanceMinor: statement.openingBalanceMinor,
      totalInvoicedMinor: statement.totalInvoicedMinor,
      totalPaidMinor: statement.totalPaidMinor,
      totalCreditedMinor: statement.totalCreditedMinor,
      closingBalanceMinor: statement.closingBalanceMinor,
      lines: statement.items.map((item) => ({
        date: item.date,
        description: item.description,
        reference: item.referenceNumber,
        debitMinor: item.debitMinor,
        creditMinor: item.creditMinor,
        balanceMinor: item.balanceMinor,
      })),
      buckets: statement.buckets,
      otherCurrencies: statement.otherCurrencies,
    };
  }

  private async loadHeaders(
    transaction: TransactionLike,
    access: BusinessAccessContext,
    customerPublicId: string,
  ): Promise<HeaderContext> {
    const business = (await transaction.business.findUniqueOrThrow({
      where: { id: access.businessId },
      include: { taxProfile: true },
    })) as unknown as {
      name: string;
      legalName: string | null;
      email: string | null;
      phone: string | null;
      addressLine1: string | null;
      addressLine2: string | null;
      city: string | null;
      postalCode: string | null;
      taxProfile: { name: string; registrationNumber: string | null } | null;
    };

    const customer = (await transaction.customer.findFirstOrThrow({
      where: { businessId: access.businessId, publicId: customerPublicId },
    })) as unknown as {
      name: string;
      email: string | null;
      phone: string | null;
      addressLine1: string | null;
      addressLine2: string | null;
      city: string | null;
      postalCode: string | null;
    };

    return {
      business: {
        name: business.name,
        legalName: business.legalName,
        email: business.email,
        phone: business.phone,
        address: this.address(business),
        taxName: business.taxProfile?.name ?? "Tax",
        taxRegistrationNumber: business.taxProfile?.registrationNumber ?? null,
      },
      customer: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: this.address(customer),
      },
    };
  }

  private address(value: {
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    postalCode: string | null;
  }): string[] {
    return [
      value.addressLine1,
      value.addressLine2,
      [value.city, value.postalCode].filter(Boolean).join(" "),
    ].filter((line): line is string => Boolean(line));
  }

  private async authorize(
    userPublicId: string,
    businessPublicId: string,
    action: AuthorizationAction,
  ): Promise<BusinessAccessContext> {
    const access = await this.businessAccess.resolve(userPublicId, businessPublicId);
    await this.businessAccess.assertAllowed(access, "payments", action);
    return access;
  }
}
