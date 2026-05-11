<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// --- Configuración desde variables de entorno ---
$db_host     = getenv('DB_HOST')     ?: 'postgres';
$db_name     = getenv('DB_NAME')     ?: 'moodle_db';
$db_user     = getenv('DB_USER')     ?: 'admin';
$db_password = getenv('DB_PASSWORD') ?: 'secreto123';
$ia_url      = getenv('IA_SERVICE_URL')   ?: 'http://backend-ia:8000';
$upload_dir  = getenv('SHARED_UPLOAD_DIR') ?: '/var/plagidec/uploads';

// --- Conexión a la base de datos ---
function getDB($host, $name, $user, $password) {
    try {
        $pdo = new PDO("pgsql:host=$host;dbname=$name", $user, $password);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        return $pdo;
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'DB connection failed: ' . $e->getMessage()]);
        exit();
    }
}

// --- Inicializar tablas si no existen ---
function initDB($pdo) {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS submissions (
            id SERIAL PRIMARY KEY,
            filename VARCHAR(255) NOT NULL,
            filepath VARCHAR(500) NOT NULL,
            uploaded_at TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS results (
            id SERIAL PRIMARY KEY,
            submission_id INTEGER REFERENCES submissions(id),
            plagiarism_score NUMERIC(5,2),
            ai_score NUMERIC(5,2),
            details JSONB,
            analyzed_at TIMESTAMP DEFAULT NOW()
        );
    ");
}

$pdo = getDB($db_host, $db_name, $db_user, $db_password);
initDB($pdo);

$method = $_SERVER['REQUEST_METHOD'];
$path   = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// --- POST /analyze — recibe archivo, lo guarda en volumen compartido, llama a IA ---
if ($method === 'POST' && str_contains($path, '/analyze')) {
    if (empty($_FILES['document'])) {
        http_response_code(400);
        echo json_encode(['error' => 'No se recibió ningún archivo. Usa el campo "document".']);
        exit();
    }

    $file = $_FILES['document'];

    // Crear directorio compartido si no existe
    if (!is_dir($upload_dir)) {
        mkdir($upload_dir, 0755, true);
    }

    // Guardar archivo en el volumen compartido con nombre único
    $filename = time() . '_' . bin2hex(random_bytes(4)) . '_' . basename($file['name']);
    $filepath = $upload_dir . '/' . $filename;
    move_uploaded_file($file['tmp_name'], $filepath);

    // Guardar submission en la BD (con la ruta del volumen compartido)
    $stmt = $pdo->prepare("INSERT INTO submissions (filename, filepath) VALUES (:fn, :fp) RETURNING id");
    $stmt->execute([':fn' => $filename, ':fp' => $filepath]);
    $submission_id = $stmt->fetchColumn();

    // Enviar al backend-ia la RUTA del archivo (no el contenido)
    // El backend-ia lo leerá directamente desde el volumen compartido
    $ch = curl_init("$ia_url/analyze-file");
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'filepath'      => $filepath,
        'submission_id' => $submission_id,
    ]));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 60);
    $ia_response = curl_exec($ch);
    $curl_error  = curl_error($ch);
    curl_close($ch);

    if ($curl_error) {
        http_response_code(502);
        echo json_encode(['error' => 'No se pudo contactar al backend-ia: ' . $curl_error]);
        exit();
    }

    $ia_data = json_decode($ia_response, true);

    // Guardar resultado en la BD
    $stmt = $pdo->prepare("
        INSERT INTO results (submission_id, plagiarism_score, ai_score, details)
        VALUES (:sid, :ps, :as, :det)
    ");
    $stmt->execute([
        ':sid' => $submission_id,
        ':ps'  => $ia_data['plagiarism_score'] ?? 0,
        ':as'  => $ia_data['ai_score'] ?? 0,
        ':det' => json_encode($ia_data),
    ]);

    echo json_encode([
        'submission_id'    => $submission_id,
        'filename'         => $filename,
        'plagiarism_score' => $ia_data['plagiarism_score'] ?? 0,
        'ai_score'         => $ia_data['ai_score'] ?? 0,
        'keywords'         => $ia_data['keywords'] ?? [],
        'details'          => $ia_data,
    ]);
    exit();
}

// --- GET /results — lista todos los resultados guardados ---
if ($method === 'GET' && str_contains($path, '/results')) {
    $rows = $pdo->query("
        SELECT s.id, s.filename, s.uploaded_at,
               r.plagiarism_score, r.ai_score, r.details, r.analyzed_at
        FROM submissions s
        LEFT JOIN results r ON r.submission_id = s.id
        ORDER BY s.uploaded_at DESC
        LIMIT 50
    ")->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($rows);
    exit();
}

// --- GET / — health check ---
echo json_encode(['status' => 'ok', 'service' => 'backend-arc', 'ia_url' => $ia_url]);
