"use client";

import { Building, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export interface BusinessOption {
  id: string;
  name: string;
  tenantId: string;
  role: string;
}

export function WorkspaceSwitcher({
  currentBusinessId,
  currentBusinessName,
  businesses = [],
}: {
  currentBusinessId: string;
  currentBusinessName: string;
  businesses?: BusinessOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextId = e.target.value;
    if (nextId && nextId !== currentBusinessId) {
      startTransition(() => {
        router.push(`/b/${nextId}`);
      });
    }
  };

  if (!businesses.length || businesses.length <= 1) {
    return (
      <div className="business-chip">
        <span>{currentBusinessName.slice(0, 1).toUpperCase()}</span>
        <strong>{currentBusinessName}</strong>
      </div>
    );
  }

  return (
    <div className="business-chip workspace-switcher relative flex items-center gap-2 border rounded p-2">
      <Building aria-hidden="true" size={16} />
      <select
        value={currentBusinessId}
        onChange={handleSelect}
        disabled={isPending}
        className="w-full bg-transparent font-semibold text-sm cursor-pointer outline-none"
        aria-label="Switch Business Workspace"
      >
        {businesses.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name} ({b.role})
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden="true" size={14} className="pointer-events-none opacity-60" />
    </div>
  );
}
