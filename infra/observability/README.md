# Remora Observability on Railway

This stack self-hosts trace collection and viewing for Remora:

- `remora-otel-collector` accepts OTLP from Remora services.
- `remora-tempo` stores traces in S3-compatible object storage.
- `remora-grafana` exposes the trace UI.

Logs stay in Railway. Remora logs include `trace_id` and `span_id`, so use Grafana to find traces and Railway Log Explorer to search matching log lines.

## Railway services

Create these services once in staging and once in production. Each service should use this repository, with its Railway root directory and config file path set to the matching folder:

| Railway service | Root directory | Config file path | Public domain | Volume mount |
| --- | --- | --- | --- | --- |
| `remora-tempo` | `infra/observability/tempo` | `railway.json` | No | `/var/tempo` |
| `remora-otel-collector` | `infra/observability/otel-collector` | `railway.json` | No | None |
| `remora-grafana` | `infra/observability/grafana` | `railway.json` | Yes | `/var/lib/grafana` |

Railway config-as-code controls the build and deploy settings for a service. It does not create the services, variables, volumes, or domains by itself.

Keep the service names exact because the checked-in config uses Railway private DNS names:

- `remora-tempo.railway.internal`
- `remora-otel-collector.railway.internal`

## Environment variables

Set these on `remora-tempo`:

```bash
PORT=3200
TEMPO_S3_BUCKET=remora-tempo-staging
TEMPO_S3_ENDPOINT=<cloudflare-account-id>.r2.cloudflarestorage.com
TEMPO_S3_REGION=auto
TEMPO_S3_ACCESS_KEY_ID=<r2-access-key-id>
TEMPO_S3_SECRET_ACCESS_KEY=<r2-secret-access-key>
TEMPO_BLOCK_RETENTION=72h
```

Use `TEMPO_S3_BUCKET=remora-tempo-production` and `TEMPO_BLOCK_RETENTION=336h` in production.

Set this on `remora-otel-collector`:

```bash
PORT=13133
```

Set these on `remora-grafana`:

```bash
PORT=3000
GF_SERVER_HTTP_ADDR=0.0.0.0
GF_SERVER_HTTP_PORT=3000
GF_SECURITY_ADMIN_USER=<admin-user>
GF_SECURITY_ADMIN_PASSWORD=<admin-password>
GF_SECURITY_SECRET_KEY=<random-secret-key>
GF_AUTH_ANONYMOUS_ENABLED=false
GF_USERS_ALLOW_SIGN_UP=false
GF_PLUGINS_PREINSTALL_DISABLED=true
GF_PLUGINS_PREINSTALL_AUTO_UPDATE=false
```

Set these on each Remora backend HTTP and worker service:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://remora-otel-collector.railway.internal:4318
OTEL_TRACES_EXPORTER=otlp
OTEL_SERVICE_NAME=remora-backend-http
LOG_LEVEL=info
```

Use `OTEL_SERVICE_NAME=remora-backend-worker` on the worker.

## Verification

Deploy staging first. After the three observability services are healthy, point only staging Remora services at the collector and trigger a real traced workflow such as a generation submission or provider callback.

In Grafana Explore, select the Tempo data source and search for `remora-backend-http` or `remora-backend-worker`. Copy a trace ID from Grafana, then search Railway logs for the same `trace_id`.
