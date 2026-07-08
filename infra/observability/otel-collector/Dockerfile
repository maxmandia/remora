FROM otel/opentelemetry-collector-contrib:0.155.0

COPY infra/observability/otel-collector/otel-collector.yaml /etc/otelcol-contrib/config.yaml

CMD ["--config=/etc/otelcol-contrib/config.yaml"]
