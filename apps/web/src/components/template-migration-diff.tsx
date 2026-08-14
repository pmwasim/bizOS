"use client";

import { AlertTriangle, CheckCircle, Info, MinusCircle, PlusCircle } from "lucide-react";
import { type TemplateMigrationPreviewResponse } from "@bizo/contracts/system-admin";

export interface TemplateMigrationDiffPreviewProps {
  preview: TemplateMigrationPreviewResponse;
  onConfirmAssignment: () => void;
  onCancel?: () => void;
  isPending?: boolean;
}

export function TemplateMigrationDiffPreview({
  preview,
  onConfirmAssignment,
  onCancel,
  isPending = false,
}: TemplateMigrationDiffPreviewProps) {
  return (
    <div className="template-migration-diff p-6 border rounded-lg bg-white shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Template Migration Preview</h2>
          <p className="text-xs text-slate-500 font-mono mt-1">
            Target Version: {preview.targetTemplateVersionId}
          </p>
        </div>
        {preview.hasConflicts ? (
          <span className="flex items-center gap-1 text-xs font-semibold px-3 py-1 bg-amber-100 text-amber-800 rounded-full">
            <AlertTriangle className="w-4 h-4 text-amber-600" /> Breaking Changes Flagged
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs font-semibold px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full">
            <CheckCircle className="w-4 h-4 text-emerald-600" /> Compatible Schema
          </span>
        )}
      </div>

      {preview.breakingChanges.length > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <h4 className="text-sm font-semibold text-red-800 flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4" /> Breaking Changes
          </h4>
          <ul className="list-disc list-inside text-xs text-red-700 space-y-1">
            {preview.breakingChanges.map((change, idx) => (
              <li key={idx}>{change}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-3 bg-emerald-50 border border-emerald-100 rounded">
          <h4 className="text-xs font-bold text-emerald-800 flex items-center gap-1 mb-2">
            <PlusCircle className="w-3.5 h-3.5 text-emerald-600" /> Added (
            {preview.addedFields.length})
          </h4>
          {preview.addedFields.length === 0 ? (
            <p className="text-xs text-emerald-600 italic">No additions</p>
          ) : (
            <ul className="text-xs text-emerald-700 space-y-1">
              {preview.addedFields.map((field, idx) => (
                <li key={idx}>+ {field}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-3 bg-rose-50 border border-rose-100 rounded">
          <h4 className="text-xs font-bold text-rose-800 flex items-center gap-1 mb-2">
            <MinusCircle className="w-3.5 h-3.5 text-rose-600" /> Removed (
            {preview.removedFields.length})
          </h4>
          {preview.removedFields.length === 0 ? (
            <p className="text-xs text-rose-600 italic">No removals</p>
          ) : (
            <ul className="text-xs text-rose-700 space-y-1">
              {preview.removedFields.map((field, idx) => (
                <li key={idx}>- {field}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-3 bg-amber-50 border border-amber-100 rounded">
          <h4 className="text-xs font-bold text-amber-800 flex items-center gap-1 mb-2">
            <Info className="w-3.5 h-3.5 text-amber-600" /> Modified Rules (
            {preview.modifiedRules.length})
          </h4>
          {preview.modifiedRules.length === 0 ? (
            <p className="text-xs text-amber-600 italic">No rule modifications</p>
          ) : (
            <ul className="text-xs text-amber-700 space-y-1">
              {preview.modifiedRules.map((rule, idx) => (
                <li key={idx}>~ {rule}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={onConfirmAssignment}
          disabled={isPending}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded shadow-sm disabled:opacity-50"
        >
          {isPending ? "Assigning..." : "Confirm & Assign Migration"}
        </button>
      </div>
    </div>
  );
}
