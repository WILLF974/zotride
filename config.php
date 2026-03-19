<?php
// ─────────────────────────────────────────────
//  config.php – Configuration centrale Zot Ride
// ─────────────────────────────────────────────

// Chargement .env simple
if (file_exists(__DIR__ . '/.env')) {
    foreach (file(__DIR__ . '/.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (strpos($line, '#') === 0) continue;
        if (strpos($line, '=') === false) continue;
        [$k, $v] = explode('=', $line, 2);
        $_ENV[trim($k)] = trim($v);
    }
}

define('JWT_SECRET', $_ENV['JWT_SECRET'] ?? 'zotride_secret_key_change_in_production');

// ── Connexion MySQL ────────────────────────────
define('DB_HOST', $_ENV['DB_HOST'] ?? 'localhost');
define('DB_NAME', $_ENV['DB_NAME'] ?? 'u590098568_Zotride1');
define('DB_USER', $_ENV['DB_USER'] ?? 'u590098568_Zotride2');
define('DB_PASS', $_ENV['DB_PASS'] ?? 'Zotride3');

function getDb(): PDO {
    static $db = null;
    if ($db) return $db;

    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    $db  = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);

    initDb($db);
    return $db;
}

function initDb(PDO $db): void {
    // ── Création des tables (MySQL) ──────────────

    $db->exec("CREATE TABLE IF NOT EXISTS users (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        pseudo        VARCHAR(50)  NOT NULL,
        email         VARCHAR(100) NOT NULL,
        password      VARCHAR(255) NOT NULL,
        moto_marque   VARCHAR(50)  DEFAULT '',
        moto_cylindree INT         DEFAULT 0,
        role          VARCHAR(20)  DEFAULT 'participant',
        validated     TINYINT(1)   DEFAULT 0,
        blocked       TINYINT(1)   DEFAULT 0,
        created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_pseudo (pseudo),
        UNIQUE KEY uq_email  (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $db->exec("CREATE TABLE IF NOT EXISTS sorties (
        id                   INT AUTO_INCREMENT PRIMARY KEY,
        titre                VARCHAR(100) NOT NULL,
        description          TEXT,
        date                 DATE         NOT NULL,
        heure                TIME         DEFAULT '09:00:00',
        nb_max_participants  INT          DEFAULT 20,
        created_by           INT          NOT NULL,
        status               VARCHAR(20)  DEFAULT 'active',
        created_at           DATETIME     DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_sortie_user FOREIGN KEY (created_by) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $db->exec("CREATE TABLE IF NOT EXISTS waypoints (
        id               INT AUTO_INCREMENT PRIMARY KEY,
        sortie_id        INT          NOT NULL,
        lat              DOUBLE       NOT NULL,
        lng              DOUBLE       NOT NULL,
        nom              VARCHAR(100) DEFAULT '',
        ordre            INT          DEFAULT 0,
        is_rassemblement TINYINT(1)   DEFAULT 0,
        CONSTRAINT fk_wp_sortie FOREIGN KEY (sortie_id) REFERENCES sorties(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $db->exec("CREATE TABLE IF NOT EXISTS participants (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        sortie_id  INT      NOT NULL,
        user_id    INT      NOT NULL,
        joined_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_participant (sortie_id, user_id),
        CONSTRAINT fk_part_sortie FOREIGN KEY (sortie_id) REFERENCES sorties(id) ON DELETE CASCADE,
        CONSTRAINT fk_part_user   FOREIGN KEY (user_id)   REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $db->exec("CREATE TABLE IF NOT EXISTS participant_locations (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        sortie_id  INT      NOT NULL,
        user_id    INT      NOT NULL,
        lat        DOUBLE   NOT NULL,
        lng        DOUBLE   NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_loc (sortie_id, user_id),
        CONSTRAINT fk_loc_sortie FOREIGN KEY (sortie_id) REFERENCES sorties(id) ON DELETE CASCADE,
        CONSTRAINT fk_loc_user   FOREIGN KEY (user_id)   REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $db->exec("CREATE TABLE IF NOT EXISTS radar_positions (
        id             INT AUTO_INCREMENT PRIMARY KEY,
        session_id     VARCHAR(36)  NOT NULL,
        pseudo         VARCHAR(50)  NOT NULL,
        moto_marque    VARCHAR(50)  DEFAULT '',
        moto_cylindree INT          DEFAULT 0,
        lat            DOUBLE       NOT NULL,
        lng            DOUBLE       NOT NULL,
        updated_at     DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_session (session_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $db->exec("CREATE TABLE IF NOT EXISTS notifications (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        user_id    INT          NOT NULL,
        message    TEXT         NOT NULL,
        type       VARCHAR(50)  DEFAULT 'info',
        `read`     TINYINT(1)   DEFAULT 0,
        related_id INT          DEFAULT NULL,
        created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // ── Superadmin garanti ───────────────────────
    // Force le rôle superadmin même si l'email s'était inscrit via le formulaire
    $db->exec("UPDATE users SET role='superadmin', validated=1, blocked=0 WHERE email='riviere.will@gmail.com'");
    $superadmin = $db->query("SELECT id FROM users WHERE email='riviere.will@gmail.com' LIMIT 1")->fetch();
    if (!$superadmin) {
        $hash = password_hash('Alisonde974$', PASSWORD_BCRYPT);
        $st   = $db->prepare("INSERT INTO users (pseudo,email,password,role,validated,blocked) VALUES (?,?,?,?,?,?)");
        $st->execute(['SuperAdmin', 'riviere.will@gmail.com', $hash, 'superadmin', 1, 0]);
    }
}

// ── JWT (implémentation pure PHP) ─────────────
function jwtEncode(array $payload): string {
    $header  = base64url_encode(json_encode(['alg'=>'HS256','typ'=>'JWT']));
    $payload['exp'] = time() + 7 * 86400;
    $pl      = base64url_encode(json_encode($payload));
    $sig     = base64url_encode(hash_hmac('sha256', "$header.$pl", JWT_SECRET, true));
    return "$header.$pl.$sig";
}

function jwtDecode(string $token): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    [$header, $pl, $sig] = $parts;
    $expected = base64url_encode(hash_hmac('sha256', "$header.$pl", JWT_SECRET, true));
    if (!hash_equals($expected, $sig)) return null;
    $payload = json_decode(base64url_decode($pl), true);
    if (!$payload || $payload['exp'] < time()) return null;
    return $payload;
}

function base64url_encode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}
function base64url_decode(string $data): string {
    return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', 3 - (3 + strlen($data)) % 4));
}

// ── Helpers réponse ───────────────────────────
function jsonResponse(mixed $data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function jsonError(string $message, int $status = 400): void {
    jsonResponse(['error' => $message], $status);
}

function getBody(): array {
    static $body = null;
    if ($body === null) {
        $raw  = file_get_contents('php://input');
        $body = json_decode($raw, true) ?? [];
    }
    return $body;
}

function getMethod(): string {
    return $_SERVER['REQUEST_METHOD'] ?? 'GET';
}

// ── Auth middleware ───────────────────────────
function getAuthUser(): ?array {
    // Hostinger CGI supprime HTTP_AUTHORIZATION → fallbacks multiples
    $header = $_SERVER['HTTP_AUTHORIZATION']
           ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
           ?? '';
    if (!$header && function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        $header  = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    }
    if (!preg_match('/^Bearer\s+(.+)$/i', $header, $m)) return null;
    $payload = jwtDecode($m[1]);
    if (!$payload) return null;
    $db   = getDb();
    $user = $db->prepare("SELECT id,pseudo,email,role,validated FROM users WHERE id=?");
    $user->execute([$payload['id']]);
    return $user->fetch() ?: null;
}

// ── Hiérarchie des rôles ─────────────────────
// superadmin(4) > admin(3) > organisateur(2) > participant(1)
function roleLevel(string $role): int {
    return ['participant' => 1, 'organisateur' => 2, 'admin' => 3, 'superadmin' => 4][$role] ?? 0;
}

function roleName(string $role): string {
    return ['participant' => 'Participant', 'organisateur' => 'Organisateur',
            'admin' => 'Administrateur', 'superadmin' => 'Super Admin'][$role] ?? $role;
}

function requireAuth(): array {
    $user = getAuthUser();
    if (!$user) jsonError('Non authentifié', 401);
    return $user;
}

function requireAdmin(): array {
    $user = requireAuth();
    if (roleLevel($user['role']) < 3) jsonError('Accès refusé', 403);
    return $user;
}

function requireOrgOrAdmin(): array {
    $user = requireAuth();
    if (roleLevel($user['role']) < 2) jsonError('Accès refusé', 403);
    return $user;
}

function requireSuperAdmin(): array {
    $user = requireAuth();
    if ($user['role'] !== 'superadmin') jsonError('Accès refusé', 403);
    return $user;
}

// ── Notifications helper ──────────────────────
function notify(int $userId, string $message, string $type, ?int $relatedId = null): void {
    $db = getDb();
    $st = $db->prepare("INSERT INTO notifications (user_id,message,type,related_id) VALUES (?,?,?,?)");
    $st->execute([$userId, $message, $type, $relatedId]);
}

function notifyAllUsers(string $message, string $type, int $exceptUserId = 0): void {
    $db    = getDb();
    $users = $db->query("SELECT id FROM users WHERE validated=1 AND role NOT IN ('superadmin')")->fetchAll();
    foreach ($users as $u) {
        if ((int)$u['id'] !== $exceptUserId) {
            notify((int)$u['id'], $message, $type);
        }
    }
}

function notifyAdmins(string $message, string $type, ?int $relatedId = null): void {
    $db     = getDb();
    $admins = $db->query("SELECT id FROM users WHERE role IN ('admin','superadmin','organisateur')")->fetchAll();
    foreach ($admins as $a) {
        notify((int)$a['id'], $message, $type, $relatedId);
    }
}
