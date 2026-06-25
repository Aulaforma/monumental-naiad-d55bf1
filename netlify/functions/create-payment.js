// create-payment.js — Netlify Serverless Function
// Genera una preferencia de pago en Mercado Pago

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
};

exports.handler = async function (event) {
    // Handle Preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: CORS_HEADERS, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405, 
            headers: CORS_HEADERS, 
            body: JSON.stringify({ error: 'Método no permitido. Utiliza POST.' }) 
        };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { id_compra, packId, packName, price } = body;

        if (!id_compra || !packId || !packName || !price) {
            return {
                statusCode: 400,
                headers: CORS_HEADERS,
                body: JSON.stringify({ error: 'Faltan parámetros requeridos (id_compra, packId, packName, price).' })
            };
        }

        const mpAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

        // Determinar host base dinámicamente para las URLs de retorno
        const host = event.headers.host || event.headers.Host || 'localhost:3000';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const baseUrl = `${protocol}://${host}`;

        // Simulación si no está configurado el Access Token real
        if (!mpAccessToken || mpAccessToken.trim() === '' || mpAccessToken.startsWith('YOUR_') || mpAccessToken.startsWith('TEST-5290616168532415-062312')) {
            console.log('Simulando preferencia de Mercado Pago (Access Token ausente o de prueba por defecto)...');
            
            // Creamos una URL de pago ficticia que lleva a un simulador de pago local
            const simulatedCheckoutUrl = `${baseUrl}/precios.html?simulated_checkout=true&id_compra=${id_compra}&price=${price}&packName=${encodeURIComponent(packName)}`;
            
            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: JSON.stringify({
                    success: true,
                    init_point: simulatedCheckoutUrl,
                    simulated: true
                })
            };
        }

        // Llamar a Mercado Pago
        const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${mpAccessToken.trim()}`
            },
            body: JSON.stringify({
                items: [
                    {
                        id: String(packId),
                        title: packName,
                        description: `Créditos descargables para Aula Forma - ${packName}`,
                        quantity: 1,
                        unit_price: Number(price),
                        currency_id: 'CLP'
                    }
                ],
                back_urls: {
                    success: `${baseUrl}/perfil.html?status=success`,
                    failure: `${baseUrl}/precios.html?status=failure`,
                    pending: `${baseUrl}/perfil.html?status=pending`
                },
                auto_return: 'approved',
                external_reference: id_compra,
                notification_url: `${baseUrl}/api/mercadopago-webhook`
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Error en API de Mercado Pago: ${response.status} - ${errText}`);
        }

        const data = await response.json();

        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                success: true,
                init_point: data.init_point,
                simulated: false
            })
        };

    } catch (err) {
        console.error('Error en create-payment:', err);
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: err.message })
        };
    }
};
