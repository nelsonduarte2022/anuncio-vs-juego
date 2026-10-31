from __future__ import annotations

import sqlite3
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, request, send_from_directory
from werkzeug.utils import secure_filename
from flask_cors import CORS


BASE_DIR = Path(__file__).resolve().parent
DATABASE_PATH = BASE_DIR / "adtrap.sqlite3"
VIDEO_DIR = BASE_DIR / "media" / "videos"
VIDEO_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov"}

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 250 * 1024 * 1024
CORS(
    app,
    resources={r"/api/*": {"origins": [
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]}},
)


def get_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    """Create the API tables if they do not exist yet."""
    with get_connection() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS comentarios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                game_id TEXT NOT NULL,
                contenido TEXT NOT NULL,
                fecha TEXT NOT NULL,
                aprobado INTEGER NOT NULL DEFAULT 0
                    CHECK (aprobado IN (0, 1))
            );

            CREATE TABLE IF NOT EXISTS aportaciones (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre_juego TEXT NOT NULL,
                desarrollador TEXT NOT NULL,
                mecanica_real TEXT NOT NULL,
                fecha TEXT NOT NULL,
                estado TEXT NOT NULL DEFAULT 'pendiente',
                datos_json TEXT NOT NULL DEFAULT '{}'
            );

            CREATE TABLE IF NOT EXISTS videos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                game_id TEXT NOT NULL,
                tipo TEXT NOT NULL CHECK (tipo IN ('ad', 'gameplay')),
                nombre_archivo TEXT NOT NULL,
                fecha TEXT NOT NULL,
                aprobado INTEGER NOT NULL DEFAULT 1
                    CHECK (aprobado IN (0, 1)),
                UNIQUE (game_id, tipo)
            );
            """
        )
        columns = {
            row["name"]
            for row in connection.execute("PRAGMA table_info(aportaciones)").fetchall()
        }
        if "datos_json" not in columns:
            connection.execute(
                "ALTER TABLE aportaciones ADD COLUMN datos_json TEXT NOT NULL DEFAULT '{}'"
            )


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def json_error(message: str, status: int = 400):
    return jsonify({"error": message}), status


def required_text(payload: dict[str, Any], key: str) -> str | None:
    value = payload.get(key)
    return value.strip() if isinstance(value, str) and value.strip() else None


@app.get("/api/comentarios/<game_id>")
def list_comments(game_id: str):
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, game_id, contenido, fecha, aprobado
            FROM comentarios
            WHERE game_id = ? AND aprobado = 1
            ORDER BY fecha DESC, id DESC
            """,
            (game_id,),
        ).fetchall()
    return jsonify([dict(row) for row in rows])


@app.post("/api/comentarios")
def create_comment():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return json_error("El cuerpo debe ser un objeto JSON.")

    game_id = required_text(payload, "game_id")
    contenido = required_text(payload, "contenido")
    if not game_id or not contenido:
        return json_error("game_id y contenido son obligatorios.")
    if len(contenido) > 500:
        return json_error("El comentario no puede superar 500 caracteres.")

    fecha = utc_now()
    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO comentarios (game_id, contenido, fecha, aprobado)
            VALUES (?, ?, ?, 0)
            """,
            (game_id, contenido, fecha),
        )
        comment_id = cursor.lastrowid

    return jsonify({
        "id": comment_id,
        "game_id": game_id,
        "contenido": contenido,
        "fecha": fecha,
        "aprobado": 0,
        "mensaje": "Comentario recibido y pendiente de moderación.",
    }), 201


@app.post("/api/aportaciones")
def create_submission():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return json_error("El cuerpo debe ser un objeto JSON.")

    nombre_juego = required_text(payload, "nombre_juego")
    desarrollador = required_text(payload, "desarrollador") or "Comunidad"
    mecanica_real = required_text(payload, "mecanica_real")
    if not nombre_juego or not mecanica_real:
        return json_error("nombre_juego y mecanica_real son obligatorios.")

    fecha = utc_now()
    estado = "pendiente"
    datos_json = json.dumps(payload, ensure_ascii=False)
    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO aportaciones
                (nombre_juego, desarrollador, mecanica_real, fecha, estado, datos_json)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (nombre_juego, desarrollador, mecanica_real, fecha, estado, datos_json),
        )
        submission_id = cursor.lastrowid

    return jsonify({
        "id": submission_id,
        "nombre_juego": nombre_juego,
        "desarrollador": desarrollador,
        "mecanica_real": mecanica_real,
        "fecha": fecha,
        "estado": estado,
        "datos": payload,
        "mensaje": "Aportación recibida y pendiente de revisión.",
    }), 201


@app.get("/api/aportaciones")
def list_submissions():
    estado = request.args.get("estado", "pendiente")
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, nombre_juego, desarrollador, mecanica_real,
                   fecha, estado, datos_json
            FROM aportaciones
            WHERE estado = ?
            ORDER BY fecha DESC, id DESC
            """,
            (estado,),
        ).fetchall()

    submissions = []
    for row in rows:
        item = dict(row)
        item["datos"] = json.loads(item.pop("datos_json") or "{}")
        submissions.append(item)
    return jsonify(submissions)


@app.patch("/api/aportaciones/<int:submission_id>/aprobar")
def approve_submission(submission_id: int):
    with get_connection() as connection:
        cursor = connection.execute(
            """
            UPDATE aportaciones
            SET estado = 'aprobada'
            WHERE id = ? AND estado = 'pendiente'
            """,
            (submission_id,),
        )
    if cursor.rowcount == 0:
        return json_error("Aportación no encontrada o ya revisada.", 404)
    return jsonify({"id": submission_id, "estado": "aprobada"})


@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/api/videos")
def list_videos():
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, game_id, tipo, nombre_archivo, fecha
            FROM videos
            WHERE aprobado = 1
            ORDER BY game_id, tipo
            """
        ).fetchall()
    return jsonify([
        {
            **dict(row),
            "url": f"/media/videos/{row['nombre_archivo']}",
        }
        for row in rows
    ])


@app.post("/api/videos")
def upload_video():
    game_id = required_text(request.form, "game_id")
    tipo = required_text(request.form, "tipo")
    uploaded_file = request.files.get("video")
    if not game_id or tipo not in {"ad", "gameplay"} or uploaded_file is None:
        return json_error("game_id, tipo y video son obligatorios.")

    original_name = secure_filename(uploaded_file.filename or "")
    extension = Path(original_name).suffix.lower()
    if not original_name or extension not in ALLOWED_VIDEO_EXTENSIONS:
        return json_error("Solo se aceptan videos MP4, WebM o MOV.")

    filename = f"{secure_filename(game_id)}-{tipo}{extension}"
    uploaded_file.save(VIDEO_DIR / filename)
    fecha = utc_now()
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO videos (game_id, tipo, nombre_archivo, fecha, aprobado)
            VALUES (?, ?, ?, ?, 1)
            ON CONFLICT(game_id, tipo) DO UPDATE SET
                nombre_archivo = excluded.nombre_archivo,
                fecha = excluded.fecha,
                aprobado = 1
            """,
            (game_id, tipo, filename, fecha),
        )
    return jsonify({
        "game_id": game_id,
        "tipo": tipo,
        "nombre_archivo": filename,
        "url": f"/media/videos/{filename}",
        "fecha": fecha,
    }), 201


@app.get("/media/videos/<path:filename>")
def serve_video(filename: str):
    return send_from_directory(VIDEO_DIR, filename, conditional=True)


init_db()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
