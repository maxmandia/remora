FROM grafana/grafana:13.0.3

ENV GF_PLUGINS_PREINSTALL_DISABLED=true
ENV GF_PLUGINS_PREINSTALL_AUTO_UPDATE=false

COPY provisioning/datasources /etc/grafana/provisioning/datasources
