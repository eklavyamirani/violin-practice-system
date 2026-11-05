# violin-web: the static app for the app platform (app-platform record 0042).
# Unprivileged nginx (uid 101, port 8080, temp files in /tmp) so it runs with
# a read-only root; the platform mounts /runtime-config.json (sign-in for sync).
FROM docker.io/nginxinc/nginx-unprivileged:1.31.7-alpine@sha256:b5047b9b76845eac124358373c6852377c52e4b05834a47647e955dd91cb8f1e
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html mic-check.html *.js *.png /usr/share/nginx/html/
COPY packs/ /usr/share/nginx/html/packs/
EXPOSE 8080
