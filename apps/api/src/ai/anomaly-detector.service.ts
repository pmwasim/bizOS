import { Injectable } from "@nestjs/common";

export interface AnomalyEvent {
  id: string;
  tenantId: string;
  transactionId: string;
  anomalyType: "DUPLICATE_REFERENCE" | "RATE_SPIKE" | "UNUSUAL_REFUND";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  description: string;
  status: "OPEN" | "DISMISSED" | "RESOLVED";
  detectedAt: string;
  dismissedByUserId?: string;
  dismissedAt?: string;
}

@Injectable()
export class AnomalyDetectorService {
  private anomalies: AnomalyEvent[] = [];

  public scanTransactions(
    tenantId: string,
    transactions: Array<{ id: string; ref: string; amount: number; itemBaselineAvg?: number }>,
  ): AnomalyEvent[] {
    const seenRefs = new Set<string>();

    for (const tx of transactions) {
      if (tx.amount <= 0) {
        this.anomalies.push({
          id: `anom-${Date.now()}-${Math.random()}`,
          tenantId,
          transactionId: tx.id,
          anomalyType: "UNUSUAL_REFUND",
          severity: "HIGH",
          description: `Invalid or negative transaction amount: ${tx.amount}`,
          status: "OPEN",
          detectedAt: new Date().toISOString(),
        });
      }

      if (seenRefs.has(tx.ref)) {
        this.anomalies.push({
          id: `anom-${Date.now()}-${Math.random()}`,
          tenantId,
          transactionId: tx.id,
          anomalyType: "DUPLICATE_REFERENCE",
          severity: "CRITICAL",
          description: `Duplicate reference number detected: ${tx.ref}`,
          status: "OPEN",
          detectedAt: new Date().toISOString(),
        });
      } else {
        seenRefs.add(tx.ref);
      }

      if (tx.itemBaselineAvg && tx.itemBaselineAvg > 0) {
        const spikeRatio = (tx.amount - tx.itemBaselineAvg) / tx.itemBaselineAvg;
        if (spikeRatio > 0.5) {
          this.anomalies.push({
            id: `anom-${Date.now()}-${Math.random()}`,
            tenantId,
            transactionId: tx.id,
            anomalyType: "RATE_SPIKE",
            severity: "MEDIUM",
            description: `Rate spike detected: ${(spikeRatio * 100).toFixed(1)}% above baseline`,
            status: "OPEN",
            detectedAt: new Date().toISOString(),
          });
        }
      }
    }

    return this.anomalies.filter((a) => a.tenantId === tenantId);
  }

  public dismissAnomaly(anomalyId: string, userId: string): AnomalyEvent {
    const item = this.anomalies.find((a) => a.id === anomalyId);
    if (!item) {
      throw new Error("404 Not Found: Anomaly not found");
    }
    item.status = "DISMISSED";
    item.dismissedByUserId = userId;
    item.dismissedAt = new Date().toISOString();
    return item;
  }
}

export { AnomalyDetectorService as AnomalyDetectionScanner };
