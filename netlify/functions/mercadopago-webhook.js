// mercadopago-webhook.js — Netlify Serverless Function
// Recibe las notificaciones de pago e incrementa los créditos del usuario en Supabase

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Content-Type': 'application/json',
};

exports.handler = async function (event) {
    // Handle Preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: CORS_HEADERS, body: '' };
    }

    // Permitir GET/POST para soportar notificaciones de Mercado Pago y simulaciones de desarrollo
    if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
        return { 
            statusCode: 405, 
            headers: CORS_HEADERS, 
            body: JSON.stringify({ error: 'Método no permitido. Utiliza POST o GET.' }) 
        };
    }

    try {
        let paymentId = '';
        let type = '';
        let isSimulation = false;
        let idCompraSimulada = '';

        // 1. Obtener parámetros de consulta (Query Params)
        if (event.queryStringParameters) {
            paymentId = event.queryStringParameters['data.id'] || event.queryStringParameters['id'] || '';
            type = event.queryStringParameters['type'] || event.queryStringParameters['topic'] || '';
            
            // Lógica de simulación para desarrollo local
            if (event.queryStringParameters['simulate_approval'] === 'true') {
                isSimulation = true;
                idCompraSimulada = event.queryStringParameters['id_compra'] || '';
                paymentId = event.queryStringParameters['payment_id'] || `SIM-${Date.now()}`;
            }
        }

        // 2. Obtener parámetros del cuerpo de la petición (JSON Body)
        if (!paymentId && event.body) {
            try {
                const body = JSON.parse(event.body);
                if (body.data && body.data.id) {
                    paymentId = String(body.data.id);
                }
                if (body.type) {
                    type = body.type;
                }
            } catch (e) {
                console.warn('No se pudo analizar el JSON del body:', e.message);
            }
        }

        console.log(`Webhook de pago recibido: ID Pago = ${paymentId}, Tipo = ${type}, Simulación = ${isSimulation}`);

        // Si no es tipo pago y no es simulación, ignoramos la notificación de Mercado Pago (retornando 200 OK)
        if (type !== 'payment' && !isSimulation) {
            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: JSON.stringify({ message: 'Notificación ignorada (no es tipo payment).' })
            };
        }

        const mpAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
        const supabaseUrl = process.env.SUPABASE_URL || 'https://wqxirepowxepclatszge.supabase.co';
        const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_QV7HuSdWwVra9G6HgZ8Uqw_T3zJlAwM';
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        let id_compra = '';
        let total_monto = 0;

        if (isSimulation) {
            id_compra = idCompraSimulada;
            console.log(`Procesando aprobación simulada para la compra: ${id_compra}`);
        } else {
            // Consultar a Mercado Pago por los detalles de la transacción
            if (!mpAccessToken || mpAccessToken.trim() === '' || mpAccessToken.startsWith('YOUR_')) {
                return {
                    statusCode: 400,
                    headers: CORS_HEADERS,
                    body: JSON.stringify({ error: 'Falta configurar MERCADOPAGO_ACCESS_TOKEN en el servidor.' })
                };
            }

            const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
                headers: {
                    'Authorization': `Bearer ${mpAccessToken.trim()}`
                }
            });

            if (!mpResponse.ok) {
                const errText = await mpResponse.text();
                throw new Error(`Error consultando pago en Mercado Pago: ${mpResponse.status} - ${errText}`);
            }

            const paymentData = await mpResponse.json();

            // Validar que el pago esté aprobado
            if (paymentData.status !== 'approved') {
                console.log(`El pago ${paymentId} no está aprobado. Estado actual: ${paymentData.status}`);
                return {
                    statusCode: 200,
                    headers: CORS_HEADERS,
                    body: JSON.stringify({ message: `Pago no aprobado. Estado: ${paymentData.status}` })
                };
            }

            id_compra = paymentData.external_reference;
            total_monto = paymentData.transaction_amount;
            console.log(`Pago aprobado en Mercado Pago: Compra = ${id_compra}, Monto = ${total_monto}`);
        }

        if (!id_compra) {
            return {
                statusCode: 400,
                headers: CORS_HEADERS,
                body: JSON.stringify({ error: 'No se encontró la referencia externa id_compra.' })
            };
        }

        // Definir cabeceras para Supabase usando Service Role Key (bypassea RLS)
        const finalSupabaseKey = (supabaseServiceKey && supabaseServiceKey.trim() !== '' && !supabaseServiceKey.startsWith('YOUR_')) 
            ? supabaseServiceKey 
            : supabaseKey;

        const supabaseHeaders = {
            'apikey': finalSupabaseKey.trim(),
            'Authorization': `Bearer ${finalSupabaseKey.trim()}`,
            'Content-Type': 'application/json',
        };

        // 3. Consultar la compra en la base de datos de Supabase
        const selectResponse = await fetch(`${supabaseUrl}/rest/v1/compras?id_compra=eq.${id_compra}&select=*,packs_creditos(cantidad_creditos)`, {
            headers: supabaseHeaders
        });

        if (!selectResponse.ok) {
            const errText = await selectResponse.text();
            throw new Error(`Error consultando compra en Supabase: ${selectResponse.status} - ${errText}`);
        }

        const purchases = await selectResponse.json();
        if (!purchases || purchases.length === 0) {
            return {
                statusCode: 404,
                headers: CORS_HEADERS,
                body: JSON.stringify({ error: `Compra con ID ${id_compra} no encontrada en Supabase.` })
            };
        }

        const compra = purchases[0];

        // Verificar si la compra ya fue procesada anteriormente
        if (compra.estado_pago === 'aprobado') {
            console.log(`La compra ${id_compra} ya había sido aprobada anteriormente.`);
            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: JSON.stringify({ success: true, message: 'La compra ya estaba aprobada.' })
            };
        }

        const creditosToAdd = compra.packs_creditos ? compra.packs_creditos.cantidad_creditos : 0;
        const id_usuario = compra.id_usuario;

        console.log(`Acreditando compra: Usuario = ${id_usuario}, Créditos a cargar = ${creditosToAdd}`);

        // 4. Actualizar el estado de la compra en Supabase
        const updatePurchaseResponse = await fetch(`${supabaseUrl}/rest/v1/compras?id_compra=eq.${id_compra}`, {
            method: 'PATCH',
            headers: supabaseHeaders,
            body: JSON.stringify({
                estado_pago: 'aprobado',
                fecha_activacion: new Date().toISOString()
            })
        });

        if (!updatePurchaseResponse.ok) {
            const errText = await updatePurchaseResponse.text();
            throw new Error(`Error actualizando estado de compra: ${updatePurchaseResponse.status} - ${errText}`);
        }

        // 5. Obtener los créditos actuales del perfil del usuario
        const profileResponse = await fetch(`${supabaseUrl}/rest/v1/perfiles?id=eq.${id_usuario}`, {
            headers: supabaseHeaders
        });

        if (!profileResponse.ok) {
            const errText = await profileResponse.text();
            throw new Error(`Error consultando perfil en Supabase: ${profileResponse.status} - ${errText}`);
        }

        const profiles = await profileResponse.json();
        const perfil = profiles[0];
        const creditosActuales = perfil ? perfil.creditos_disponibles : 0;
        const nuevosCreditos = creditosActuales + creditosToAdd;

        // 6. Actualizar los créditos en el perfil del usuario
        const updateProfileResponse = await fetch(`${supabaseUrl}/rest/v1/perfiles?id=eq.${id_usuario}`, {
            method: 'PATCH',
            headers: supabaseHeaders,
            body: JSON.stringify({
                creditos_disponibles: nuevosCreditos
            })
        });

        if (!updateProfileResponse.ok) {
            const errText = await updateProfileResponse.text();
            throw new Error(`Error actualizando créditos en el perfil: ${updateProfileResponse.status} - ${errText}`);
        }

        // 7. Insertar el movimiento en movimientos_creditos para auditoría
        const insertAuditResponse = await fetch(`${supabaseUrl}/rest/v1/movimientos_creditos`, {
            method: 'POST',
            headers: supabaseHeaders,
            body: JSON.stringify({
                id_usuario: id_usuario,
                tipo_movimiento: 'carga',
                cantidad_creditos: creditosToAdd,
                motivo: isSimulation 
                    ? `Carga simulada por compra aprobada (ID: ${paymentId})` 
                    : `Carga automática por compra aprobada (Pago MP: ${paymentId})`
            })
        });

        if (!insertAuditResponse.ok) {
            const errText = await insertAuditResponse.text();
            console.error(`Error guardando auditoría de movimiento (no crítico): ${insertAuditResponse.status} - ${errText}`);
        }

        console.log(`¡Compra ${id_compra} acreditada con éxito! Créditos totales: ${nuevosCreditos}`);

        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                success: true,
                message: 'Pago procesado y créditos asignados correctamente.',
                creditos_cargados: creditosToAdd,
                nuevos_creditos: nuevosCreditos
            })
        };

    } catch (err) {
        console.error('Error en webhook de Mercado Pago:', err);
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: err.message })
        };
    }
};
