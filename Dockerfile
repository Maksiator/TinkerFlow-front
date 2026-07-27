# ETAP 1: Budowanie aplikacji (Node.js)
FROM node:26-alpine as build
WORKDIR /app

# Kopiujemy konfigurację i instalujemy zależności
COPY package.json package-lock.json ./
RUN npm install

# Kopiujemy resztę kodu i budujemy wersję produkcyjną
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ETAP 2: Serwowanie plików (Nginx)
FROM nginx:alpine

# Kopiujemy skompilowane pliki z Etapu 1 do folderu Nginxa
# UWAGA: Jeśli używasz Vite, pliki budują się do folderu 'dist'. 
# Jeśli używasz Create React App, budują się do 'build'. 
# Zakładam Vite (dist), jeśli to CRA zmień /app/dist na /app/build
COPY --from=build /app/dist /usr/share/nginx/html

# Opcjonalnie: Kopiujemy konfigurację Nginxa, by React Router działał poprawnie (Nginx musi przekierowywać wszystko na index.html)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]