#!/bin/bash
# scripts/generate-supabase-types.sh
# Génère les types TypeScript depuis Supabase (source de vérité)
# À exécuter une seule fois après validation du schéma BDD

PROJECT_ID="aypyrwqghxkgehibkfob"  # Remplacer par ton project ID Supabase
OUTPUT_FILE="frontend/types/database.ts"

echo "⏳ Génération des types depuis Supabase..."
npx supabase gen types typescript \
  --project-id "$PROJECT_ID" \
  --schema public > "$OUTPUT_FILE"

if [ $? -eq 0 ]; then
  echo "✅ Types générés : $OUTPUT_FILE"
  echo "🔒 Ce fichier est READ-ONLY (généré depuis la BDD)"
  echo "⚠️  Ne JAMAIS modifier manuellement"
else
  echo "❌ Erreur lors de la génération"
  exit 1
fi
