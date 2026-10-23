# Deploying hictx to Kubernetes

Manifests to run hictx in a cluster, with the API **horizontally autoscaled** when
it's under load.

```
k8s/
  00-config.yaml      Namespace, ConfigMap, Secret template
  10-postgres.yaml    In-cluster Postgres (swap for a managed DB in prod)
  20-clones-pvc.yaml  Shared volume for the persistent git clones (RWX)
  30-migrate-job.yaml Runs `manage.py migrate`
  40-api.yaml         Django/gunicorn Deployment + Service (CPU requests + probes)
  41-api-hpa.yaml     HorizontalPodAutoscaler  ← scales the API when it's "full"
  50-frontend.yaml    Nginx-served SPA Deployment + Service
  60-ingress.yaml     /api → API, everything else → SPA
```

## 1. Build & push the images
```bash
# from the repo root
docker build -t REGISTRY/hictx-api:latest      workload
docker build -t REGISTRY/hictx-frontend:latest frontend
docker push REGISTRY/hictx-api:latest
docker push REGISTRY/hictx-frontend:latest
```
Then replace `REGISTRY` in `30-migrate-job.yaml`, `40-api.yaml`, `50-frontend.yaml`
(e.g. `sed -i 's#REGISTRY#ghcr.io/you#g' k8s/*.yaml`).

## 2. Create the real Secret (don't use the template values)
```bash
kubectl create namespace hictx
kubectl -n hictx create secret generic hictx-secrets \
  --from-literal=DJANGO_SECRET_KEY="$(openssl rand -base64 48)" \
  --from-literal=POSTGRES_PASSWORD="$(openssl rand -base64 24)"
```
(Then remove the Secret block from `00-config.yaml`, or let this overwrite it.)

## 3. Apply
```bash
kubectl apply -f k8s/00-config.yaml
kubectl apply -f k8s/10-postgres.yaml
kubectl apply -f k8s/20-clones-pvc.yaml
kubectl apply -f k8s/40-api.yaml -f k8s/41-api-hpa.yaml -f k8s/50-frontend.yaml -f k8s/60-ingress.yaml
kubectl -n hictx apply -f k8s/30-migrate-job.yaml   # after the API image exists
```

## How the autoscaling works
- Each API pod declares `requests.cpu: 250m`. The **HPA** (`41-api-hpa.yaml`) adds
  replicas when average CPU crosses **70%** of that (or memory 80%), between
  **2 and 10** pods, reacting fast on spikes and scaling down slowly.
- The API pod's **readiness probe** (`/api/`) pulls a saturated or starting pod out
  of the Service, so traffic only goes to pods that can serve — while the HPA spins
  up more. Together: a "full" api server sheds load *and* triggers scale-out.
- Watch it: `kubectl -n hictx get hpa hictx-api -w` and `kubectl -n hictx top pods`.

**Requires `metrics-server`** in the cluster (so `kubectl top` works).

## Honest caveats (see ../ROADMAP.md)
- **Shared clones volume must be RWX.** The API runs ingestion in-process and
  writes persistent git clones to `GRAPH_CLONE_ROOT`. With multiple replicas that
  volume needs `ReadWriteMany` (EFS / Azure Files / Filestore / NFS). If you only
  have `ReadWriteOnce`, either keep the API at 1 replica, or **split ingestion into
  its own single-replica worker Deployment** (the proper fix — ingestion/sessions
  should move off the web process to a real queue/worker).
- **Postgres here is a single-replica demo.** Use a managed database in production
  and just point `POSTGRES_HOST` at it (then delete `10-postgres.yaml`).
- **Static files**: the JSON API needs none; the Django admin / DRF browsable UI do.
  Add `collectstatic` + a static serve (e.g. WhiteNoise) if you need them.
- LLM keys can be set in-app (Settings) or via the Secret; an env var overrides a
  stored key.
