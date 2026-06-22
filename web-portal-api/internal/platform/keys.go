package platform

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"
)

func GenerateAPIKey(tenantID, rol string) (string, error) {
	b := make([]byte, 6)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	suffix := hex.EncodeToString(b)
	rolSlug := strings.ReplaceAll(rol, "_", "-")
	return fmt.Sprintf("%s-%s-%s", tenantID, rolSlug, suffix), nil
}

func GeneratePassword() (string, error) {
	b := make([]byte, 9)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
