import { Injectable } from "@nestjs/common";

export interface RagSearchQuery {
  tenantId: string;
  userRole: string;
  queryText: string;
  maxTokens?: number;
}

export interface RagSearchResult {
  documentId: string;
  title: string;
  snippet: string;
  confidenceScore: number;
  tenantId: string;
}

export interface IndexedDocument {
  id: string;
  tenantId: string;
  roleRequired: string;
  content: string;
  title?: string;
}

@Injectable()
export class RagSearchEngine {
  private indexedDocs: IndexedDocument[] = [
    {
      id: "doc-101",
      tenantId: "tenant-a",
      roleRequired: "sales_manager",
      content: "ACME Corp Q3 Sales Revenue report total 150000 SAR",
    },
    {
      id: "doc-102",
      tenantId: "tenant-a",
      roleRequired: "admin",
      content: "Confidential Payroll Q3 Executive Compensation",
    },
    {
      id: "doc-103",
      tenantId: "tenant-b",
      roleRequired: "sales_manager",
      content: "Beta LLC Sales Contract agreement",
    },
  ];

  public addDocument(doc: IndexedDocument): void {
    this.indexedDocs.push(doc);
  }

  public addDocuments(docs: IndexedDocument[]): void {
    this.indexedDocs.push(...docs);
  }

  public clearDocuments(): void {
    this.indexedDocs = [];
  }

  public search(query: RagSearchQuery, customDocs?: IndexedDocument[]): RagSearchResult[] {
    if (!query.tenantId) {
      throw new Error("401 Unauthorized: Missing tenant ID");
    }

    if (query.maxTokens && query.maxTokens > 4000) {
      throw new Error("400 Bad Request: Query maxTokens limit exceeded");
    }

    const sanitized = query.queryText.replace(/System prompt:.*$/i, "").trim();
    if (!sanitized) {
      return [];
    }

    const docsToSearch = customDocs || this.indexedDocs;
    const queryTokens = this.tokenize(sanitized);
    if (queryTokens.length === 0) {
      return [];
    }

    const permittedDocs = docsToSearch.filter((doc) => {
      if (doc.tenantId !== query.tenantId) {
        return false;
      }
      return this.isRoleAuthorized(query.userRole, doc.roleRequired);
    });

    if (permittedDocs.length === 0) {
      return [];
    }

    const totalDocs = permittedDocs.length;
    const dfMap: Map<string, number> = new Map();

    for (const token of queryTokens) {
      let count = 0;
      for (const doc of permittedDocs) {
        const docTokens = new Set(this.tokenize(doc.content));
        if (docTokens.has(token)) {
          count++;
        }
      }
      dfMap.set(token, count);
    }

    const scoredResults: Array<{ doc: IndexedDocument; score: number; matchCount: number }> = [];

    for (const doc of permittedDocs) {
      const docTokens = this.tokenize(doc.content);
      if (docTokens.length === 0) continue;

      const tfMap: Map<string, number> = new Map();
      for (const t of docTokens) {
        tfMap.set(t, (tfMap.get(t) || 0) + 1);
      }

      let docScore = 0;
      let matchCount = 0;

      for (const token of queryTokens) {
        const tf = tfMap.get(token) || 0;
        if (tf > 0) {
          matchCount++;
          const df = dfMap.get(token) || 1;
          const idf = Math.log((totalDocs + 1) / (df + 0.5)) + 1;
          const normTf = tf / docTokens.length;
          docScore += normTf * idf;
        }
      }

      if (matchCount > 0) {
        scoredResults.push({ doc, score: docScore, matchCount });
      }
    }

    scoredResults.sort((a, b) => b.score - a.score);

    return scoredResults.map(({ doc, matchCount }) => {
      const termCoverage = matchCount / queryTokens.length;
      const dynamicConfidence = Math.min(
        0.99,
        Math.max(0.7, Number((0.72 + termCoverage * 0.2).toFixed(2))),
      );

      const title = doc.title || doc.content.substring(0, 30);
      const snippet = doc.content;

      return {
        documentId: doc.id,
        title,
        snippet,
        confidenceScore: dynamicConfidence,
        tenantId: doc.tenantId,
      };
    });
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter((t) => t.length > 0);
  }

  private isRoleAuthorized(userRole: string, roleRequired: string): boolean {
    if (userRole === "admin") return true;
    if (userRole === roleRequired) return true;
    if (roleRequired === "all" || roleRequired === "user" || !roleRequired) return true;
    return false;
  }
}

export { RagSearchEngine as RagSearchService };
