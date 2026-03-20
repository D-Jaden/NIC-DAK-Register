const pool = require("./db");

async function initDatabase() {
  try{
    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        phone_no VARCHAR(15) NOT NULL
      );
    `);

    // Acquired sequence + table
    await pool.query(`
      CREATE SEQUENCE IF NOT EXISTS acquired_id_seq;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS acquired (
        serial_no         INTEGER NOT NULL,
        acquired_date     VARCHAR(50) NOT NULL,
        eng_received_from VARCHAR (1000) NOT NULL,
        hi_received_from  VARCHAR (1000) NOT NULL,
        letter_no         VARCHAR(255) NOT NULL,
        eng_subject       VARCHAR(5000) NOT NULL,
        hi_subject        VARCHAR(5000) NOT NULL,
        user_id           INTEGER,
        id                INTEGER NOT NULL DEFAULT nextval('acquired_id_seq'),
        created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        language          VARCHAR(20) NOT NULL,
        zone              VARCHAR(20) NOT NULL,
        PRIMARY KEY (id),
        CONSTRAINT acquired_user_id_fkey
          FOREIGN KEY (user_id) REFERENCES users(user_id)
      );
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_acquired_date      ON acquired(acquired_date);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_acquired_serial_no ON acquired(serial_no);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_acquired_user_id   ON acquired(user_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_id            ON acquired(user_id);`);
    
    // Safe migration: convert acquired_date from DATE to VARCHAR if needed
    await pool.query(`
      DO $$
      BEGIN
        IF (SELECT data_type FROM information_schema.columns
            WHERE table_name='acquired' AND column_name='acquired_date') = 'date' THEN
          ALTER TABLE acquired ALTER COLUMN acquired_date TYPE VARCHAR(50) USING TO_CHAR(acquired_date::date, 'DD/MM/YYYY');
        END IF;
      END $$;
    `);

    // Add new columns if they don't exist
    await pool.query(`ALTER TABLE acquired ADD COLUMN IF NOT EXISTS zone VARCHAR(20);`);
    await pool.query(`ALTER TABLE acquired ADD COLUMN IF NOT EXISTS specific_person TEXT;`);
    await pool.query(`ALTER TABLE acquired ADD COLUMN IF NOT EXISTS specific_person_hindi TEXT;`);
    await pool.query(`ALTER TABLE acquired ADD COLUMN IF NOT EXISTS acquired_on_date VARCHAR(50);`);
    await pool.query(`ALTER TABLE acquired ADD COLUMN IF NOT EXISTS acquisition_method VARCHAR(100);`);

    // Create index on zone after we ensure it exists
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_acquired_zone      ON acquired(zone);`);


    // Despatch sequence + table
    await pool.query(`
      CREATE SEQUENCE IF NOT EXISTS despatch_id_seq;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS despatch (
        serial_no           INTEGER NOT NULL,
        letter_date         VARCHAR(50) NOT NULL,
        registration_date   VARCHAR(50) NOT NULL,
        eng_to_whom_sent    VARCHAR(5000) NOT NULL,
        hi_to_whom_sent     VARCHAR(5000) NOT NULL,
        eng_copy_sent_to    VARCHAR(5000) NOT NULL,
        hi_copy_sent_to     VARCHAR(5000) NOT NULL,
        eng_main_address    VARCHAR (1000) NOT NULL,
        hi_main_address     VARCHAR (1000) NOT NULL,
        eng_place           VARCHAR(5000) NOT NULL,
        hi_place            VARCHAR(5000) NOT NULL,
        eng_subject         VARCHAR(5000) NOT NULL,
        hi_subject          VARCHAR(5000) NOT NULL,
        eng_sent_by         VARCHAR(5000) NOT NULL,
        hi_sent_by          VARCHAR(5000) NOT NULL,
        letter_no           VARCHAR(100) NOT NULL,
        delivery_method     VARCHAR(50) NOT NULL,
        language            VARCHAR(20) NOT NULL,
        zone                VARCHAR(20) NOT NULL,
        user_id             INTEGER,
        id                  INTEGER NOT NULL DEFAULT nextval('despatch_id_seq'),
        created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT despatch_user_id_fkey
          FOREIGN KEY (user_id) REFERENCES users(user_id)
      );
    `);

    // ── Safe migrations for existing databases ──────────────────────────────

    // Rename old `date` column to `letter_date` if it still exists
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='despatch' AND column_name='date'
        ) THEN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name='despatch' AND column_name='letter_date'
          ) THEN
            ALTER TABLE despatch RENAME COLUMN date TO letter_date;
          END IF;
        END IF;
      END $$;
    `);

    // Ensure letter_date is VARCHAR(50)
    await pool.query(`
      DO $$
      BEGIN
        IF (SELECT data_type FROM information_schema.columns
            WHERE table_name='despatch' AND column_name='letter_date') = 'date' THEN
          ALTER TABLE despatch ALTER COLUMN letter_date TYPE VARCHAR(50) USING TO_CHAR(letter_date::date, 'DD/MM/YYYY');
        END IF;
      END $$;
    `);

    // Add new columns if they don't exist
    await pool.query(`ALTER TABLE despatch ADD COLUMN IF NOT EXISTS registration_date  VARCHAR(50);`);
    await pool.query(`ALTER TABLE despatch ADD COLUMN IF NOT EXISTS eng_copy_sent_to   VARCHAR(5000);`);
    await pool.query(`ALTER TABLE despatch ADD COLUMN IF NOT EXISTS hi_copy_sent_to    VARCHAR(5000);`);
    await pool.query(`ALTER TABLE despatch ADD COLUMN IF NOT EXISTS eng_main_address   TEXT;`);
    await pool.query(`ALTER TABLE despatch ADD COLUMN IF NOT EXISTS hi_main_address    TEXT;`);
    await pool.query(`ALTER TABLE despatch ADD COLUMN IF NOT EXISTS zone               VARCHAR(20);`);

    // Widen existing columns if needed
    await pool.query(`ALTER TABLE despatch ALTER COLUMN eng_to_whom_sent  TYPE VARCHAR(5000);`);
    await pool.query(`ALTER TABLE despatch ALTER COLUMN hi_to_whom_sent   TYPE VARCHAR(5000);`);
    await pool.query(`ALTER TABLE despatch ALTER COLUMN eng_place         TYPE VARCHAR(5000);`);
    await pool.query(`ALTER TABLE despatch ALTER COLUMN hi_place          TYPE VARCHAR(5000);`);
    await pool.query(`ALTER TABLE despatch ALTER COLUMN eng_subject       TYPE VARCHAR(5000);`);
    await pool.query(`ALTER TABLE despatch ALTER COLUMN hi_subject        TYPE VARCHAR(5000);`);
    await pool.query(`ALTER TABLE despatch ALTER COLUMN eng_sent_by       TYPE VARCHAR(5000);`);
    await pool.query(`ALTER TABLE despatch ALTER COLUMN hi_sent_by        TYPE VARCHAR(5000);`);

    // Indices
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_despatch_letter_date  ON despatch(letter_date);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_despatch_serial_no    ON despatch(serial_no);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_despatch_user_id      ON despatch(user_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_despatch_zone         ON despatch(zone);`);

    console.log("Database initialized successfully");
  } 
  catch (error) {
    console.error(" Database initialization failed:", error);
  }
}

module.exports = initDatabase;
