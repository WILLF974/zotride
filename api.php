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

    notifyAdmins("Nouvelle inscription : $pseudo ($email)", 'new_user', $newUserId);
    jsonResponse(['message' => 'Inscription réussie. En attente de validation par l\'administrateur.'], 201);
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

    if ((int)$sortie['created_by'] !== (int)$user['id'] && $user['role'] !== 'admin') {
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

    if ($actorLevel >= 4) {
        $rows = $db->prepare("SELECT id,pseudo,email,moto_marque,moto_cylindree,role,validated,blocked,created_at FROM users WHERE id!=? ORDER BY validated ASC, created_at DESC");
        $rows->execute([$actor['id']]);
    } elseif ($actorLevel >= 3) {
        $rows = $db->prepare("SELECT id,pseudo,email,moto_marque,moto_cylindree,role,validated,blocked,created_at FROM users WHERE role NOT IN ('superadmin','admin') ORDER BY validated ASC, created_at DESC");
        $rows->execute([]);
    } else {
        $rows = $db->prepare("SELECT id,pseudo,email,moto_marque,moto_cylindree,role,validated,blocked,created_at FROM users WHERE role NOT IN ('superadmin','admin','organisateur') ORDER BY validated ASC, created_at DESC");
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
    $db->prepare("DELETE FROM radar_positions WHERE session_id IN (SELECT session_id FROM radar_positions LIMIT 0)")->execute([]);
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
    $sessionId = trim($body['sessionId'] ?? '');
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
    $sessionId = trim($body['sessionId'] ?? '');
    if (!$sessionId) jsonError('sessionId requis');

    $db = getDb();
    $db->prepare("DELETE FROM radar_positions WHERE session_id=?")->execute([$sessionId]);
    jsonResponse(['ok' => true]);
}

function route_radar_sorties(): void {
    $db  = getDb();
    $today = date('Y-m-d');
    $rows = $db->prepare("
        SELECT s.id,s.titre,s.date,s.heure,
            (SELECT COUNT(*) FROM participants WHERE sortie_id=s.id) as nb_participants,
            w.lat,w.lng,w.nom as rassemblement
        FROM sorties s
        LEFT JOIN waypoints w ON w.sortie_id=s.id AND w.is_rassemblement=1
        WHERE s.date=? AND s.status='active'
        ORDER BY s.heure
    ");
    $rows->execute([$today]);
    jsonResponse($rows->fetchAll());
}
