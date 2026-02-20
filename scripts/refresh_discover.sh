#!/bin/bash
# Script pour rafraîchir les découvertes via l'API admin

set -e

# Couleurs pour l'output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

API_URL="${API_URL:-http://localhost:4000}"

echo -e "${BLUE}🎵 Rafraîchissement des découvertes MusicBoxd${NC}"
echo "=================================="

# Vérifier qu'on peut atteindre l'API
echo -e "${BLUE}Vérification de l'API...${NC}"
if ! curl -s "${API_URL}/health" > /dev/null 2>&1; then
    echo -e "${RED}❌ API non disponible à ${API_URL}${NC}"
    echo "Assurez-vous que le serveur API tourne:"
    echo "  cd api && npm run dev"
    exit 1
fi

echo -e "${GREEN}✅ API disponible${NC}"

# Vérifier qu'on peut récupérer un token
echo -e "${BLUE}Récupération d'un token d'admin...${NC}"

# Note: Ce script doit recevoir un JWT admin/service token via la variable
# d'environnement `ADMIN_TOKEN`. Il ne crée pas d'utilisateur admin.
if [ -z "$ADMIN_TOKEN" ]; then
    echo -e "${RED}❌ ADMIN_TOKEN non défini${NC}"
    echo "Options:"
    echo "  1. Exporter un JWT token: export ADMIN_TOKEN='eyJ...'"
    echo "  2. Utiliser Postman pour appeler l'endpoint"
    exit 1
fi

echo -e "${GREEN}✅ Token trouvé${NC}"

# Appeler l'endpoint
echo -e "${BLUE}Rafraîchissement des découvertes...${NC}"

RESPONSE=$(curl -s -X POST "${API_URL}/admin/discover/refresh-enhanced" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}")

echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

# Vérifier si succès
if echo "$RESPONSE" | grep -q "enhanced + refreshed"; then
    echo -e "${GREEN}✅ Découvertes rafraîchies avec succès!${NC}"
    exit 0
else
    echo -e "${RED}❌ Erreur lors du rafraîchissement${NC}"
    exit 1
fi
