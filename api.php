<?php
// ─────────────────────────────────────────────
//  api.php – Dispatcher unique pour toutes les routes /api/*
// ─────────────────────────────────────────────

// Garantir que toute erreur PHP sort en JSON (jamais en HTML)
ini_set('display_errors', '0');
set_exception_handler(function (Throwable $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Erreur serveur: ' . $e->getMessage()]);
    exit;
});
set_error_handler(function (int $errno, string $errstr) {
    throw new \ErrorException($errstr, 0, $errno);
});

require_once __DIR__ . '/config.php';

// CORS headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS');
header('Access-Control-Allow-Headers: Authorization,Content-Type');
if (getMethod() === 'OPTIONS') { http_response_code(204); exit; }

// Extraire le chemin de la route (ex: /api/auth/login → auth/login)
$requestUri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$path = preg_replace('#^/api/?#', '', $requestUri);
$path = trim($path, '/');
$method = getMethod();

// Dispatcher
if ($path === 'auth/login' && $method === 'POST') {
    route_auth_login();
} elseif ($path === 'auth/register' && $method === 'POST') {
    route_auth_register();
} elseif ($path === 'auth/forgot-password' && $method === 'POST') {
    route_auth_forgot_password();
} elseif ($path === 'auth/reset-password' && $method === 'POST') {
    route_auth_reset_password();
} elseif ($path === 'users/me' && $method === 'GET') {
    route_users_me_get();
} elseif ($path === 'users/me' && $method === 'PUT') {
    route_users_me_put();
} elseif ($path === 'users/me/stats' && $method === 'GET') {
    route_users_me_stats();
} elseif ($path === 'sorties' && $method === 'GET') {
    route_sorties_list();
} elseif ($path === 'sorties' && $method === 'POST') {
    route_sorties_create();
} elseif (preg_match('#^sorties/(\d+)$#', $path, $m) && $method === 'GET') {
    route_sortie_get((int)$m[1]);
} elseif (preg_match('#^sorties/(\d+)$#', $path, $m) && $method === 'DELETE') {
    route_sortie_delete((int)$m[1]);
} elseif (preg_match('#^sorties/(\d+)/participate$#', $path, $m) && $method === 'POST') {
    route_sortie_participate((int)$m[1]);
} elseif (preg_match('#^sorties/(\d+)/participate$#', $path, $m) && $method === 'DELETE') {
    route_sortie_leave((int)$m[1]);
} elseif (preg_match('#^sorties/(\d+)/chat$#', $path, $m) && $method === 'GET') {
    route_chat_get((int)$m[1]);
} elseif (preg_match('#^sorties/(\d+)/chat$#', $path, $m) && $method === 'POST') {
    route_chat_post((int)$m[1]);
} elseif (preg_match('#^sorties/(\d+)/location$#', $path, $m) && $method === 'PUT') {
    route_sortie_location_put((int)$m[1]);
} elseif (preg_match('#^sorties/(\d+)/locations$#', $path, $m) && $method === 'GET') {
    route_sortie_locations_get((int)$m[1]);
} elseif ($path === 'notifications' && $method === 'GET') {
    route_notifications_get();
} elseif ($path === 'notifications/read' && $method === 'PUT') {
    route_notifications_read();
} elseif ($path === 'admin/stats' && $method === 'GET') {
    route_admin_stats();
} elseif ($path === 'admin/users' && $method === 'GET') {
    route_admin_users_list();
} elseif (preg_match('#^admin/users/(\d+)/validate$#', $path, $m) && $method === 'PUT') {
    route_admin_user_validate((int)$m[1]);
} elseif (preg_match('#^admin/users/(\d+)/role$#', $path, $m) && $method === 'PUT') {
    route_admin_user_role((int)$m[1]);
} elseif (preg_match('#^admin/users/(\d+)/block$#', $path, $m) && $method === 'PUT') {
    route_admin_user_block((int)$m[1]);
} elseif (preg_match('#^admin/users/(\d+)/group$#', $path, $m) && $method === 'PUT') {
    route_admin_user_assign_group((int)$m[1]);
} elseif (preg_match('#^admin/users/(\d+)$#', $path, $m) && $method === 'DELETE') {
    route_admin_user_delete((int)$m[1]);
} elseif ($path === 'admin/sorties' && $method === 'GET') {
    route_admin_sorties();
} elseif ($path === 'radar/positions' && $method === 'GET') {
    route_radar_positions();
} elseif ($path === 'radar/position' && $method === 'POST') {
    route_radar_position_post();
} elseif ($path === 'radar/position' && $method === 'DELETE') {
    route_radar_position_delete();
} elseif ($path === 'radar/sorties' && $method === 'GET') {
    route_radar_sorties();
} elseif ($path === 'dashboard' && $method === 'GET') {
    route_dashboard();
} elseif ($path === 'groups/public' && $method === 'GET') {
    route_groups_public();
} elseif ($path === 'groups' && $method === 'GET') {
    route_groups_list();
} elseif ($path === 'groups' && $method === 'POST') {
    route_groups_create();
} elseif (preg_match('#^groups/(\d+)$#', $path, $m) && $method === 'DELETE') {
    route_groups_delete((int)$m[1]);
} elseif (preg_match('#^groups/(\d+)/join$#', $path, $m) && $method === 'POST') {
    route_groups_join((int)$m[1]);
} elseif (preg_match('#^groups/(\d+)/leave$#', $path, $m) && $method === 'DELETE') {
    route_groups_leave((int)$m[1]);
} elseif ($path === 'admin/partners' && $method === 'GET') {
    route_admin_partners_list();
} elseif (preg_match('#^admin/partners/(\d+)/validate$#', $path, $m) && $method === 'PUT') {
    route_admin_partner_validate((int)$m[1]);
} elseif (preg_match('#^admin/partners/(\d+)/code$#', $path, $m) && $method === 'PUT') {
    route_admin_partner_regen_code((int)$m[1]);
} elseif (preg_match('#^admin/partners/(\d+)$#', $path, $m) && $method === 'DELETE') {
    route_admin_partner_delete((int)$m[1]);
} elseif ($path === 'partners' && $method === 'GET') {
    route_partners_list();
} elseif ($path === 'partners' && $method === 'POST') {
    route_partners_create();
} elseif ($path === 'partners/nearby' && $method === 'GET') {
    route_partners_nearby();
} elseif (preg_match('#^partners/(\d+)/offers$#', $path, $m) && $method === 'GET') {
    route_partner_offers_get((int)$m[1]);
} elseif (preg_match('#^partners/(\d+)$#', $path, $m) && $method === 'GET') {
    route_partner_get((int)$m[1]);
} elseif ($path === 'partner/login' && $method === 'POST') {
    route_partner_login();
} elseif ($path === 'partner/me' && $method === 'GET') {
    route_partner_me_get();
} elseif ($path === 'partner/me' && $method === 'PUT') {
    route_partner_me_put();
} elseif ($path === 'partner/offers' && $method === 'GET') {
    route_partner_my_offers();
} elseif ($path === 'partner/offers' && $method === 'POST') {
    route_partner_offer_create();
} elseif (preg_match('#^partner/offers/(\d+)$#', $path, $m) && $method === 'PUT') {
    route_partner_offer_update((int)$m[1]);
} elseif (preg_match('#^partner/offers/(\d+)$#', $path, $m) && $method === 'DELETE') {
    route_partner_offer_delete((int)$m[1]);
} elseif ($path === 'admin/groups' && $method === 'GET') {
    route_admin_groups_list();
} elseif ($path === 'admin/groups' && $method === 'POST') {
    route_admin_groups_create();
} elseif (preg_match('#^admin/groups/(\d+)$#', $path, $m) && $method === 'DELETE') {
    route_admin_groups_delete((int)$m[1]);
} elseif (preg_match('#^admin/groups/(\d+)/members$#', $path, $m) && $method === 'GET') {
    route_admin_groups_members((int)$m[1]);
} elseif (preg_match('#^admin/groups/(\d+)/members/(\d+)$#', $path, $m) && $method === 'DELETE') {
    route_admin_groups_remove_member((int)$m[1], (int)$m[2]);
} elseif ($path === 'spots' && $method === 'GET') {
    route_spots_list();
} elseif ($path === 'health' && $method === 'GET') {
    jsonResponse(['status' => 'ok', 'app' => 'Zot Ride']);
} else {
    jsonError('Route non trouvée', 404);
}

// ═══════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════

function route_auth_login(): void {
    $body = getBody();
    $email    = trim($body['email'] ?? '');
    $password = $body['password'] ?? '';
    if (!$email || !$password) jsonError('Email et mot de passe requis');

    $db = getDb();
    $st = $db->prepare("SELECT * FROM users WHERE email=?");
    $st->execute([$email]);
    $user = $st->fetch();

    if (!$user || !password_verify($password, $user['password'])) {
        jsonError('Email ou mot de passe incorrect', 401);
    }
    if (!empty($user['blocked'])) {
        jsonError('Compte suspendu. Contactez l\'administrateur.', 403);
    }
    if (!$user['validated']) {
        jsonError('Compte en attente de validation par l\'administrateur', 403);
    }

    $token = jwtEncode(['id' => $user['id'], 'email' => $user['email']]);
    jsonResponse([
        'token' => $token,
        'user'  => [
            'id'            => $user['id'],
            'pseudo'        => $user['pseudo'],
            'email'         => $user['email'],
            'role'          => $user['role'],
            'moto_marque'   => $user['moto_marque'],
            'moto_cylindree'=> $user['moto_cylindree'],
        ]
    ]);
}

function route_auth_register(): void {
    $body         = getBody();
    $pseudo       = trim($body['pseudo'] ?? '');
    $email        = trim($body['email'] ?? '');
    $password     = $body['password'] ?? '';
    $moto_marque  = trim($body['moto_marque'] ?? '');
    $moto_cc      = (int)($body['moto_cylindree'] ?? 0);

    if (!$pseudo || !$email || !$password) jsonError('Pseudo, email et mot de passe requis');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) jsonError('Email invalide');
    if (strlen($password) < 6) jsonError('Mot de passe trop court (6 caractères min)');

    $db   = getDb();
    $exist = $db->prepare("SELECT id FROM users WHERE email=? OR pseudo=?");
    $exist->execute([$email, $pseudo]);
    if ($exist->fetch()) jsonError('Email ou pseudo déjà utilisé', 409);

    $hash = password_hash($password, PASSWORD_BCRYPT);
    $st   = $db->prepare("INSERT INTO users (pseudo,email,password,moto_marque,moto_cylindree,role,validated) VALUES (?,?,?,?,?,'participant',0)");
    $st->execute([$pseudo, $email, $hash, $moto_marque, $moto_cc]);
    $newUserId = (int)$db->lastInsertId();
    $groupId   = (int)($body['group_id'] ?? 0);
    if ($groupId > 0) {
        // Vérifier que le groupe existe
        $g = $db->prepare("SELECT id FROM `groups` WHERE id=?");
        $g->execute([$groupId]);
        if ($g->fetch()) {
            $db->prepare("INSERT IGNORE INTO group_members (group_id, user_id) VALUES (?,?)")
               ->execute([$groupId, $newUserId]);
        }
    }

    notifyAdmins("Nouvelle inscription : $pseudo ($email)", 'new_user', $newUserId);
    jsonResponse(['message' => 'Inscription réussie. En attente de validation par l\'administrateur.'], 201);
}

function route_auth_forgot_password(): void {
    $body  = getBody();
    $email = strtolower(trim($body['email'] ?? ''));
    if (!$email) jsonError('Email requis');

    $db   = getDb();
    $user = $db->prepare("SELECT id, pseudo FROM users WHERE email=? AND blocked=0");
    $user->execute([$email]);
    $user = $user->fetch();

    // Toujours répondre OK pour ne pas révéler si l'email existe
    if (!$user) {
        jsonResponse(['message' => 'Si cet email est enregistré, vous recevrez un lien de réinitialisation.']);
    }

    // Invalider les anciens tokens
    $db->prepare("UPDATE password_resets SET used=1 WHERE email=?")->execute([$email]);

    // Générer un token sécurisé
    $token     = bin2hex(random_bytes(32));
    $expiresAt = date('Y-m-d H:i:s', time() + 3600); // 1h

    $db->prepare("INSERT INTO password_resets (email, token, expires_at) VALUES (?,?,?)")
       ->execute([$email, $token, $expiresAt]);

    $link = 'https://zotride.fr/?token=' . $token;
    sendEmail($email, 'Réinitialisation de mot de passe – Zot Ride', emailResetPassword($user['pseudo'], $link));

    jsonResponse(['message' => 'Si cet email est enregistré, vous recevrez un lien de réinitialisation.']);
}

function route_auth_reset_password(): void {
    $body     = getBody();
    $token    = trim($body['token'] ?? '');
    $password = $body['password'] ?? '';

    if (!$token || strlen($password) < 6) jsonError('Token et mot de passe (min 6 caractères) requis');

    $db = getDb();
    $st = $db->prepare("SELECT * FROM password_resets WHERE token=? AND used=0 AND expires_at > NOW()");
    $st->execute([$token]);
    $reset = $st->fetch();

    if (!$reset) jsonError('Lien invalide ou expiré. Faites une nouvelle demande.', 400);

    $hash = password_hash($password, PASSWORD_BCRYPT);
    $db->prepare("UPDATE users SET password=? WHERE email=?")->execute([$hash, $reset['email']]);
    $db->prepare("UPDATE password_resets SET used=1 WHERE token=?")->execute([$token]);

    jsonResponse(['message' => 'Mot de passe mis à jour. Vous pouvez maintenant vous connecter.']);
}

// ═══════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════

function route_users_me_get(): void {
    $user = requireAuth();
    $db   = getDb();
    $st   = $db->prepare("SELECT id,pseudo,email,moto_marque,moto_cylindree,role,validated,created_at FROM users WHERE id=?");
    $st->execute([$user['id']]);
    jsonResponse($st->fetch());
}

function route_users_me_put(): void {
    $user = requireAuth();
    $body = getBody();
    $pseudo  = trim($body['pseudo'] ?? '');
    $marque  = trim($body['moto_marque'] ?? '');
    $cc      = (int)($body['moto_cylindree'] ?? 0);
    $password= $body['password'] ?? '';

    if (!$pseudo) jsonError('Pseudo requis');

    $db = getDb();
    // Vérifier unicité pseudo
    $check = $db->prepare("SELECT id FROM users WHERE pseudo=? AND id!=?");
    $check->execute([$pseudo, $user['id']]);
    if ($check->fetch()) jsonError('Pseudo déjà utilisé', 409);

    if ($password) {
        $hash = password_hash($password, PASSWORD_BCRYPT);
        $st   = $db->prepare("UPDATE users SET pseudo=?,moto_marque=?,moto_cylindree=?,password=? WHERE id=?");
        $st->execute([$pseudo, $marque, $cc, $hash, $user['id']]);
    } else {
        $st = $db->prepare("UPDATE users SET pseudo=?,moto_marque=?,moto_cylindree=? WHERE id=?");
        $st->execute([$pseudo, $marque, $cc, $user['id']]);
    }
    jsonResponse(['message' => 'Profil mis à jour']);
}

function route_users_me_stats(): void {
    $user = requireAuth();
    $db   = getDb();
    $created = $db->prepare("SELECT COUNT(*) FROM sorties WHERE created_by=?");
    $created->execute([$user['id']]);
    $joined  = $db->prepare("SELECT COUNT(*) FROM participants WHERE user_id=?");
    $joined->execute([$user['id']]);
    jsonResponse([
        'sortiesCreated' => (int)$created->fetchColumn(),
        'sortiesJoined'  => (int)$joined->fetchColumn(),
    ]);
}

// ═══════════════════════════════════════════════
// SORTIES
// ═══════════════════════════════════════════════

function route_sorties_list(): void {
    $user = requireAuth();
    $db   = getDb();

    $rows = $db->query("
        SELECT s.*, u.pseudo as creator_pseudo,
            (SELECT COUNT(*) FROM participants WHERE sortie_id=s.id) as nb_participants
        FROM sorties s
        JOIN users u ON u.id=s.created_by
        WHERE s.status='active'
        ORDER BY s.date ASC, s.heure ASC
    ")->fetchAll();

    foreach ($rows as &$r) {
        $st = $db->prepare("SELECT lat,lng,nom,ordre,is_rassemblement FROM waypoints WHERE sortie_id=? ORDER BY ordre");
        $st->execute([$r['id']]);
        $r['waypoints']      = $st->fetchAll();
        $r['nb_participants'] = (int)$r['nb_participants'];

        $pp = $db->prepare("SELECT COUNT(*) FROM participants WHERE sortie_id=? AND user_id=?");
        $pp->execute([$r['id'], $user['id']]);
        $r['isParticipant'] = (bool)$pp->fetchColumn();

        $r['isCreator'] = ((int)$r['created_by'] === (int)$user['id']);
    }
    jsonResponse($rows);
}

function route_sorties_create(): void {
    $user = requireOrgOrAdmin();
    if (roleLevel($user['role']) < 2) jsonError('Seuls les organisateurs peuvent créer des sorties', 403);
    $body = getBody();

    $titre  = trim($body['titre'] ?? '');
    $desc   = trim($body['description'] ?? '');
    $date   = trim($body['date'] ?? '');
    $heure  = trim($body['heure'] ?? '09:00');
    $max    = (int)($body['nb_max_participants'] ?? 20);
    $wpts   = $body['waypoints'] ?? [];

    if (!$titre || !$date) jsonError('Titre et date requis');
    if (!$wpts || !count($wpts)) jsonError('Au moins un waypoint (point de rassemblement) requis');

    $db = getDb();
    $st = $db->prepare("INSERT INTO sorties (titre,description,date,heure,nb_max_participants,created_by) VALUES (?,?,?,?,?,?)");
    $st->execute([$titre, $desc, $date, $heure, $max, $user['id']]);
    $sortieId = (int)$db->lastInsertId();

    foreach ($wpts as $i => $w) {
        $wst = $db->prepare("INSERT INTO waypoints (sortie_id,lat,lng,nom,ordre,is_rassemblement) VALUES (?,?,?,?,?,?)");
        $wst->execute([$sortieId, $w['lat'], $w['lng'], $w['nom'] ?? '', $i, $i === 0 ? 1 : 0]);
    }

    // Ajouter le créateur comme participant
    $pp = $db->prepare("INSERT IGNORE INTO participants (sortie_id,user_id) VALUES (?,?)");
    $pp->execute([$sortieId, $user['id']]);

    // Notifier tous les membres validés
    notifyAllUsers("Nouvelle sortie : $titre le $date à $heure", 'new_sortie', $user['id']);
    // Envoyer emails à tous les membres validés
    $mbrs = $db->prepare("SELECT email, pseudo FROM users WHERE validated=1 AND blocked=0 AND id!=?");
    $mbrs->execute([$user['id']]);
    foreach ($mbrs->fetchAll() as $m) {
        sendEmail($m['email'], "Nouvelle sortie : $titre", emailNouvelleSortie($titre, $date, $heure, $user['pseudo']));
    }
    jsonResponse(['id' => $sortieId, 'message' => 'Sortie créée'], 201);
}

function route_sortie_get(int $id): void {
    $user = requireAuth();
    $db   = getDb();

    $st = $db->prepare("
        SELECT s.*, u.pseudo as creator_pseudo,
            (SELECT COUNT(*) FROM participants WHERE sortie_id=s.id) as nb_participants
        FROM sorties s
        JOIN users u ON u.id=s.created_by
        WHERE s.id=?
    ");
    $st->execute([$id]);
    $sortie = $st->fetch();
    if (!$sortie) jsonError('Sortie introuvable', 404);

    $wst = $db->prepare("SELECT lat,lng,nom,ordre,is_rassemblement FROM waypoints WHERE sortie_id=? ORDER BY ordre");
    $wst->execute([$id]);
    $sortie['waypoints'] = $wst->fetchAll();

    $pst = $db->prepare("SELECT u.id,u.pseudo,u.moto_marque,u.moto_cylindree FROM participants p JOIN users u ON u.id=p.user_id WHERE p.sortie_id=?");
    $pst->execute([$id]);
    $sortie['participants'] = $pst->fetchAll();

    $pp = $db->prepare("SELECT COUNT(*) FROM participants WHERE sortie_id=? AND user_id=?");
    $pp->execute([$id, $user['id']]);
    $sortie['isParticipant'] = (bool)$pp->fetchColumn();
    $sortie['isCreator']     = ((int)$sortie['created_by'] === (int)$user['id']);
    $sortie['nb_participants']= (int)$sortie['nb_participants'];

    jsonResponse($sortie);
}

function route_sortie_delete(int $id): void {
    $user = requireAuth();
    $db   = getDb();

    $st = $db->prepare("SELECT * FROM sorties WHERE id=?");
    $st->execute([$id]);
    $sortie = $st->fetch();
    if (!$sortie) jsonError('Sortie introuvable', 404);

    $isAdmin = in_array($user['role'], ['admin', 'superadmin']);
    if ((int)$sortie['created_by'] !== (int)$user['id'] && !$isAdmin) {
        jsonError('Non autorisé', 403);
    }

    $db->prepare("DELETE FROM sorties WHERE id=?")->execute([$id]);
    jsonResponse(['message' => 'Sortie supprimée']);
}

function route_sortie_participate(int $id): void {
    $user = requireAuth();
    $db   = getDb();

    $st = $db->prepare("SELECT * FROM sorties WHERE id=? AND status='active'");
    $st->execute([$id]);
    $sortie = $st->fetch();
    if (!$sortie) jsonError('Sortie introuvable', 404);

    $cnt = $db->prepare("SELECT COUNT(*) FROM participants WHERE sortie_id=?");
    $cnt->execute([$id]);
    if ((int)$cnt->fetchColumn() >= (int)$sortie['nb_max_participants']) {
        jsonError('Sortie complète', 409);
    }

    $pp = $db->prepare("INSERT IGNORE INTO participants (sortie_id,user_id) VALUES (?,?)");
    $pp->execute([$id, $user['id']]);

    // Notifier l'organisateur
    $pst = $db->prepare("SELECT pseudo FROM users WHERE id=?");
    $pst->execute([$user['id']]);
    $pseudo = $pst->fetchColumn();
    if ((int)$sortie['created_by'] !== (int)$user['id']) {
        notify((int)$sortie['created_by'], "$pseudo a rejoint votre sortie : {$sortie['titre']}", 'new_participant');
    }

    jsonResponse(['message' => 'Participation enregistrée']);
}

function route_sortie_leave(int $id): void {
    $user = requireAuth();
    $db   = getDb();
    $db->prepare("DELETE FROM participants WHERE sortie_id=? AND user_id=?")->execute([$id, $user['id']]);
    jsonResponse(['message' => 'Participation annulée']);
}

function route_sortie_location_put(int $id): void {
    $user = requireAuth();
    $body = getBody();
    $lat  = (float)($body['lat'] ?? 0);
    $lng  = (float)($body['lng'] ?? 0);
    if (!$lat || !$lng) jsonError('Coordonnées requises');

    $db = getDb();
    $st = $db->prepare("INSERT INTO participant_locations (sortie_id,user_id,lat,lng) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE lat=VALUES(lat),lng=VALUES(lng),updated_at=NOW()");
    $st->execute([$id, $user['id'], $lat, $lng]);
    jsonResponse(['ok' => true]);
}

function route_sortie_locations_get(int $id): void {
    requireAuth();
    $db  = getDb();
    $cutoff = date('Y-m-d H:i:s', time() - 300); // 5 min
    $st  = $db->prepare("
        SELECT pl.lat,pl.lng,pl.updated_at,u.pseudo,u.moto_marque,u.moto_cylindree,u.id as user_id
        FROM participant_locations pl
        JOIN users u ON u.id=pl.user_id
        WHERE pl.sortie_id=? AND pl.updated_at >= ?
    ");
    $st->execute([$id, $cutoff]);
    jsonResponse($st->fetchAll());
}

// ═══════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════

function route_notifications_get(): void {
    $user = requireAuth();
    $db   = getDb();

    $st = $db->prepare("SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50");
    $st->execute([$user['id']]);
    $notifs = $st->fetchAll();

    $ust = $db->prepare("SELECT COUNT(*) FROM notifications WHERE user_id=? AND `read`=0");
    $ust->execute([$user['id']]);
    $unread = (int)$ust->fetchColumn();

    // Marquer comme lues
    $db->prepare("UPDATE notifications SET `read`=1 WHERE user_id=?")->execute([$user['id']]);

    jsonResponse(['notifications' => $notifs, 'unreadCount' => $unread]);
}

function route_notifications_read(): void {
    $user = requireAuth();
    $db   = getDb();
    $db->prepare("UPDATE notifications SET `read`=1 WHERE user_id=?")->execute([$user['id']]);
    jsonResponse(['message' => 'Toutes les notifications lues']);
}

// ═══════════════════════════════════════════════
// ADMIN
// ═══════════════════════════════════════════════

function route_admin_stats(): void {
    $actor = requireOrgOrAdmin();
    $db = getDb();
    $actorLevel = roleLevel($actor['role']);

    // Compter uniquement les utilisateurs visibles par ce rôle
    if ($actorLevel >= 3) {
        $totalUsers   = (int)$db->query("SELECT COUNT(*) FROM users WHERE role NOT IN ('superadmin')")->fetchColumn();
        $pendingUsers = (int)$db->query("SELECT COUNT(*) FROM users WHERE validated=0 AND role NOT IN ('superadmin','admin')")->fetchColumn();
    } else {
        $totalUsers   = (int)$db->query("SELECT COUNT(*) FROM users WHERE role='participant'")->fetchColumn();
        $pendingUsers = (int)$db->query("SELECT COUNT(*) FROM users WHERE validated=0 AND role='participant'")->fetchColumn();
    }
    jsonResponse([
        'totalUsers'    => $totalUsers,
        'pendingUsers'  => $pendingUsers,
        'totalSorties'  => (int)$db->query("SELECT COUNT(*) FROM sorties")->fetchColumn(),
        'activeSorties' => (int)$db->query("SELECT COUNT(*) FROM sorties WHERE status='active' AND date >= CURDATE()")->fetchColumn(),
    ]);
}

function route_admin_users_list(): void {
    $actor = requireOrgOrAdmin();
    $db    = getDb();
    $actorLevel = roleLevel($actor['role']);

    $groupJoin = "LEFT JOIN group_members gm ON gm.user_id=u.id LEFT JOIN `groups` g ON g.id=gm.group_id";
    $cols = "u.id,u.pseudo,u.email,u.moto_marque,u.moto_cylindree,u.role,u.validated,u.blocked,u.created_at,gm.group_id,g.nom as group_nom";

    if ($actorLevel >= 4) {
        $rows = $db->prepare("SELECT $cols FROM users u $groupJoin WHERE u.id!=? ORDER BY u.validated ASC, u.created_at DESC");
        $rows->execute([$actor['id']]);
    } elseif ($actorLevel >= 3) {
        $rows = $db->prepare("SELECT $cols FROM users u $groupJoin WHERE u.role NOT IN ('superadmin','admin') ORDER BY u.validated ASC, u.created_at DESC");
        $rows->execute([]);
    } else {
        $rows = $db->prepare("SELECT $cols FROM users u $groupJoin WHERE u.role NOT IN ('superadmin','admin','organisateur') ORDER BY u.validated ASC, u.created_at DESC");
        $rows->execute([]);
    }
    jsonResponse($rows->fetchAll());
}

function route_admin_user_validate(int $id): void {
    $actor = requireOrgOrAdmin();
    $body  = getBody();
    $role  = $body['role'] ?? 'participant';

    // Vérifier que le rôle demandé est valide
    $validRoles = ['participant', 'organisateur', 'admin'];
    if (!in_array($role, $validRoles, true)) jsonError('Rôle invalide');

    $actorLevel  = roleLevel($actor['role']);
    $targetLevel = roleLevel($role);

    // Ne peut attribuer qu'un rôle strictement inférieur au sien
    if ($targetLevel >= $actorLevel) {
        jsonError('Vous ne pouvez pas attribuer ce rôle', 403);
    }

    $db = getDb();
    $st = $db->prepare("SELECT * FROM users WHERE id=?");
    $st->execute([$id]);
    $target = $st->fetch();
    if (!$target) jsonError('Utilisateur introuvable', 404);

    $db->prepare("UPDATE users SET validated=1, role=? WHERE id=?")->execute([$role, $id]);
    $roleName = roleName($role);
    notify($id, "Votre compte a été validé en tant que $roleName. Bienvenue sur Zot Ride !", 'account_validated');
    sendEmail($target['email'], "Votre compte Zot Ride a été validé !", emailCompteValide($target['pseudo'], $roleName));
    jsonResponse(['message' => "Utilisateur validé en tant que $roleName"]);
}

function route_admin_user_role(int $id): void {
    $actor = requireOrgOrAdmin();
    $body  = getBody();
    $role  = $body['role'] ?? '';

    $validRoles = ['participant', 'organisateur', 'admin'];
    if (!in_array($role, $validRoles, true)) jsonError('Rôle invalide');

    $actorLevel  = roleLevel($actor['role']);
    $targetLevel = roleLevel($role);

    if ($targetLevel >= $actorLevel) jsonError('Vous ne pouvez pas attribuer ce rôle', 403);

    $db = getDb();
    $st = $db->prepare("SELECT * FROM users WHERE id=?");
    $st->execute([$id]);
    $target = $st->fetch();
    if (!$target) jsonError('Utilisateur introuvable', 404);
    if (roleLevel($target['role']) >= $actorLevel) jsonError('Vous ne pouvez pas modifier ce compte', 403);

    $db->prepare("UPDATE users SET role=? WHERE id=?")->execute([$role, $id]);
    jsonResponse(['message' => 'Rôle mis à jour']);
}

function route_admin_user_block(int $id): void {
    $actor = requireOrgOrAdmin();
    $db    = getDb();

    $st = $db->prepare("SELECT role, blocked FROM users WHERE id=?");
    $st->execute([$id]);
    $target = $st->fetch();
    if (!$target) jsonError('Utilisateur introuvable', 404);
    if (roleLevel($target['role']) >= roleLevel($actor['role'])) jsonError('Non autorisé', 403);

    $newBlocked = $target['blocked'] ? 0 : 1;
    $db->prepare("UPDATE users SET blocked=? WHERE id=?")->execute([$newBlocked, $id]);

    $msg = $newBlocked ? 'Compte suspendu' : 'Compte réactivé';
    jsonResponse(['message' => $msg, 'blocked' => (bool)$newBlocked]);
}

function route_admin_user_assign_group(int $userId): void {
    $actor = requireOrgOrAdmin();
    if (roleLevel($actor['role']) < 3) jsonError('Accès refusé', 403);
    $body    = getBody();
    $groupId = (int)($body['group_id'] ?? 0);
    $db      = getDb();

    // Retirer l'utilisateur de tous ses groupes existants
    $db->prepare("DELETE FROM group_members WHERE user_id=?")->execute([$userId]);

    // Ajouter au nouveau groupe si group_id > 0
    if ($groupId > 0) {
        $g = $db->prepare("SELECT id FROM `groups` WHERE id=?");
        $g->execute([$groupId]);
        if (!$g->fetch()) jsonError('Groupe introuvable', 404);
        $db->prepare("INSERT IGNORE INTO group_members (group_id, user_id) VALUES (?,?)")
           ->execute([$groupId, $userId]);
        jsonResponse(['message' => 'Membre assigné au groupe']);
    }
    jsonResponse(['message' => 'Membre retiré de tous les groupes']);
}

function route_admin_user_delete(int $id): void {
    $actor = requireOrgOrAdmin();
    $db    = getDb();

    $st = $db->prepare("SELECT role FROM users WHERE id=?");
    $st->execute([$id]);
    $target = $st->fetch();
    if (!$target) jsonError('Utilisateur introuvable', 404);
    if (roleLevel($target['role']) >= roleLevel($actor['role'])) jsonError('Non autorisé', 403);

    // Supprimer les données liées avant l'utilisateur (contraintes FK)
    $db->prepare("DELETE FROM notifications WHERE user_id=?")->execute([$id]);
    $db->prepare("DELETE FROM participants WHERE user_id=?")->execute([$id]);
    $db->prepare("DELETE FROM participant_locations WHERE user_id=?")->execute([$id]);
    $db->prepare("DELETE FROM users WHERE id=?")->execute([$id]);
    jsonResponse(['message' => 'Utilisateur supprimé']);
}

function route_admin_sorties(): void {
    requireOrgOrAdmin();
    $db   = getDb();
    $rows = $db->query("
        SELECT s.*,u.pseudo as creator_pseudo,
            (SELECT COUNT(*) FROM participants WHERE sortie_id=s.id) as nb_participants
        FROM sorties s
        JOIN users u ON u.id=s.created_by
        ORDER BY s.date DESC
    ")->fetchAll();
    jsonResponse($rows);
}

// ═══════════════════════════════════════════════
// RADAR (public, pas d'auth requise)
// ═══════════════════════════════════════════════

function route_radar_positions(): void {
    $db = getDb();
    $cutoff = date('Y-m-d H:i:s', time() - 1800); // 30 min
    $st = $db->prepare("SELECT session_id,pseudo,moto_marque,moto_cylindree,lat,lng,updated_at FROM radar_positions WHERE updated_at >= ?");
    $st->execute([$cutoff]);
    jsonResponse($st->fetchAll());
}

function route_radar_position_post(): void {
    $body      = getBody();
    $sessionId = trim($body['session_id'] ?? $body['sessionId'] ?? '');
    $pseudo    = trim($body['pseudo'] ?? '');
    $lat       = (float)($body['lat'] ?? 0);
    $lng       = (float)($body['lng'] ?? 0);
    $marque    = trim($body['moto_marque'] ?? '');
    $cc        = (int)($body['moto_cylindree'] ?? 0);

    if (!$sessionId || !$pseudo || !$lat || !$lng) jsonError('Données incomplètes');

    $db = getDb();
    $st = $db->prepare("INSERT INTO radar_positions (session_id,pseudo,moto_marque,moto_cylindree,lat,lng) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE pseudo=VALUES(pseudo),moto_marque=VALUES(moto_marque),moto_cylindree=VALUES(moto_cylindree),lat=VALUES(lat),lng=VALUES(lng),updated_at=NOW()");
    $st->execute([$sessionId, $pseudo, $marque, $cc, $lat, $lng]);
    jsonResponse(['ok' => true]);
}

function route_radar_position_delete(): void {
    $body      = getBody();
    $sessionId = trim($body['session_id'] ?? $body['sessionId'] ?? '');
    if (!$sessionId) jsonError('sessionId requis');

    $db = getDb();
    $db->prepare("DELETE FROM radar_positions WHERE session_id=?")->execute([$sessionId]);
    jsonResponse(['ok' => true]);
}

function route_radar_sorties(): void {
    $db  = getDb();
    $today = date('Y-m-d');
    $rows = $db->prepare("
        SELECT s.id, s.titre, s.date, s.heure, s.nb_max_participants,
            (SELECT COUNT(*) FROM participants WHERE sortie_id=s.id) as nb_participants,
            u.pseudo as organisateur,
            w.lat as rally_lat, w.lng as rally_lng, w.nom as rally_nom
        FROM sorties s
        LEFT JOIN users u ON u.id=s.created_by
        LEFT JOIN waypoints w ON w.sortie_id=s.id AND w.is_rassemblement=1
        WHERE s.date=? AND s.status='active'
        ORDER BY s.heure
    ");
    $rows->execute([$today]);
    jsonResponse($rows->fetchAll());
}

// ═══════════════════════════════════════════════
// DASHBOARD (données agrégées)
// ═══════════════════════════════════════════════

function route_dashboard(): void {
    $user = requireAuth();
    $db   = getDb();
    $uid  = $user['id'];
    $today = date('Y-m-d');

    // Mes prochaines sorties (organisateur ou participant, 30 jours)
    $st = $db->prepare("
        SELECT s.id, s.titre, s.description, s.date, s.heure, s.nb_max_participants,
               u.pseudo as organisateur,
               (SELECT COUNT(*) FROM participants WHERE sortie_id=s.id) as nb_participants,
               (SELECT COUNT(*) FROM participants WHERE sortie_id=s.id AND user_id=?) as is_participant
        FROM sorties s
        JOIN users u ON u.id=s.created_by
        WHERE s.status='active' AND s.date >= ?
          AND (s.created_by=? OR EXISTS(SELECT 1 FROM participants WHERE sortie_id=s.id AND user_id=?))
        ORDER BY s.date ASC, s.heure ASC
        LIMIT 5
    ");
    $st->execute([$uid, $today, $uid, $uid]);
    $myNextSorties = $st->fetchAll();

    // Toutes les sorties à venir (pour le flux)
    $st2 = $db->prepare("
        SELECT s.id, s.titre, s.date, s.heure, s.nb_max_participants,
               u.pseudo as organisateur,
               (SELECT COUNT(*) FROM participants WHERE sortie_id=s.id) as nb_participants
        FROM sorties s
        JOIN users u ON u.id=s.created_by
        WHERE s.status='active' AND s.date >= ?
        ORDER BY s.date ASC
        LIMIT 10
    ");
    $st2->execute([$today]);
    $allSorties = $st2->fetchAll();

    // Mes groupes
    $st3 = $db->prepare("
        SELECT g.id, g.nom, g.description,
               (SELECT COUNT(*) FROM group_members WHERE group_id=g.id) as nb_membres,
               gm.role as my_role
        FROM `groups` g
        JOIN group_members gm ON gm.group_id=g.id AND gm.user_id=?
        ORDER BY g.nom ASC
    ");
    $st3->execute([$uid]);
    $myGroups = $st3->fetchAll();

    // Partenaires validés
    $partners = $db->query("SELECT * FROM partners WHERE validated=1 ORDER BY categorie, nom")->fetchAll();

    // Spots
    $spots = $db->query("SELECT * FROM spots ORDER BY type, nom")->fetchAll();

    // Activité récente (dernières sorties créées + derniers inscrits)
    $st4 = $db->prepare("
        SELECT 'sortie' as type, s.id, s.titre as label, u.pseudo as actor, s.created_at as ts
        FROM sorties s JOIN users u ON u.id=s.created_by
        WHERE s.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        UNION ALL
        SELECT 'join' as type, p.sortie_id as id, s.titre as label, u.pseudo as actor, p.joined_at as ts
        FROM participants p
        JOIN sorties s ON s.id=p.sortie_id
        JOIN users u ON u.id=p.user_id
        WHERE p.joined_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ORDER BY ts DESC
        LIMIT 15
    ");
    $st4->execute();
    $recentActivity = $st4->fetchAll();

    jsonResponse(compact('myNextSorties','allSorties','myGroups','partners','spots','recentActivity'));
}

// ═══════════════════════════════════════════════
// GROUPES
// ═══════════════════════════════════════════════

function route_groups_public(): void {
    $db = getDb();
    $st = $db->query("SELECT id, nom, description, (SELECT COUNT(*) FROM group_members WHERE group_id=g.id) as nb_membres FROM `groups` g ORDER BY g.nom ASC");
    jsonResponse($st->fetchAll());
}

// ═══════════════════════════════════════════════
// CHAT ÉPHÉMÈRE (Pusher)
// ═══════════════════════════════════════════════

function route_chat_get(int $sortieId): void {
    requireAuth();
    $db = getDb();

    // Nettoyer les messages de sorties passées depuis plus de 24h
    $db->exec("DELETE cm FROM chat_messages cm
               JOIN sorties s ON s.id=cm.sortie_id
               WHERE s.date < DATE_SUB(CURDATE(), INTERVAL 1 DAY)");

    $st = $db->prepare("
        SELECT cm.id, cm.user_id, cm.pseudo, cm.message, cm.created_at
        FROM chat_messages cm
        WHERE cm.sortie_id=?
        ORDER BY cm.created_at ASC
        LIMIT 50
    ");
    $st->execute([$sortieId]);
    jsonResponse($st->fetchAll());
}

function route_chat_post(int $sortieId): void {
    $user = requireAuth();
    $body = getBody();
    $msg  = trim($body['message'] ?? '');

    if (!$msg)            jsonError('Message vide');
    if (mb_strlen($msg) > 500) jsonError('Message trop long (500 car. max)');

    // Vérifier que la sortie existe
    $db = getDb();
    $st = $db->prepare("SELECT id FROM sorties WHERE id=? AND status='active'");
    $st->execute([$sortieId]);
    if (!$st->fetch()) jsonError('Sortie introuvable', 404);

    // Sauvegarder le message
    $db->prepare("INSERT INTO chat_messages (sortie_id, user_id, pseudo, message) VALUES (?,?,?,?)")
       ->execute([$sortieId, $user['id'], $user['pseudo'], $msg]);
    $msgId = (int)$db->lastInsertId();

    // Garder uniquement les 50 derniers messages
    $db->prepare("DELETE FROM chat_messages WHERE sortie_id=? AND id NOT IN (
        SELECT id FROM (SELECT id FROM chat_messages WHERE sortie_id=? ORDER BY id DESC LIMIT 50) t
    )")->execute([$sortieId, $sortieId]);

    $payload = [
        'id'         => $msgId,
        'user_id'    => $user['id'],
        'pseudo'     => $user['pseudo'],
        'message'    => $msg,
        'created_at' => date('Y-m-d H:i:s'),
    ];

    // Déclencher l'événement Pusher
    pusherTrigger("sortie-{$sortieId}", 'new-message', $payload);

    jsonResponse(['message' => 'ok', 'data' => $payload], 201);
}

function route_groups_list(): void {
    $user = requireAuth();
    $db   = getDb();
    $st = $db->prepare("
        SELECT g.id, g.nom, g.description,
               (SELECT COUNT(*) FROM group_members WHERE group_id=g.id) as nb_membres,
               (SELECT COUNT(*) FROM group_members WHERE group_id=g.id AND user_id=?) as is_member,
               gm.role as my_role
        FROM `groups` g
        LEFT JOIN group_members gm ON gm.group_id=g.id AND gm.user_id=?
        ORDER BY g.nom ASC
    ");
    $st->execute([$user['id'], $user['id']]);
    jsonResponse($st->fetchAll());
}

function route_groups_create(): void {
    $user = requireAuth();
    $body = getBody();
    $nom  = trim($body['nom'] ?? '');
    $desc = trim($body['description'] ?? '');
    if (!$nom) jsonError('Nom du groupe requis');

    $db = getDb();
    $db->prepare("INSERT INTO `groups` (nom, description, created_by) VALUES (?,?,?)")
       ->execute([$nom, $desc, $user['id']]);
    $groupId = (int)$db->lastInsertId();
    // Le créateur est admin du groupe
    $db->prepare("INSERT INTO group_members (group_id, user_id, role) VALUES (?,?,'admin')")
       ->execute([$groupId, $user['id']]);
    jsonResponse(['message' => 'Groupe créé', 'id' => $groupId], 201);
}

function route_groups_delete(int $id): void {
    $user = requireAuth();
    $db   = getDb();
    $group = $db->prepare("SELECT * FROM `groups` WHERE id=?")->execute([$id]) ? null : null;
    $st = $db->prepare("SELECT * FROM `groups` WHERE id=?");
    $st->execute([$id]);
    $group = $st->fetch();
    if (!$group) jsonError('Groupe introuvable', 404);
    if ($group['created_by'] !== $user['id'] && roleLevel($user['role']) < 3) {
        jsonError('Accès refusé', 403);
    }
    $db->prepare("DELETE FROM `groups` WHERE id=?")->execute([$id]);
    jsonResponse(['message' => 'Groupe supprimé']);
}

function route_groups_join(int $id): void {
    $user = requireAuth();
    $db   = getDb();
    $db->prepare("INSERT IGNORE INTO group_members (group_id, user_id) VALUES (?,?)")
       ->execute([$id, $user['id']]);
    jsonResponse(['message' => 'Vous avez rejoint le groupe']);
}

function route_groups_leave(int $id): void {
    $user = requireAuth();
    $db   = getDb();
    // Vérifier qu'on n'est pas le seul admin
    $st = $db->prepare("SELECT role FROM group_members WHERE group_id=? AND user_id=?");
    $st->execute([$id, $user['id']]);
    $member = $st->fetch();
    $db->prepare("DELETE FROM group_members WHERE group_id=? AND user_id=?")->execute([$id, $user['id']]);
    jsonResponse(['message' => 'Vous avez quitté le groupe']);
}

// ═══════════════════════════════════════════════
// PARTENAIRES
// ═══════════════════════════════════════════════

// ─── ADMIN : liste partenaires ────────────────
function route_admin_partners_list(): void {
    $user = requireAuth();
    if (roleLevel($user['role']) < 3) jsonError('Accès refusé', 403);
    $db   = getDb();
    $rows = $db->query("SELECT * FROM partners ORDER BY validated ASC, created_at DESC")->fetchAll();
    foreach ($rows as &$r) {
        $st = $db->prepare("SELECT COUNT(*) FROM partner_offers WHERE partner_id=? AND active=1");
        $st->execute([$r['id']]);
        $r['nb_offers'] = (int)$st->fetchColumn();
    }
    jsonResponse($rows);
}

// ─── ADMIN : régénérer code partenaire ───────
function route_admin_partner_regen_code(int $id): void {
    $user = requireAuth();
    if (roleLevel($user['role']) < 3) jsonError('Accès refusé', 403);
    $db   = getDb();
    $st   = $db->prepare("SELECT id FROM partners WHERE id=?");
    $st->execute([$id]);
    if (!$st->fetch()) jsonError('Partenaire introuvable', 404);
    $code = generatePartnerCode();
    $db->prepare("UPDATE partners SET code=? WHERE id=?")->execute([$code, $id]);
    jsonResponse(['message' => 'Code régénéré', 'code' => $code]);
}

// ─── PUBLIC : détail partenaire ──────────────
function route_partner_get(int $id): void {
    $db = getDb();
    $st = $db->prepare("SELECT * FROM partners WHERE id=?");
    $st->execute([$id]);
    $partner = $st->fetch();
    if (!$partner) jsonError('Partenaire introuvable', 404);
    // Offres actives
    $ost = $db->prepare("SELECT * FROM partner_offers WHERE partner_id=? AND active=1 ORDER BY created_at DESC");
    $ost->execute([$id]);
    $partner['offers'] = $ost->fetchAll();
    // Masquer le code dans la réponse publique
    unset($partner['code']);
    jsonResponse($partner);
}

// ─── PUBLIC : offres d'un partenaire ─────────
function route_partner_offers_get(int $id): void {
    $db = getDb();
    $st = $db->prepare("SELECT * FROM partner_offers WHERE partner_id=? AND active=1 ORDER BY created_at DESC");
    $st->execute([$id]);
    jsonResponse($st->fetchAll());
}

// ─── PUBLIC : partenaires proches ────────────
function route_partners_nearby(): void {
    $lat    = (float)($_GET['lat'] ?? 0);
    $lng    = (float)($_GET['lng'] ?? 0);
    $radius = (float)($_GET['radius'] ?? 10); // km
    if (!$lat || !$lng) jsonError('lat et lng requis');

    $db   = getDb();
    $rows = $db->query("SELECT * FROM partners WHERE validated=1 AND lat IS NOT NULL AND lng IS NOT NULL")->fetchAll();

    $nearby = [];
    foreach ($rows as $p) {
        // Haversine
        $dLat = deg2rad($p['lat'] - $lat);
        $dLng = deg2rad($p['lng'] - $lng);
        $a    = sin($dLat/2)**2 + cos(deg2rad($lat)) * cos(deg2rad($p['lat'])) * sin($dLng/2)**2;
        $dist = 6371 * 2 * asin(sqrt($a));
        if ($dist <= $radius) {
            $p['distance_km'] = round($dist, 2);
            $nearby[] = $p;
        }
    }
    usort($nearby, fn($a, $b) => $a['distance_km'] <=> $b['distance_km']);
    jsonResponse($nearby);
}

// ─── PARTENAIRE : connexion par code ──────────
function route_partner_login(): void {
    $body = getBody();
    $code = strtoupper(trim($body['code'] ?? ''));
    if (!$code) jsonError('Code requis');

    $db = getDb();
    $st = $db->prepare("SELECT * FROM partners WHERE code=? AND validated=1");
    $st->execute([$code]);
    $partner = $st->fetch();
    if (!$partner) jsonError('Code invalide ou partenaire non validé', 401);

    // Token valide 30 jours
    $token = jwtEncode(['partner_id' => $partner['id']], 30 * 86400);
    jsonResponse([
        'token'   => $token,
        'partner' => [
            'id'          => $partner['id'],
            'nom'         => $partner['nom'],
            'categorie'   => $partner['categorie'],
            'description' => $partner['description'],
            'adresse'     => $partner['adresse'],
            'telephone'   => $partner['telephone'],
            'site_web'    => $partner['site_web'],
            'lat'         => $partner['lat'],
            'lng'         => $partner['lng'],
        ],
    ]);
}

// ─── PARTENAIRE : profil ──────────────────────
function route_partner_me_get(): void {
    $partner = requirePartnerAuth();
    unset($partner['code']); // Ne pas exposer le code
    jsonResponse($partner);
}

function route_partner_me_put(): void {
    $partner = requirePartnerAuth();
    $body    = getBody();
    $desc    = trim($body['description'] ?? '');
    $adresse = trim($body['adresse'] ?? '');
    $tel     = trim($body['telephone'] ?? '');
    $web     = trim($body['site_web'] ?? '');
    $lat     = isset($body['lat']) ? (float)$body['lat'] : null;
    $lng     = isset($body['lng']) ? (float)$body['lng'] : null;

    $db = getDb();
    $db->prepare("UPDATE partners SET description=?, adresse=?, telephone=?, site_web=?, lat=?, lng=? WHERE id=?")
       ->execute([$desc, $adresse, $tel, $web, $lat, $lng, $partner['id']]);
    jsonResponse(['message' => 'Profil partenaire mis à jour']);
}

// ─── PARTENAIRE : offres ─────────────────────
function route_partner_my_offers(): void {
    $partner = requirePartnerAuth();
    $db      = getDb();
    $st      = $db->prepare("SELECT * FROM partner_offers WHERE partner_id=? ORDER BY created_at DESC");
    $st->execute([$partner['id']]);
    jsonResponse($st->fetchAll());
}

function route_partner_offer_create(): void {
    $partner = requirePartnerAuth();
    $body    = getBody();
    $titre   = trim($body['titre'] ?? '');
    $desc    = trim($body['description'] ?? '');
    $type    = trim($body['type'] ?? 'menu');
    $until   = trim($body['valid_until'] ?? '') ?: null;
    if (!$titre) jsonError('Titre requis');

    $db = getDb();
    $db->prepare("INSERT INTO partner_offers (partner_id, titre, description, type, valid_until) VALUES (?,?,?,?,?)")
       ->execute([$partner['id'], $titre, $desc, $type, $until]);
    jsonResponse(['message' => 'Offre créée', 'id' => (int)$db->lastInsertId()], 201);
}

function route_partner_offer_update(int $id): void {
    $partner = requirePartnerAuth();
    $body    = getBody();
    $titre   = trim($body['titre'] ?? '');
    $desc    = trim($body['description'] ?? '');
    $type    = trim($body['type'] ?? 'menu');
    $until   = trim($body['valid_until'] ?? '') ?: null;
    $active  = isset($body['active']) ? (int)(bool)$body['active'] : 1;
    if (!$titre) jsonError('Titre requis');

    $db = getDb();
    $st = $db->prepare("UPDATE partner_offers SET titre=?, description=?, type=?, valid_until=?, active=? WHERE id=? AND partner_id=?");
    $st->execute([$titre, $desc, $type, $until, $active, $id, $partner['id']]);
    if ($st->rowCount() === 0) jsonError('Offre introuvable ou non autorisé', 404);
    jsonResponse(['message' => 'Offre mise à jour']);
}

function route_partner_offer_delete(int $id): void {
    $partner = requirePartnerAuth();
    $db      = getDb();
    $st      = $db->prepare("DELETE FROM partner_offers WHERE id=? AND partner_id=?");
    $st->execute([$id, $partner['id']]);
    if ($st->rowCount() === 0) jsonError('Offre introuvable ou non autorisé', 404);
    jsonResponse(['message' => 'Offre supprimée']);
}

function route_partners_list(): void {
    requireAuth();
    $db = getDb();
    $rows = $db->query("SELECT * FROM partners WHERE validated=1 ORDER BY categorie, nom")->fetchAll();
    jsonResponse($rows);
}

function route_partners_create(): void {
    $body     = getBody();
    $nom      = trim($body['nom'] ?? '');
    $categorie= trim($body['categorie'] ?? '');
    $desc     = trim($body['description'] ?? '');
    $adresse  = trim($body['adresse'] ?? '');
    $tel      = trim($body['telephone'] ?? '');
    $web      = trim($body['site_web'] ?? '');
    if (!$nom || !$categorie) jsonError('Nom et catégorie requis');

    $db = getDb();
    $db->prepare("INSERT INTO partners (nom, categorie, description, adresse, telephone, site_web) VALUES (?,?,?,?,?,?)")
       ->execute([$nom, $categorie, $desc, $adresse, $tel, $web]);
    jsonResponse(['message' => 'Demande d\'inscription envoyée, en attente de validation.'], 201);
}

function route_admin_partner_validate(int $id): void {
    $user = requireAuth();
    if (roleLevel($user['role']) < 3) jsonError('Accès refusé', 403);
    $db = getDb();
    $st = $db->prepare("SELECT * FROM partners WHERE id=?");
    $st->execute([$id]);
    $partner = $st->fetch();
    if (!$partner) jsonError('Partenaire introuvable', 404);
    // Générer un code unique si pas déjà défini
    $code = $partner['code'];
    if (!$code) {
        $code = generatePartnerCode();
    }
    $db->prepare("UPDATE partners SET validated=1, code=? WHERE id=?")->execute([$code, $id]);
    jsonResponse(['message' => 'Partenaire validé', 'code' => $code]);
}

function route_admin_partner_delete(int $id): void {
    $user = requireAuth();
    if (roleLevel($user['role']) < 3) jsonError('Accès refusé', 403);
    $db = getDb();
    $db->prepare("DELETE FROM partners WHERE id=?")->execute([$id]);
    jsonResponse(['message' => 'Partenaire supprimé']);
}

// ═══════════════════════════════════════════════
// SPOTS
// ═══════════════════════════════════════════════

function route_spots_list(): void {
    requireAuth();
    $db = getDb();
    jsonResponse($db->query("SELECT * FROM spots ORDER BY type, nom")->fetchAll());
}

// ═══════════════════════════════════════════════
// ADMIN GROUPES
// ═══════════════════════════════════════════════

function route_admin_groups_list(): void {
    $user = requireAuth();
    if (roleLevel($user['role']) < 3) jsonError('Accès refusé', 403);
    $db = getDb();
    $st = $db->query("
        SELECT g.id, g.nom, g.description, g.created_at,
               u.pseudo as createur,
               (SELECT COUNT(*) FROM group_members WHERE group_id=g.id) as nb_membres
        FROM `groups` g
        LEFT JOIN users u ON u.id=g.created_by
        ORDER BY g.nom ASC
    ");
    jsonResponse($st->fetchAll());
}

function route_admin_groups_create(): void {
    $user = requireAuth();
    if (roleLevel($user['role']) < 3) jsonError('Accès refusé', 403);
    $body = getBody();
    $nom  = trim($body['nom'] ?? '');
    $desc = trim($body['description'] ?? '');
    if (!$nom) jsonError('Nom du groupe requis');
    $db = getDb();
    $db->prepare("INSERT INTO `groups` (nom, description, created_by) VALUES (?,?,?)")
       ->execute([$nom, $desc, $user['id']]);
    $groupId = (int)$db->lastInsertId();
    $db->prepare("INSERT INTO group_members (group_id, user_id, role) VALUES (?,?,'admin')")
       ->execute([$groupId, $user['id']]);
    jsonResponse(['message' => 'Groupe créé', 'id' => $groupId], 201);
}

function route_admin_groups_delete(int $id): void {
    $user = requireAuth();
    if (roleLevel($user['role']) < 3) jsonError('Accès refusé', 403);
    $db = getDb();
    $db->prepare("DELETE FROM `groups` WHERE id=?")->execute([$id]);
    jsonResponse(['message' => 'Groupe supprimé']);
}

function route_admin_groups_members(int $id): void {
    $user = requireAuth();
    if (roleLevel($user['role']) < 3) jsonError('Accès refusé', 403);
    $db = getDb();
    $st = $db->prepare("
        SELECT u.id, u.pseudo, u.email, u.moto_marque, u.moto_cylindree, gm.role, gm.joined_at
        FROM group_members gm
        JOIN users u ON u.id=gm.user_id
        WHERE gm.group_id=?
        ORDER BY gm.role DESC, u.pseudo ASC
    ");
    $st->execute([$id]);
    jsonResponse($st->fetchAll());
}

function route_admin_groups_remove_member(int $groupId, int $userId): void {
    $user = requireAuth();
    if (roleLevel($user['role']) < 3) jsonError('Accès refusé', 403);
    $db = getDb();
    $db->prepare("DELETE FROM group_members WHERE group_id=? AND user_id=?")->execute([$groupId, $userId]);
    jsonResponse(['message' => 'Membre retiré du groupe']);
}
