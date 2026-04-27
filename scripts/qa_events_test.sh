#!/usr/bin/env bash

# Configuración del servidor y API key
API_URL_EVENTOS="http://localhost:3000/eventos/stream"
API_URL_CLIENTES="http://localhost:3000/clientes"
API_KEY="sec-admin"

echo "🚀 Iniciando prueba automatizada del Módulo de Eventos ..."
echo "--------------------------------------------------------"

# 1. Conectarnos al stream de eventos en segundo plano y guardar la salida
echo "📡 Conectando al Stream de Eventos en segundo plano (SSE)..."
curl -s -N -H "X-API-Key: $API_KEY" $API_URL_EVENTOS > eventos_output.log &
CURL_PID=$!

# Esperar 2 segundos para asegurar que la conexión se estableció y el heartbeat llegó
sleep 2

# 2. Disparar una transacción real
ID_PRUEBA="CLI_EVENT_$(date +%s)"
echo "✉️ Enviando transacción de prueba: Registro del cliente $ID_PRUEBA..."

curl -s -X POST $API_URL_CLIENTES \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "clienteId": "'$ID_PRUEBA'",
    "nombre": "Prueba Eventos",
    "tipoDocumento": "CI",
    "numeroDocumento": "123456",
    "fechaAlta": "2026-04-27",
    "estado": "ACTIVO",
    "telefono": "70000000",
    "email": "evento@prueba.com"
  }' # Quitamos el > /dev/null para ver qué dice el servidor

echo ""
echo "✅ Transacción enviada. Esperando 5 segundos a que el evento sea propagado..."
sleep 5

# 3. Leer el log de eventos para verificar si llegó el evento
echo "--------------------------------------------------------"
echo "🔍 Verificando captura del evento en el stream:"
echo ""

if grep -q "$ID_PRUEBA" eventos_output.log; then
    echo " ¡ÉXITO! El evento fue capturado correctamente en el stream."
    # Mostrar el evento capturado formateado (usando jq si está disponible, sino en texto plano)
    grep "$ID_PRUEBA" eventos_output.log | sed 's/^data: //'
else
    echo " ERROR: El evento no apareció en el stream. Verifica si el chaincode está emitiendo eventos."
    echo "Contenido capturado:"
    cat eventos_output.log
fi

# 4. Limpieza: Matar el proceso de escucha en segundo plano y borrar el log temporal
kill $CURL_PID
rm eventos_output.log
echo "--------------------------------------------------------"
echo " Prueba finalizada. Stream desconectado."
