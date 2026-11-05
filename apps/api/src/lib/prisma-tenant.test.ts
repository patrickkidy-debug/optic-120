import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { TENANT_MODELS, TENANT_MODELS_EXCLUDED } from './prisma-tenant.js';

describe('isolation multi-tenant', () => {
  it('chaque modèle à tenantId est filtré automatiquement ou explicitement exclu', () => {
    const withTenant = Prisma.dmmf.datamodel.models
      .filter((m) => m.fields.some((f) => f.name === 'tenantId'))
      .map((m) => m.name);
    const forgotten = withTenant.filter((m) => !TENANT_MODELS.has(m) && !TENANT_MODELS_EXCLUDED.has(m));
    expect(forgotten).toEqual([]);
  });
});
