package middleware

import "testing"

func TestOmitirValidacionOpenAPI(t *testing.T) {
	cases := []struct {
		path string
		want bool
	}{
		{"/auditoria/combinada", true},
		{"/auditoria/http", true},
		{"//auditoria/combinada", true},
		{"/api/auditoria/combinada", true},
		{"/api/auditoria/http", true},
		{"/admin/foo", true},
		{"/datos", true},
		{"/datos/PARCELA-1", true},
		{"/solicitudes", true},
		{"/solicitudes/SOL-1/aprobar", true},
		{"/foo/auditoria/x", false},
		{"/eventos/historial", false},
	}
	for _, tc := range cases {
		if got := omitirValidacionOpenAPI(tc.path); got != tc.want {
			t.Fatalf("%q: got %v want %v", tc.path, got, tc.want)
		}
	}
}
