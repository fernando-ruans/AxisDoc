package store

import (
	"context"
	"fmt"
	"os"
)

// BackupRepo guarda cópias de arquivos antes de sobrescrevê-los.
type BackupRepo struct{ s *Store }

// Backups retorna o repositório de backups.
func (s *Store) Backups() *BackupRepo { return &BackupRepo{s} }

// SaveFile faz backup do conteúdo de um arquivo antes de sobrescrever.
func (r *BackupRepo) SaveFile(ctx context.Context, jobID, path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			data = nil // arquivo novo; backup vazio marca que não existia
		} else {
			return fmt.Errorf("backups: ler %s: %w", path, err)
		}
	}
	_, err = r.s.db.ExecContext(ctx,
		`INSERT INTO backups (job_id, path, content) VALUES (?, ?, ?)`, jobID, path, data)
	if err != nil {
		return fmt.Errorf("backups: inserir: %w", err)
	}
	return nil
}

// Restore restaura o último backup do caminho (usado em undo).
func (r *BackupRepo) Restore(ctx context.Context, path string) error {
	var content []byte
	err := r.s.db.QueryRowContext(ctx,
		`SELECT content FROM backups WHERE path = ? ORDER BY id DESC LIMIT 1`, path).Scan(&content)
	if err != nil {
		return fmt.Errorf("backups: buscar %s: %w", path, err)
	}
	if len(content) == 0 {
		// arquivo não existia antes; remove
		if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
			return fmt.Errorf("backups: remover %s: %w", path, err)
		}
		return nil
	}
	if err := os.WriteFile(path, content, 0o644); err != nil {
		return fmt.Errorf("backups: restaurar %s: %w", path, err)
	}
	return nil
}
