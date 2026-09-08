package store

import (
	"context"
	"fmt"
)

// SettingRepo persiste pares chave/valor de configuração.
type SettingRepo struct{ s *Store }

// Settings retorna o repositório de configurações.
func (s *Store) Settings() *SettingRepo { return &SettingRepo{s} }

// Get retorna o valor de uma chave ("" se inexistente).
func (r *SettingRepo) Get(ctx context.Context, key string) (string, error) {
	var v string
	err := r.s.db.QueryRowContext(ctx, `SELECT value FROM settings WHERE key = ?`, key).Scan(&v)
	if err != nil {
		if err.Error() == "sql: no rows in result set" {
			return "", nil
		}
		return "", fmt.Errorf("settings: get %q: %w", key, err)
	}
	return v, nil
}

// Set grava (upsert) uma chave.
func (r *SettingRepo) Set(ctx context.Context, key, value string) error {
	_, err := r.s.db.ExecContext(ctx, `
		INSERT INTO settings (key, value) VALUES (?, ?)
		ON CONFLICT(key) DO UPDATE SET value = excluded.value`, key, value)
	if err != nil {
		return fmt.Errorf("settings: set %q: %w", key, err)
	}
	return nil
}
