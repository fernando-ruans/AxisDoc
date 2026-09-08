// coverage-gate falha se a cobertura total for menor que o limite.
// Uso: go run ./scripts/coverage-gate <coverage.out> <minimo %>
package main

import (
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
)

func main() {
	if len(os.Args) < 3 {
		log.Fatal("uso: coverage-gate <arquivo> <minimo%>")
	}
	data, err := os.ReadFile(os.Args[1])
	if err != nil {
		log.Fatalf("ler %s: %v", os.Args[1], err)
	}
	min, err := strconv.ParseFloat(strings.TrimSuffix(os.Args[2], "%"), 64)
	if err != nil {
		log.Fatalf("mínimo inválido: %v", err)
	}

	// profile-format: name.go:line.col,line.col numStmts count
	covered := 0.0
	total := 0.0
	for _, line := range strings.Split(string(data), "\n") {
		if strings.HasPrefix(line, "mode:") || strings.TrimSpace(line) == "" {
			continue
		}
		parts := strings.Fields(line)
		if len(parts) < 3 {
			continue
		}
		var stmts int
		var count int
		if _, err := fmt.Sscanf(parts[1], "%d", &stmts); err != nil {
			continue
		}
		if _, err := fmt.Sscanf(parts[2], "%d", &count); err != nil {
			continue
		}
		total += float64(stmts)
		if count > 0 {
			covered += float64(stmts)
		}
	}
	if total == 0 {
		log.Fatal("coverage-gate: profile vazio")
	}
	pct := covered / total * 100
	fmt.Printf("cobertura: %.1f%% (mínimo: %.1f%%)\n", pct, min)
	if pct < min {
		log.Fatalf("FALHA: cobertura %.1f%% abaixo do mínimo %.1f%%", pct, min)
	}
}
