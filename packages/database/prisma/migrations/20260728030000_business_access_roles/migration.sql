-- Expand the role enum. Existing MEMBER grants retain their original behavior.
ALTER TYPE "RoleCode" ADD VALUE IF NOT EXISTS 'STAFF';
ALTER TYPE "RoleCode" ADD VALUE IF NOT EXISTS 'ACCOUNTANT';
ALTER TYPE "RoleCode" ADD VALUE IF NOT EXISTS 'EXTERNAL_AUDITOR';
