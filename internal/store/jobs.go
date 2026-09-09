package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

// Status possíveis de um job.
const (
	StatusQueued   = "queued"
	StatusRunning  = "running"
	StatusDone     = "done"
	StatusFailed   = "failed"
	StatusCanceled = "canceled"
)

// Job representa um job persistido.
type Job struct {
	ID        string         `json:"id"`
	ToolID    string         `json:"toolId"`
	Status    string         `json:"status"`
	Input     map[string]any `json:"input"`
	Output    map[string]any `json:"output,omitempty"`
	Error     string         `json:"error,omitempty"`
	Progress  float64        `json:"progress"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
}

// ErrNotFound indica registro inexistente.
var ErrNotFound = errors.New("store: não encontrado")

// JobRepo persiste jobs.
type JobRepo struct{ s *Store }

// Jobs retorna o repositório de jobs.
func (s *Store) Jobs() *JobRepo { return &JobRepo{s} }

// Insert cria um job novo.
func (r *JobRepo) Insert(ctx context.Context, j *Job) error {
	in, err := json.Marshal(j.Input)
	if err != nil {
		return fmt.Errorf("jobs: input inválido: %w", err)
	}
	_, err = r.s.db.ExecContext(ctx, `
		INSERT INTO jobs (id, tool_id, status, input_json, progress)
		VALUES (?, ?, ?, ?, ?)`,
		j.ID, j.ToolID, j.Status, string(in), j.Progress)
	if err != nil {
		return fmt.Errorf("jobs: inserir: %w", err)
	}
	return nil
}

// UpdateProgress atualiza o progresso de um job.
func (r *JobRepo) UpdateProgress(ctx context.Context, id string, pct float64) error {
	res, err := r.s.db.ExecContext(ctx,
		`UPDATE jobs SET progress = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`, pct, id)
	if err != nil {
		return fmt.Errorf("jobs: progresso: %w", err)
	}
	return requireRows(res)
}

// MarkRunning marca o job como em execução.
func (r *JobRepo) MarkRunning(ctx context.Context, id string) error {
	res, err := r.s.db.ExecContext(ctx, `
		UPDATE jobs SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
		WHERE id = ? AND status = ?`, StatusRunning, id, StatusQueued)
	if err != nil {
		return fmt.Errorf("jobs: marcar running: %w", err)
	}
	return requireRows(res)
}

// Finish marca o job como concluído/falho/cancelado com saída ou erro.
func (r *JobRepo) Finish(ctx context.Context, id, status string, output map[string]any, jobErr string) error {
	var outJSON any
	if output != nil {
		b, err := json.Marshal(output)
		if err != nil {
			return fmt.Errorf("jobs: output inválido: %w", err)
		}
		outJSON = string(b)
	}
	var pct float64
	if status == StatusDone {
		pct = 100
	}
	res, err := r.s.db.ExecContext(ctx, `
		UPDATE jobs SET status = ?, output_json = ?, error = ?, progress = ?,
			updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
		WHERE id = ?`,
		status, outJSON, jobErr, pct, id)
	if err != nil {
		return fmt.Errorf("jobs: finalizar: %w", err)
	}
	return requireRows(res)
}

// Get busca um job por ID.
func (r *JobRepo) Get(ctx context.Context, id string) (*Job, error) {
	row := r.s.db.QueryRowContext(ctx, selectJobs+` WHERE id = ?`, id)
	return scanJob(row)
}

// Delete remove um job do histórico.
func (r *JobRepo) Delete(ctx context.Context, id string) error {
	res, err := r.s.db.ExecContext(ctx, `DELETE FROM jobs WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("jobs: deletar: %w", err)
	}
	return requireRows(res)
}

// ClearHistory remove todo o histórico de jobs.
func (r *JobRepo) ClearHistory(ctx context.Context) error {
	_, err := r.s.db.ExecContext(ctx, `DELETE FROM jobs`)
	if err != nil {
		return fmt.Errorf("jobs: limpar: %w", err)
	}
	return nil
}

// List retorna os jobs mais recentes primeiro.
func (r *JobRepo) List(ctx context.Context, limit int) ([]*Job, error) {
	if limit <= 0 {
		limit = 100
	}
	rows, err := r.s.db.QueryContext(ctx, selectJobs+` ORDER BY created_at DESC LIMIT ?`, limit)
	if err != nil {
		return nil, fmt.Errorf("jobs: listar: %w", err)
	}
	defer rows.Close()
	out := []*Job{}
	for rows.Next() {
		j, err := scanJob(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, j)
	}
	return out, rows.Err()
}

// ResetRunning marca jobs 'running' órfãos (app fechou no meio) como failed.
func (r *JobRepo) ResetRunning(ctx context.Context) error {
	_, err := r.s.db.ExecContext(ctx, `
		UPDATE jobs SET status = ?, error = 'interrompido pelo fechamento do app',
			updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
		WHERE status IN (?, ?)`,
		StatusFailed, StatusQueued, StatusRunning)
	if err != nil {
		return fmt.Errorf("jobs: resetar órfãos: %w", err)
	}
	return nil
}

const selectJobs = `SELECT id, tool_id, status, input_json, output_json, error, progress, created_at, updated_at FROM jobs`

type rowScanner interface{ Scan(dest ...any) error }

func scanJob(rs rowScanner) (*Job, error) {
	var j Job
	var inJSON, outJSON, errStr sql.NullString
	var created, updated string
	if err := rs.Scan(&j.ID, &j.ToolID, &j.Status, &inJSON, &outJSON, &errStr, &j.Progress, &created, &updated); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("jobs: scan: %w", err)
	}
	if errStr.Valid {
		j.Error = errStr.String
	}
	if inJSON.Valid {
		_ = json.Unmarshal([]byte(inJSON.String), &j.Input)
	}
	if outJSON.Valid && outJSON.String != "" {
		_ = json.Unmarshal([]byte(outJSON.String), &j.Output)
	}
	j.CreatedAt = parseTime(created)
	j.UpdatedAt = parseTime(updated)
	return &j, nil
}

func parseTime(s string) time.Time {
	t, err := time.Parse(time.RFC3339Nano, s)
	if err != nil {
		return time.Time{}
	}
	return t
}

func requireRows(res sql.Result) error {
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}
