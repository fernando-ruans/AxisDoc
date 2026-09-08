package jobs

import (
	"crypto/rand"
	"encoding/hex"
)

func generateID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		// fallback improvável; IDs precisam ser únicos
		panic("jobs: gerar id: " + err.Error())
	}
	return hex.EncodeToString(b)
}
