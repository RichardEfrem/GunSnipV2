import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppConfig } from '../src/config/app-config.js';

/**
 * Shared by the admin specs: a supertest agent that carries the admin key on every request.
 *
 * Every admin route is guarded (PRD §11.2), so a spec that forgot the header would fail with a
 * 401 that says nothing about what it was testing. `admin-guard.e2e-spec.ts` is the one place
 * the absent header is the subject.
 */
export interface AdminClient {
  get: (path: string) => request.Test;
  post: (path: string, body?: unknown) => request.Test;
  patch: (path: string, body?: unknown) => request.Test;
  put: (path: string, body?: unknown) => request.Test;
  delete: (path: string) => request.Test;
  /** For multipart, where the body is built by the caller. */
  raw: () => request.Agent;
  key: string;
}

const HEADER = 'x-admin-key';
const BASE = '/api/v1';

export function adminClient(app: INestApplication): AdminClient {
  const key = app.get(AppConfig).adminKey;
  const http = (): request.Agent => request(app.getHttpServer());

  return {
    get: (path) => http().get(`${BASE}${path}`).set(HEADER, key),
    post: (path, body) => http().post(`${BASE}${path}`).set(HEADER, key).send(body ?? {}),
    patch: (path, body) => http().patch(`${BASE}${path}`).set(HEADER, key).send(body ?? {}),
    put: (path, body) => http().put(`${BASE}${path}`).set(HEADER, key).send(body ?? {}),
    delete: (path) => http().delete(`${BASE}${path}`).set(HEADER, key),
    raw: http,
    key,
  };
}

/** The ids a product needs to exist, resolved from the seed so the specs survive a reseed. */
export async function seededRefs(
  admin: AdminClient,
): Promise<{ brandId: string; kitCategoryId: string; toolCategoryId: string; gradeId: string; scaleId: string }> {
  const [brands, categories, grades, scales] = await Promise.all([
    admin.get('/admin/reference/brands').expect(200),
    admin.get('/admin/reference/categories').expect(200),
    admin.get('/admin/reference/grades').expect(200),
    admin.get('/admin/reference/scales').expect(200),
  ]);

  type Row = { id: string; type?: string; key?: string };
  const kitCategory = (categories.body as Row[]).find((row) => row.type === 'MODEL_KIT');
  const toolCategory = (categories.body as Row[]).find((row) => row.type === 'TOOL_SUPPLY');

  return {
    brandId: (brands.body as Row[])[0].id,
    kitCategoryId: kitCategory?.id ?? '',
    toolCategoryId: toolCategory?.id ?? '',
    gradeId: (grades.body as Row[]).find((row) => row.key === 'MG')?.id ?? (grades.body as Row[])[0].id,
    scaleId: (scales.body as Row[])[0].id,
  };
}

/** A unique suffix, so specs running against one seeded database cannot collide on slug or SKU. */
export function unique(): string {
  return Math.random().toString(36).slice(2, 8);
}
