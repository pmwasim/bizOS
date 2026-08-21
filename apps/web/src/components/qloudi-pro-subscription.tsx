"use client";

import {
  ErrorCode,
  PurchasesError,
  type CustomerInfo,
  type Offering,
  type Package,
  type PurchaseResult,
} from "@revenuecat/purchases-js";
import { CheckCircle2, CreditCard, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import {
  PACKAGE_IDENTIFIERS,
  ensurePurchasesConfigured,
  formatPurchasesError,
  getQloudiProEntitlement,
  hasQloudiPro,
  isUserCancelledPurchase,
} from "@/lib/revenuecat";

type LoadState = "idle" | "loading" | "ready" | "error";

function packagePriceLabel(pkg: Package): string {
  const product = pkg.webBillingProduct;
  if (!product) return "Price unavailable";
  const { currentPrice } = product;
  if (!currentPrice) return product.title || pkg.identifier;
  return currentPrice.formattedPrice;
}

function packageTitle(pkg: Package): string {
  return pkg.webBillingProduct?.title ?? pkg.identifier;
}

export function QloudiProSubscriptionPanel({
  appUserId,
  customerEmail,
}: {
  appUserId: string;
  customerEmail?: string | null;
}) {
  const paywallHostId = useId();
  const paywallHostRef = useRef<HTMLDivElement | null>(null);

  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offering, setOffering] = useState<Offering | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [serverHasQloudiPro, setServerHasQloudiPro] = useState<boolean | null>(null);
  const [serverConfigured, setServerConfigured] = useState<boolean | null>(null);

  const applyPurchaseResult = useCallback((result: PurchaseResult) => {
    setCustomerInfo(result.customerInfo);
    if (hasQloudiPro(result.customerInfo)) {
      setStatusNote("Qloudi Pro is active on this account.");
    } else {
      setStatusNote("Purchase completed. Entitlement sync may take a moment — refresh if needed.");
    }
    void fetch("/api/billing/entitlements", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = (await response.json()) as {
          configured?: boolean;
          hasQloudiPro?: boolean;
        };
        setServerConfigured(Boolean(payload.configured));
        setServerHasQloudiPro(Boolean(payload.hasQloudiPro));
      })
      .catch(() => {
        /* client entitlement state remains the source of truth in the UI */
      });
  }, []);

  const loadSubscription = useCallback(
    async (signal: { cancelled: boolean }) => {
      try {
        const purchases = await ensurePurchasesConfigured(appUserId);
        const [info, offerings, serverResponse] = await Promise.all([
          purchases.getCustomerInfo(),
          purchases.getOfferings(),
          fetch("/api/billing/entitlements", { cache: "no-store" }).catch(() => null),
        ]);
        if (signal.cancelled) return;
        setCustomerInfo(info);
        setOffering(offerings.current);
        setErrorMessage(null);
        setLoadState("ready");

        if (serverResponse?.ok) {
          const payload = (await serverResponse.json()) as {
            configured?: boolean;
            hasQloudiPro?: boolean;
          };
          if (!signal.cancelled) {
            setServerConfigured(Boolean(payload.configured));
            setServerHasQloudiPro(Boolean(payload.hasQloudiPro));
          }
        } else if (!signal.cancelled) {
          setServerConfigured(null);
          setServerHasQloudiPro(null);
        }
      } catch (error) {
        if (signal.cancelled) return;
        setLoadState("error");
        setErrorMessage(formatPurchasesError(error));
      }
    },
    [appUserId],
  );

  useEffect(() => {
    const signal = { cancelled: false };
    // Schedule after paint so this effect does not setState synchronously.
    const handle = window.setTimeout(() => {
      if (signal.cancelled) return;
      setLoadState("loading");
      setErrorMessage(null);
      void loadSubscription(signal);
    }, 0);
    return () => {
      signal.cancelled = true;
      window.clearTimeout(handle);
    };
  }, [loadSubscription]);

  const retryLoad = useCallback(() => {
    setLoadState("loading");
    setErrorMessage(null);
    void loadSubscription({ cancelled: false });
  }, [loadSubscription]);

  const presentPaywall = useCallback(async () => {
    setBusyAction("paywall");
    setErrorMessage(null);
    setStatusNote(null);
    try {
      const purchases = await ensurePurchasesConfigured(appUserId);
      const host = paywallHostRef.current;
      const result = await purchases.presentPaywall({
        ...(host ? { htmlTarget: host } : {}),
        ...(offering ? { offering } : {}),
        ...(customerEmail ? { customerEmail } : {}),
        onVisitCustomerCenter: () => {
          const url = customerInfo?.managementURL;
          if (url) {
            window.open(url, "_blank", "noopener,noreferrer");
          } else {
            setStatusNote(
              "No Customer Portal link yet. Complete a purchase first, then manage from here.",
            );
          }
        },
      });
      applyPurchaseResult(result);
    } catch (error) {
      if (isUserCancelledPurchase(error)) {
        setStatusNote("Paywall closed without a purchase.");
      } else if (
        error instanceof PurchasesError &&
        error.errorCode === ErrorCode.ConfigurationError
      ) {
        setErrorMessage(
          "No RevenueCat Paywall is published for the current offering yet. Use a package below, or publish a paywall in the RevenueCat dashboard.",
        );
      } else {
        setErrorMessage(formatPurchasesError(error));
      }
    } finally {
      setBusyAction(null);
    }
  }, [appUserId, applyPurchaseResult, customerEmail, customerInfo?.managementURL, offering]);

  const purchasePackage = useCallback(
    async (pkg: Package) => {
      setBusyAction(pkg.identifier);
      setErrorMessage(null);
      setStatusNote(null);
      try {
        const purchases = await ensurePurchasesConfigured(appUserId);
        const result = await purchases.purchase({
          rcPackage: pkg,
          ...(customerEmail ? { customerEmail } : {}),
        });
        applyPurchaseResult(result);
      } catch (error) {
        if (!isUserCancelledPurchase(error)) {
          setErrorMessage(formatPurchasesError(error));
        } else {
          setStatusNote("Purchase cancelled.");
        }
      } finally {
        setBusyAction(null);
      }
    },
    [appUserId, applyPurchaseResult, customerEmail],
  );

  const openCustomerPortal = useCallback(() => {
    const url = customerInfo?.managementURL;
    if (!url) {
      setStatusNote(
        "Customer Portal opens after an active Web Billing subscription exists (managementURL).",
      );
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }, [customerInfo?.managementURL]);

  const isPro = customerInfo ? hasQloudiPro(customerInfo) : false;
  const entitlement = customerInfo ? getQloudiProEntitlement(customerInfo) : null;
  const packages = offering?.availablePackages ?? [];

  const orderedPackages = [
    packages.find((pkg) => pkg.identifier === PACKAGE_IDENTIFIERS.monthly),
    packages.find((pkg) => pkg.identifier === PACKAGE_IDENTIFIERS.yearly),
    packages.find((pkg) => pkg.identifier === PACKAGE_IDENTIFIERS.lifetime),
  ].filter((pkg): pkg is Package => pkg !== undefined);

  const displayPackages = orderedPackages.length > 0 ? orderedPackages : packages;

  return (
    <section className="qloudi-pro-panel" aria-labelledby="qloudi-pro-heading">
      <header className="qloudi-pro-header">
        <Sparkles aria-hidden="true" size={22} />
        <div>
          <h2 id="qloudi-pro-heading">Qloudi Pro</h2>
          <p>Subscribe with RevenueCat Web Billing — Monthly, Yearly, or Lifetime.</p>
        </div>
      </header>

      {loadState === "loading" || loadState === "idle" ? (
        <p className="qloudi-pro-status" role="status">
          <Loader2 aria-hidden="true" className="spin" size={18} />
          Loading subscription status…
        </p>
      ) : null}

      {loadState === "error" && errorMessage ? (
        <div className="qloudi-pro-alert" role="alert">
          <p>{errorMessage}</p>
          <button className="button button-quiet" type="button" onClick={retryLoad}>
            Retry
          </button>
        </div>
      ) : null}

      {loadState === "ready" && customerInfo ? (
        <>
          <div className={`qloudi-pro-entitlement ${isPro ? "is-active" : ""}`} role="status">
            {isPro ? (
              <>
                <CheckCircle2 aria-hidden="true" size={20} />
                <div>
                  <strong>Qloudi Pro is active</strong>
                  <small>
                    {entitlement?.productIdentifier
                      ? `Product: ${entitlement.productIdentifier}`
                      : "Entitlement unlocked"}
                    {entitlement?.expirationDate
                      ? ` · Renews/expires ${entitlement.expirationDate.toLocaleDateString()}`
                      : " · Lifetime or non-expiring"}
                    {serverConfigured === true
                      ? serverHasQloudiPro
                        ? " · Server verified"
                        : " · Server: not active yet"
                      : serverConfigured === false
                        ? " · Server check not configured"
                        : ""}
                  </small>
                </div>
              </>
            ) : (
              <div>
                <strong>Qloudi Pro is not active</strong>
                <small>Choose a plan below or open the RevenueCat Paywall.</small>
              </div>
            )}
          </div>

          <div className="qloudi-pro-actions">
            <button
              className="button button-primary"
              type="button"
              disabled={busyAction !== null}
              onClick={() => void presentPaywall()}
            >
              {busyAction === "paywall" ? (
                <>
                  <Loader2 aria-hidden="true" className="spin" size={16} />
                  Opening paywall…
                </>
              ) : (
                "Present RevenueCat Paywall"
              )}
            </button>
            <button
              className="button button-quiet"
              type="button"
              disabled={busyAction !== null || !customerInfo.managementURL}
              onClick={openCustomerPortal}
              title={
                customerInfo.managementURL
                  ? "Open Web Billing Customer Portal"
                  : "Available after an active subscription"
              }
            >
              <CreditCard aria-hidden="true" size={16} />
              Manage subscription
            </button>
          </div>

          <p className="qloudi-pro-footnote">
            Native Customer Center is mobile-only. On web, use the Customer Portal via{" "}
            <code>managementURL</code> (same self-serve cancel / payment update flow).
          </p>

          {displayPackages.length > 0 ? (
            <div className="qloudi-pro-packages" role="list">
              {displayPackages.map((pkg) => {
                const highlighted = pkg.identifier === PACKAGE_IDENTIFIERS.yearly;
                return (
                  <article
                    key={pkg.identifier}
                    className={`qloudi-pro-package ${highlighted ? "is-highlighted" : ""}`}
                    role="listitem"
                  >
                    <h3>{packageTitle(pkg)}</h3>
                    <p className="qloudi-pro-price">{packagePriceLabel(pkg)}</p>
                    <button
                      className="button button-quiet"
                      type="button"
                      disabled={busyAction !== null}
                      onClick={() => void purchasePackage(pkg)}
                    >
                      {busyAction === pkg.identifier ? (
                        <>
                          <Loader2 aria-hidden="true" className="spin" size={16} />
                          Purchasing…
                        </>
                      ) : (
                        `Buy ${packageTitle(pkg)}`
                      )}
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="qloudi-pro-footnote">
              No packages on the current offering. Confirm the <code>default</code> offering is
              current in RevenueCat.
            </p>
          )}
        </>
      ) : null}

      {errorMessage && loadState === "ready" ? (
        <div className="qloudi-pro-alert" role="alert">
          <p>{errorMessage}</p>
        </div>
      ) : null}
      {statusNote ? (
        <p className="qloudi-pro-status" role="status">
          {statusNote}
        </p>
      ) : null}

      <div
        id={paywallHostId}
        ref={paywallHostRef}
        className="qloudi-pro-paywall-host"
        aria-live="polite"
      />
    </section>
  );
}
