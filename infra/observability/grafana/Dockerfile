FROM grafana/grafana:13.0.3

ENV GF_PLUGINS_PREINSTALL_DISABLED=true
ENV GF_PLUGINS_PREINSTALL_AUTO_UPDATE=false

COPY infra/observability/grafana/provisioning/datasources /etc/grafana/provisioning/datasources

USER root

ENTRYPOINT ["/bin/sh", "-c", "mkdir -p /var/lib/grafana/plugins && chown -R 472:0 /var/lib/grafana && exec su grafana -s /bin/bash -c 'exec /run.sh'"]
