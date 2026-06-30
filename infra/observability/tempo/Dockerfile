FROM busybox:1.37.0 AS tempo-dirs

RUN mkdir -p /var/tempo/wal /var/tempo/generator

FROM grafana/tempo:3.0.0

COPY --from=tempo-dirs --chown=10001:10001 /var/tempo /var/tempo
COPY --chown=10001:10001 tempo.yaml /etc/tempo/tempo.yaml
USER 10001

ENTRYPOINT ["/tempo"]
CMD ["-config.file=/etc/tempo/tempo.yaml", "-target=all", "-config.expand-env=true"]
