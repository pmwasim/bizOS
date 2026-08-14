"use client";

import { type CustomFieldDefinition } from "@bizo/contracts/customization";

export interface CustomFieldsRendererProps {
  definitions: CustomFieldDefinition[];
  values: Record<string, unknown>;
  onChange: (updatedValues: Record<string, unknown>) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
}

export function CustomFieldsRenderer({
  definitions,
  values,
  onChange,
  errors = {},
  disabled = false,
}: CustomFieldsRendererProps) {
  if (!definitions || definitions.length === 0) {
    return null;
  }

  const handleChange = (key: string, val: unknown) => {
    onChange({
      ...values,
      [key]: val,
    });
  };

  return (
    <div className="custom-fields-container space-y-4 my-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
      <h3 className="text-sm font-semibold text-slate-700 mb-2">Custom Fields</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {definitions.map((def) => {
          const key = def.fieldKey;
          const currentValue = values[key];
          const errorMsg = errors[key];
          const isRequired = def.config?.required ?? false;

          return (
            <div key={def.id} className="field flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600 flex items-center gap-1">
                <span>{def.label}</span>
                {isRequired ? <span className="text-red-500">*</span> : null}
              </label>

              {def.fieldType === "TEXT" && (
                <input
                  type="text"
                  value={typeof currentValue === "string" ? currentValue : ""}
                  onChange={(e) => handleChange(key, e.target.value)}
                  disabled={disabled}
                  placeholder={def.config?.helpText ?? ""}
                  className="input text-sm p-2 border rounded"
                />
              )}

              {def.fieldType === "MULTILINE" && (
                <textarea
                  value={typeof currentValue === "string" ? currentValue : ""}
                  onChange={(e) => handleChange(key, e.target.value)}
                  disabled={disabled}
                  placeholder={def.config?.helpText ?? ""}
                  rows={3}
                  className="textarea text-sm p-2 border rounded"
                />
              )}

              {def.fieldType === "NUMBER" && (
                <input
                  type="number"
                  value={
                    currentValue !== undefined && currentValue !== null ? String(currentValue) : ""
                  }
                  onChange={(e) =>
                    handleChange(key, e.target.value ? Number(e.target.value) : undefined)
                  }
                  disabled={disabled}
                  placeholder={def.config?.helpText ?? ""}
                  className="input text-sm p-2 border rounded"
                />
              )}

              {def.fieldType === "DATE" && (
                <input
                  type="date"
                  value={typeof currentValue === "string" ? currentValue.split("T")[0] : ""}
                  onChange={(e) => handleChange(key, e.target.value)}
                  disabled={disabled}
                  className="input text-sm p-2 border rounded"
                />
              )}

              {def.fieldType === "SELECT" && (
                <select
                  value={typeof currentValue === "string" ? currentValue : ""}
                  onChange={(e) => handleChange(key, e.target.value)}
                  disabled={disabled}
                  className="select text-sm p-2 border rounded bg-white"
                >
                  <option value="">-- Select {def.label} --</option>
                  {(def.config?.options ?? []).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}

              {def.fieldType === "BOOLEAN" && (
                <label className="flex items-center gap-2 cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={Boolean(currentValue)}
                    onChange={(e) => handleChange(key, e.target.checked)}
                    disabled={disabled}
                    className="checkbox"
                  />
                  <span className="text-xs text-slate-600">{def.label}</span>
                </label>
              )}

              {def.config?.helpText ? (
                <span className="text-xs text-slate-400">{def.config.helpText}</span>
              ) : null}

              {errorMsg ? (
                <span className="text-xs text-red-500 font-medium">{errorMsg}</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
