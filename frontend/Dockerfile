# hictx frontend: build the Vite SPA, serve it static with nginx.
# Built with no VITE_API_BASE_URL, so the app calls same-origin "/api" — the
# Ingress routes /api to the API service, everything else to this SPA.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
