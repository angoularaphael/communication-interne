# Messaging Service — Documentation technique

> Microservice de messagerie pour **DANEBCYS**.  
> Conversations par annonce entre acheteur et vendeur.  
> WebSocket pour réception des messages en temps réel (sans rechargement).

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture du projet](#2-architecture-du-projet)
3. [WebSocket temps réel](#3-websocket-temps-réel)
4. [Schéma MongoDB](#4-schéma-mongodb)
5. [Endpoints API](#5-endpoints-api)
6. [Routes internes](#6-routes-internes)
7. [Variables d'environnement](#7-variables-denvironnement)
8. [Installation et lancement](#8-installation-et-lancement)

---

## 1. Vue d'ensemble

| Fonctionnalité | Technologie |
|----------------|-------------|
| Conversations | Par annonce (ad_id), thread_code unique |
| Envoi message | POST /:adId avec contenu |
| Boîte de réception | Liste des conversations (inbox) |
| Fil de discussion | GET /thread/:threadCode |
| **Temps réel** | WebSocket pour réception instantanée |
| Authentification | Bearer token via Auth-service |
| Rate limiting | In-memory, user ID |

**Port** : 3006  
**Base de données** : MongoDB (collection `messages`)

---

## 2. Architecture du projet

```
Messaging-service/
├── src/
│   ├── config/
│   │   ├── env.js
│   │   └── mongodb.js
│   ├── controllers/
│   │   └── message.controller.js
│   ├── middlewares/
│   │   ├── auth.js
│   │   ├── rateLimiter.js
│   │   └── serviceAuth.js
│   ├── routes/
│   │   ├── message.routes.js    # /api/v1/messages
│   │   └── internal.routes.js   # /internal
│   ├── services/
│   │   ├── authClient.js
│   │   ├── productsClient.js
│   │   └── message.service.js
│   ├── websocket/
│   │   └── wsServer.js          # WebSocket temps réel
│   ├── utils/
│   │   └── errors.js
│   └── app.js
├── public/
│   ├── index.html
│   └── test.js
├── server.js
├── .env
└── package.json
```

---

## 3. WebSocket temps réel

Le client se connecte à `ws://host:3006/ws?token=ACCESS_TOKEN`. À chaque nouveau message reçu :

1. Le serveur envoie immédiatement le message au destinataire via `broadcastToUser(receiverId, payload)`
2. Le destinataire ne doit pas recharger la page pour voir les nouveaux messages

**Authentification** : Token JWT en query param `?token=...`, validé via Auth-service.

**Flux** :
- L'acheteur initie la conversation en envoyant un message sur une annonce
- Le vendeur ne peut pas initier : il doit attendre une première question
- Le `thread_code` est généré de manière déterministe : `adId_sortedUserA_sortedUserB`

---

## 4. Schéma MongoDB

### Collection `messages`

| Champ | Type | Description |
|-------|------|-------------|
| _id | ObjectId | ID MongoDB (exposé comme messageId) |
| ad_id | String | ID de l'annonce/produit |
| thread_code | String | Identifiant unique de la conversation |
| sender_id | String | UUID de l'expéditeur |
| receiver_id | String | UUID du destinataire |
| content | String | Contenu du message |
| is_read | Boolean | Lu ou non |
| deleted | Boolean | Soft delete |
| created_at | Date | Date de création |

---

## 5. Endpoints API

### Routes publiques — `/api/v1/messages` (auth requise)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | /inbox | Liste des conversations (page, limit) |
| GET | /unread/count | Nombre de messages non lus |
| GET | /thread/:threadCode | Fil de discussion complet |
| PUT | /:messageId/read | Marquer un message comme lu |
| POST | /:adId | Envoyer un message (initie ou continue conversation) |
| GET | /:adId | Messages d'une annonce (conversation existante) |

**Note** : L'ID du message est exposé dans la réponse sous la clé `messageId` (correspond à `_id` MongoDB).

---

## 6. Routes internes

Protégées par `X-Service-Key`.

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | /internal/... | (selon implémentation) |

---

## 7. Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| PORT | Port du serveur | 3006 |
| NODE_ENV | Environnement | development |
| MONGO_URI | URI MongoDB | — |
| MONGO_DB_NAME | Nom de la base | danebcys |
| AUTH_SERVICE_URL | URL Auth-service | http://localhost:3001 |
| PRODUCTS_SERVICE_URL | URL Products-service | http://localhost:3004 |
| INTER_SERVICE_KEY | Clé inter-services | — |
| RATE_LIMIT_WINDOW_MS | Fenêtre rate limit | 900000 |
| RATE_LIMIT_MAX_REQUESTS | Max requêtes par fenêtre | 100 |

---

## 8. Installation et lancement

```bash
cd Messaging-service
npm install
npm start
```

Nécessite : Auth-service (3001), Products-service (3004), MongoDB.

---

## Récapitulatif

| Couche | Technologie |
|--------|-------------|
| Stockage | MongoDB (collection messages) |
| Temps réel | WebSocket (ws) |
| Auth | Auth-service (validate-token) |
| Produits | Products-service (vérifier annonce, vendeur) |
| Rate limiting | Maison, user ID |
