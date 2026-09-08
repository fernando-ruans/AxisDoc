// Package store persiste dados do app em SQLite (driver pure-Go modernc).
package store

import (
	"database/sql"
	"embed"
	"fmt"
	"io/fs"
	"strconv"
	"strings"

	_ "modernc.org/sqlite"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

// Store encapsula a conexão SQLite.
type Store struct {
	db *sql.DB
}

// Open abre (ou cria) o banco em path e aplica as migrações pendentes.
func Open(path string) (*Store, error) {
	dsn := fmt.Sprintf("file:%s?_pragma=journal_mode(WAL)&_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)", strings.ReplaceAll(path, `\`, `/`))
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("store: abrir banco: %w", err)
	}
	// SQLite pure-Go: uma conexão evita "database is locked" sob concorrência.
	db.SetMaxOpenConns(1)
	s := &Store{db: db}
	if err := s.migrate(); err != nil {
		db.Close()
		return nil, err
	}
	return s, nil
}

// Close fecha a conexão.
func (s *Store) Close() error { return s.db.Close() }

// DB expõe a conexão para repositórios internos.
func (s *Store) DB() *sql.DB { return s.db }

func (s *Store) migrate() error {
	if _, err := s.db.Exec(`PRAGMA user_version`); err != nil {
		return fmt.Errorf("store: user_version: %w", err)
	}
	var current int
	row := s.db.QueryRow(`PRAGMA user_version`)
	if err := row.Scan(&current); err != nil {
		return fmt.Errorf("store: ler user_version: %w", err)
	}
	entries, err := fs.ReadDir(migrationFS, "migrations")
	if err != nil {
		return fmt.Errorf("store: listar migrações: %w", err)
	}
	for _, e := range entries {
		name := e.Name()
		if !strings.HasSuffix(name, ".sql") {
			continue
		}
		ver, err := versionOf(name)
		if err != nil {
			return err
		}
		if ver <= current {
			continue
		}
		body, err := migrationFS.ReadFile("migrations/" + name)
		if err != nil {
			return fmt.Errorf("store: ler migração %s: %w", name, err)
		}
		tx, err := s.db.Begin()
		if err != nil {
			return fmt.Errorf("store: begin: %w", err)
		}
		if _, err := tx.Exec(string(body)); err != nil {
			tx.Rollback()
			return fmt.Errorf("store: aplicar %s: %w", name, err)
		}
		if _, err := tx.Exec(fmt.Sprintf(`PRAGMA user_version = %d`, ver)); err != nil {
			tx.Rollback()
			return fmt.Errorf("store: marcar versão %d: %w", ver, err)
		}
		if err := tx.Commit(); err != nil {
			return fmt.Errorf("store: commit %s: %w", name, err)
		}
	}
	return nil
}

func versionOf(name string) (int, error) {
	base := strings.TrimSuffix(name, ".sql")
	i := strings.IndexByte(base, '_')
	if i <= 0 {
		return 0, fmt.Errorf("store: migração com nome inválido: %q", name)
	}
	v, err := strconv.Atoi(base[:i])
	if err != nil {
		return 0, fmt.Errorf("store: migração com versão inválida: %q", name)
	}
	return v, nil
}
