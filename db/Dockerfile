# violin-db: the database image (app-platform record 0046, copied from its
# templates/postgrest-db/). psql from the same Postgres as the platform's CNPG
# clusters; the platform runs it as the app's uid with a read-only root.
FROM ghcr.io/cloudnative-pg/postgresql:18.6-minimal-trixie
COPY --chmod=0755 migrate.sh /usr/local/bin/migrate.sh
COPY migrations/ /db/migrations/
ENTRYPOINT ["/usr/local/bin/migrate.sh"]
