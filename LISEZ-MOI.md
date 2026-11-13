# RESTAURANT LACOUR — version PHP + MySQL

## Architecture
- Frontend conservé : HTML, CSS et JavaScript dans `public/`.
- Backend : `public/api.php` (PHP 8.1+).
- Stockage : MySQL exclusivement, dans `app_docs` (données métier), `app_codes` (les deux codes d'accès) et `app_limits` (limitation des commandes).
- Plus de Node.js, de `db.json` ni de `config.json`.

## Installation
1. Créez une base MySQL et importez `database.sql` (phpMyAdmin ou `mysql < database.sql`).
2. Configurez les variables d'environnement PHP/serveur :
   - `DB_DSN=mysql:host=localhost;dbname=lacour;charset=utf8mb4`
   - `DB_USER=...`
   - `DB_PASS=...`
3. Placez le contenu du dossier `public/` dans le document root du site. Activez `mod_rewrite` et autorisez `.htaccess`.
4. Vérifiez que PHP PDO MySQL est activé et que le serveur web peut lire les fichiers.
5. Les codes sont enregistrés dans MySQL : administrateur `admin123` et employés `employ123`. Le backend les réimpose également au démarrage de chaque requête API afin qu’ils restent fixes.

## Accès
- Le code administrateur donne le niveau 2.
- Le code employés donne le niveau 1.
- Les employés gardent leur profil individuel et leur PIN comme avant : le PIN n'est pas remplacé par le code commun.
- Les codes sont fixes : `admin123` pour l’administrateur et `employ123` pour les employés. L’interface ne propose aucune génération ni modification de ces codes.

## Livreurs
- Créez les livreurs dans Équipe avec le rôle « Livreur » et un PIN personnel.
- Leur écran « Mes livraisons » ne montre que les commandes qui leur sont assignées.
- Dans Livraisons, le responsable affecte une commande à un livreur libre.
- Lors de l'affectation, son état passe à `occupé`. Lorsqu'il confirme la livraison, l'état revient à `libre`.
- L'état est conservé avec la fiche de l'employé en base de données.

## Limites à finaliser avant mise en production
- La récupération du PIN et l'envoi des codes par e-mail sont désactivés dans ce portage (les routes répondent clairement qu'un SMTP PHP doit être configuré). Le flux PIN local et le contrôle par PIN restent inchangés.
- Le flux temps réel est compatible SSE avec une vérification des changements périodique. Selon l'hébergeur, il peut être nécessaire d'ajuster le délai d'exécution PHP et le proxy.
- Le code d'accès employés est commun, mais chaque employé reste identifié par son propre profil + PIN.
- Les données historiques JSON/Firestore ne sont pas importées automatiquement. Importez-les via l'outil d'import existant de l'application ou demandez une migration dédiée avant bascule.
- Faites une sauvegarde MySQL quotidienne. Ne publiez jamais les codes d'accès dans le dépôt Git.
