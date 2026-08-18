import { Plus, Package } from "lucide-react";
import Link from "next/link";

import { type Product } from "@bizo/contracts/products";
import { type BusinessSettings } from "@bizo/contracts/platform";

import { apiJson } from "@/lib/api";
import { formatMinor } from "@/lib/display";

export default async function ProductsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const [products, settings] = await Promise.all([
    apiJson<Product[]>(`/businesses/${businessId}/products`),
    apiJson<BusinessSettings>(`/businesses/${businessId}/settings`),
  ]);
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Products &amp; Services</h1>
          <p>Your catalogue of items you sell or purchase.</p>
        </div>
        <Link className="button button-primary" href={`/b/${businessId}/products/new`}>
          <Plus aria-hidden="true" size={18} /> Add product
        </Link>
      </header>
      {products.length ? (
        <div className="data-list">
          {products.map((product) => (
            <div className="data-row" key={product.id}>
              <span className="avatar">{product.sku.slice(0, 1).toUpperCase()}</span>
              <span className="grow">
                <strong>{product.name}</strong>
                <small>
                  {product.sku} &middot; {product.type} &middot;{" "}
                  {product.sellingPriceMinor
                    ? formatMinor(
                        product.sellingPriceMinor,
                        settings.currencyScale,
                        settings.baseCurrency,
                      )
                    : "No price"}
                </small>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Package aria-hidden="true" size={30} />
          <h2>No products yet</h2>
          <p>Build your product and service catalogue.</p>
        </div>
      )}
    </div>
  );
}
