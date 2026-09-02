/**
 * Homepage-only notice that the system is under maintenance. Non-blocking — the
 * site stays fully browsable underneath it.
 *
 * Toggle: set MAINTENANCE_BANNER=false (server env, read at request time — no
 * rebuild needed, just a service restart) to hide it. Defaults to shown.
 */
export function MaintenanceBanner() {
  if (process.env.MAINTENANCE_BANNER === "false") return null;

  return (
    <div className="mkt-maintenance-banner" role="status">
      <p>
        <strong>bizOS is currently undergoing maintenance.</strong> Some features may be
        unavailable.
      </p>
    </div>
  );
}
