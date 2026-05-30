import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, "../migrations");

/**
 * Run pending migrations in order
 * Creates schema_migrations table if it doesn't exist to track applied migrations
 */
export function runMigrations(db) {
    console.log("🔧 Running migrations...");

    // Create migrations tracking table if it doesn't exist
    db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      executed_at TEXT DEFAULT (datetime('now'))
    )
  `);

    // Read all migration files (sorted by filename)
    if (!fs.existsSync(migrationsDir)) {
        console.log("⚠️  No migrations directory found");
        return;
    }

    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith(".sql"))
        .sort();

    if (files.length === 0) {
        console.log("✓ No migrations to run");
        return;
    }

    for (const file of files) {
        const version = file.replace(".sql", "");

        try {
            // Check if migration has already been executed
            const executed = db.prepare(
                "SELECT 1 FROM schema_migrations WHERE version = ?"
            ).get(version);

            if (!executed) {
                console.log(`  ➤ Applying ${file}...`);

                // Read and execute migration
                const sqlPath = path.join(migrationsDir, file);
                const sql = fs.readFileSync(sqlPath, "utf8");
                db.exec(sql);

                // Mark as executed
                db.prepare("INSERT INTO schema_migrations (version) VALUES (?)").run(version);
                console.log(`  ✓ ${file} completed`);
            } else {
                console.log(`  ✓ ${file} (already applied)`);
            }
        } catch (error) {
            console.error(`❌ Error applying ${file}:`, error.message);
            throw error;
        }
    }

    console.log("✓ All migrations completed successfully\n");
}

/**
 * Rollback specific migration (for development/testing)
 * @param {object} db - Database instance
 * @param {string} version - Version to rollback (e.g., "001-services")
 */
export function rollbackMigration(db, version) {
    console.log(`⏮️  Rolling back ${version}...`);

    const rollbacks = {
        "001-services": `
      DROP TABLE IF EXISTS service_stops;
      DROP TABLE IF EXISTS services;
    `,
        "002-service-events": `
      DROP TABLE IF EXISTS service_events;
    `,
        "003-trains-compatibility": `
      ALTER TABLE trains DROP COLUMN service_stop_id;
    `
    };

    try {
        if (rollbacks[version]) {
            db.exec(rollbacks[version]);
            db.prepare("DELETE FROM schema_migrations WHERE version = ?").run(version);
            console.log(`✓ Rolled back ${version}`);
        } else {
            console.log(`⚠️  No rollback defined for ${version}`);
        }
    } catch (error) {
        console.error(`❌ Error rolling back ${version}:`, error.message);
        throw error;
    }
}
