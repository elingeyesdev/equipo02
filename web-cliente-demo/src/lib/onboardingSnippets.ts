export type StackTarget = 'laravel' | 'nodejs' | 'curl'
export type ApiKeyRole = 'integrador' | 'admin' | 'lectura'

export type OnboardingContext = {
  baseUrl: string
  apiKey: string
  apiKeyRole: ApiKeyRole
  entityName: string
  businessIdField: string
  entityType: string
  schemaVersion: string
  payloadExampleText: string
}

export type CurlExamples = {
  create: string
  update: string
  history: string
}

const MANUAL_INTEGRATOR_ANCHOR = '/docs/manual-integracion-baas-v2.md#integrador-externo'

/** Ruta relativa al repo para el enlace desde la UI (GitHub raw o path local). */
export function integrationManualPath(repoUrl?: string): string {
  const base = (repoUrl ?? '').replace(/\/+$/, '')
  if (!base) return MANUAL_INTEGRATOR_ANCHOR
  return `${base}/blob/main/docs/manual-integracion-baas-v2.md#integrador-externo`
}

export function buildEnvSnippet(ctx: OnboardingContext): string {
  return `BLOCKCHAIN_ENABLED=true
BLOCKCHAIN_API_URL=${ctx.baseUrl.replace(/\/+$/, '')}
BLOCKCHAIN_API_KEY=${ctx.apiKey}`
}

export function buildMappingTable(ctx: OnboardingContext): string {
  const entity = ctx.entityName.trim() || 'TuEntidad'
  const field = ctx.businessIdField.trim() || 'id'
  const entityLower = entity.charAt(0).toLowerCase() + entity.slice(1)
  return `Tu modelo                    →  BaaS
────────────────────────────────────────────────────
${entityLower}.${field}          →  datoId
"${ctx.entityType}"              →  tipo
{ snapshot de ${entityLower} }   →  payload (JSON libre)
payload.schemaVersion            →  "${ctx.schemaVersion}"`
}

export function roleBehaviorNote(role: ApiKeyRole): string {
  if (role === 'integrador') {
    return 'Con rol integrador el BaaS responde HTTP 202: la solicitud queda PENDIENTE hasta que un admin la apruebe en la consola. No es un error.'
  }
  if (role === 'admin') {
    return 'Con rol admin el BaaS responde HTTP 201 y el dato se escribe directamente en la cadena.'
  }
  return 'Con rol lectura solo puedes usar GET (consultas e historial). Las mutaciones devuelven 403.'
}

function payloadForCurl(ctx: OnboardingContext): string {
  try {
    const parsed = JSON.parse(ctx.payloadExampleText)
    return JSON.stringify(parsed, null, 2)
      .split('\n')
      .map((line, idx) => (idx === 0 ? line : `    ${line}`))
      .join('\n')
  } catch {
    return `{
      "schemaVersion": "${ctx.schemaVersion}",
      "estado": "activo"
    }`
  }
}

export function buildCurlExamples(ctx: OnboardingContext): CurlExamples {
  const base = ctx.baseUrl.replace(/\/+$/, '')
  const payload = payloadForCurl(ctx)
  const exampleId = 'REG-EJEMPLO-001'
  const key = ctx.apiKey

  return {
    create: `# 1) Alta inicial — POST /datos
curl -X POST "${base}/datos" \\
  -H "X-API-Key: ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "datoId": "${exampleId}",
    "tipo": "${ctx.entityType}",
    "payload": ${payload}
  }'
# Integrador → espera 202 (pendiente). Admin → espera 201 (txId).`,
    update: `# 2) Actualización — PUT /datos/{datoId} (snapshot COMPLETO)
curl -X PUT "${base}/datos/${exampleId}" \\
  -H "X-API-Key: ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "datoId": "${exampleId}",
    "tipo": "${ctx.entityType}",
    "payload": ${payload}
  }'`,
    history: `# 3) Historial inmutable
curl -X GET "${base}/datos/${exampleId}/historial" \\
  -H "X-API-Key: ${key}"`,
  }
}

export function buildLaravelConfigSnippet(ctx: OnboardingContext): string {
  return `<?php
// config/blockchain.php

return [
    'enabled' => env('BLOCKCHAIN_ENABLED', false),
    'api_url' => env('BLOCKCHAIN_API_URL', '${ctx.baseUrl.replace(/\/+$/, '')}'),
    'api_key' => env('BLOCKCHAIN_API_KEY'),
    'timeout' => 60,
];`
}

export function buildLaravelClientSnippet(_ctx: OnboardingContext): string {
  return `<?php
// app/Services/Blockchain/DatosBaasClient.php

namespace App\\Services\\Blockchain;

use Illuminate\\Support\\Facades\\Http;
use Illuminate\\Support\\Facades\\Log;

class DatosBaasClient
{
    public function syncDato(string $datoId, string $tipo, array $payload, bool $exists = false): array
    {
        if (!config('blockchain.enabled')) {
            return ['skipped' => true];
        }

        $url = rtrim(config('blockchain.api_url'), '/');
        $method = $exists ? 'put' : 'post';
        $endpoint = $exists ? "{$url}/datos/{$datoId}" : "{$url}/datos";

        $response = Http::timeout(config('blockchain.timeout', 60))
            ->withHeaders([
                'X-API-Key' => config('blockchain.api_key'),
                'Content-Type' => 'application/json',
            ])
            ->{$method}($endpoint, [
                'datoId' => $datoId,
                'tipo' => $tipo,
                'payload' => $payload,
            ]);

        if ($response->status() === 202) {
            // Rol integrador: pendiente de aprobación admin (no es error)
            Log::info('BaaS solicitud pendiente', $response->json());
            return $response->json();
        }

        $response->throw();
        return $response->json(); // incluye txId en 201
    }
}`
}

export function buildLaravelHookSnippet(ctx: OnboardingContext): string {
  const entity = ctx.entityName.trim() || 'Registro'
  const entityVar = entity.charAt(0).toLowerCase() + entity.slice(1)
  const field = ctx.businessIdField.trim() || 'id'
  return `<?php
// En tu Controller — DESPUÉS de guardar en la BD local con éxito.
// Ejemplo: ${entity}Controller::store / update

use App\\Services\\Blockchain\\DatosBaasClient;

public function store(Request $request, DatosBaasClient $baas)
{
    // ... validación y persistencia local ...
    $${entityVar} = ${entity}::create($request->validated());

    $result = $baas->syncDato(
        datoId: $${entityVar}->${field},
        tipo: '${ctx.entityType}',
        payload: $${entityVar}->toBlockchainSnapshot(), // construye el JSON del paso 2
        exists: false, // true en update → usa PUT
    );

    // Opcional: guardar txId o solicitudId en tu BD
    // $${entityVar}->update(['blockchain_tx_id' => $result['txId'] ?? null]);

    return redirect()->back();
}

// IMPORTANTE:
// - Llama al BaaS solo desde el SERVIDOR (Laravel), nunca desde React/Vite.
// - No expongas BLOCKCHAIN_API_KEY en variables VITE_*.
// - POST = alta | PUT = edición (envía snapshot completo del payload).`
}

export function buildNodeClientSnippet(ctx: OnboardingContext): string {
  return `// services/datosBaasClient.js
// Cliente reutilizable — usa variables de entorno del SERVIDOR (no VITE_*).

const BAAS_URL = process.env.BLOCKCHAIN_API_URL ?? '${ctx.baseUrl.replace(/\/+$/, '')}';
const BAAS_API_KEY = process.env.BLOCKCHAIN_API_KEY ?? '${ctx.apiKey}';

export async function syncDato({ datoId, tipo, payload, exists = false }) {
  const method = exists ? 'PUT' : 'POST';
  const url = exists
    ? \`\${BAAS_URL.replace(/\\\/+$/, '')}/datos/\${encodeURIComponent(datoId)}\`
    : \`\${BAAS_URL.replace(/\\\/+$/, '')}/datos\`;

  const res = await fetch(url, {
    method,
    headers: {
      'X-API-Key': BAAS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ datoId, tipo, payload }),
  });

  const body = await res.json().catch(() => ({}));

  if (res.status === 202) {
    // Integrador: pendiente de aprobación — no lanzar error
    return { pendiente: true, ...body };
  }

  if (!res.ok) {
    throw new Error(\`BaaS \${res.status}: \${JSON.stringify(body)}\`);
  }

  return body; // 201 → incluye txId
}`
}

export function buildNodeHookSnippet(ctx: OnboardingContext): string {
  const entity = ctx.entityName.trim() || 'Registro'
  const entityVar = entity.charAt(0).toLowerCase() + entity.slice(1)
  const field = ctx.businessIdField.trim() || 'id'
  return `// En tu route handler — DESPUÉS de await db.save(...) exitoso

import { syncDato } from './services/datosBaasClient.js';

async function on${entity}Saved(${entityVar}, { isUpdate = false } = {}) {
  const payload = build${entity}Snapshot(${entityVar}); // mapea campos del paso 2

  const result = await syncDato({
    datoId: ${entityVar}.${field},
    tipo: '${ctx.entityType}',
    payload,
    exists: isUpdate,
  });

  if (result.pendiente) {
    console.info('BaaS: cambio pendiente de aprobación', result.solicitudId);
    return;
  }

  // Opcional: await db.update(${entityVar}.${field}, { blockchainTxId: result.txId });
}

// NUNCA llames al middleware desde el navegador con la API key.`
}

export function buildIntegratorGuideMarkdown(
  ctx: OnboardingContext,
  curls: CurlExamples,
  repoUrl?: string,
): string {
  const env = buildEnvSnippet(ctx)
  const mapping = buildMappingTable(ctx)
  const laravelClient = buildLaravelClientSnippet(ctx)
  const laravelHook = buildLaravelHookSnippet(ctx)
  const nodeClient = buildNodeClientSnippet(ctx)
  const nodeHook = buildNodeHookSnippet(ctx)

  return `# Paquete de integración BaaS — ${ctx.entityName || 'Sistema externo'}

> Generado desde el onboarding. Tu backend llama al BaaS; el BaaS **nunca** llama a tu sistema.

## 1) Qué necesitas del operador BaaS

| Entregable | Valor configurado |
|------------|-------------------|
| URL middleware | \`${ctx.baseUrl.replace(/\/+$/, '')}\` |
| API key | \`${ctx.apiKey}\` |
| Rol de la key | \`${ctx.apiKeyRole}\` |

${roleBehaviorNote(ctx.apiKeyRole)}

## 2) Variables en tu servidor (.env)

\`\`\`env
${env}
\`\`\`

## 3) Mapeo entidad → BaaS

\`\`\`text
${mapping}
\`\`\`

### Payload de ejemplo

\`\`\`json
${ctx.payloadExampleText}
\`\`\`

## 4) Probar con cURL (antes de programar)

\`\`\`bash
${curls.create}
\`\`\`

\`\`\`bash
${curls.update}
\`\`\`

\`\`\`bash
${curls.history}
\`\`\`

## 5) Laravel / PHP

### config/blockchain.php

\`\`\`php
${buildLaravelConfigSnippet(ctx)}
\`\`\`

### Cliente HTTP

\`\`\`php
${laravelClient}
\`\`\`

### Hook en controller

\`\`\`php
${laravelHook}
\`\`\`

## 6) Node.js

### Cliente

\`\`\`javascript
${nodeClient}
\`\`\`

### Hook

\`\`\`javascript
${nodeHook}
\`\`\`

## 7) Checklist

- [ ] Variables \`BLOCKCHAIN_*\` en .env del servidor (no en frontend)
- [ ] Campo \`${ctx.businessIdField}\` definido como \`datoId\`
- [ ] Llamada HTTP después de guardar en BD local
- [ ] Manejo de HTTP 202 (integrador) vs 201 (admin)
- [ ] cURL de prueba respondió OK

## 8) Manual completo

${integrationManualPath(repoUrl)}
`
}
