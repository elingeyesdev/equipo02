package fabric

import (
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/hyperledger/fabric-gateway/pkg/client"
	"github.com/hyperledger/fabric-gateway/pkg/identity"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
)

// GlobalGateway es la instancia persistente del cliente de Fabric.
var GlobalGateway *client.Gateway

// Connect establece la conexión con la red Fabric.
func Connect() error {
	mspID := os.Getenv("MSPID")
	certPath := os.Getenv("CERT_PATH")
	keyPathDir := os.Getenv("KEY_PATH_DIR")
	tlsCertPath := os.Getenv("TLS_CERT_PATH")
	peerEndpoint := os.Getenv("PEER_ENDPOINT")
	peerHostAlias := os.Getenv("PEER_HOST_ALIAS")

	// 1. Cargar Certificado de Identidad
	id, err := loadIdentity(mspID, certPath)
	if err != nil {
		return fmt.Errorf("error al cargar identidad: %w", err)
	}

	// 2. Cargar Llave Privada (Firmante Manual)
	signer, err := loadSigner(keyPathDir)
	if err != nil {
		return fmt.Errorf("error al cargar firmante: %w", err)
	}

	// 3. Crear conexión gRPC con TLS
	grpcConn, err := createGrpcConnection(tlsCertPath, peerEndpoint, peerHostAlias)
	if err != nil {
		return fmt.Errorf("error de conexión gRPC: %w", err)
	}

	// 4. Conectar al Gateway
	gw, err := client.Connect(
		id,
		client.WithSign(signer),
		client.WithClientConnection(grpcConn),
		client.WithEvaluateTimeout(5*time.Second),
		client.WithEndorseTimeout(15*time.Second),
		client.WithSubmitTimeout(5*time.Second),
		client.WithCommitStatusTimeout(1*time.Minute),
	)
	if err != nil {
		return fmt.Errorf("error al conectar con el Gateway: %w", err)
	}

	GlobalGateway = gw
	return nil
}

func loadIdentity(mspID string, certPath string) (identity.Identity, error) {
	certBytes, err := os.ReadFile(certPath)
	if err != nil {
		return nil, err
	}

	block, _ := pem.Decode(certBytes)
	if block == nil {
		return nil, errors.New("error al decodificar el certificado PEM")
	}

	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("error al parsear el certificado: %w", err)
	}

	return identity.NewX509Identity(mspID, cert)
}

func loadSigner(keyPathDir string) (func(digest []byte) ([]byte, error), error) {
	files, err := os.ReadDir(keyPathDir)
	if err != nil {
		return nil, err
	}

	var keyFile string
	for _, file := range files {
		if !file.IsDir() && filepath.Ext(file.Name()) != ".pem" {
			keyFile = filepath.Join(keyPathDir, file.Name())
			break
		}
	}
	if keyFile == "" && len(files) > 0 {
		keyFile = filepath.Join(keyPathDir, files[0].Name())
	}

	keyBytes, err := os.ReadFile(keyFile)
	if err != nil {
		return nil, err
	}

	block, _ := pem.Decode(keyBytes)
	if block == nil {
		return nil, errors.New("error al decodificar la llave privada PEM")
	}

	privateKey, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		privateKey, err = x509.ParseECPrivateKey(block.Bytes)
		if err != nil {
			return nil, fmt.Errorf("error al parsear la llave privada: %w", err)
		}
	}

	signer, err := identity.NewPrivateKeySign(privateKey)
	if err != nil {
		return nil, fmt.Errorf("error al crear el signer oficial: %w", err)
	}

	return signer, nil
}

func createGrpcConnection(tlsCertPath string, peerEndpoint string, peerHostAlias string) (*grpc.ClientConn, error) {
	cert, err := os.ReadFile(tlsCertPath)
	if err != nil {
		return nil, err
	}

	certPool := x509.NewCertPool()
	certPool.AppendCertsFromPEM(cert)

	creds := credentials.NewClientTLSFromCert(certPool, peerHostAlias)
	return grpc.Dial(peerEndpoint, grpc.WithTransportCredentials(creds))
}
