// regenerate-item.js — Netlify Serverless Function
// Uses built-in fetch only (no external npm dependencies)

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
};

// ---------------------------------------------------------------------------
// Simple multipart parser (pure Node.js, no busboy)
// ---------------------------------------------------------------------------
function parseMultipartForm(event) {
    const contentType =
        event.headers['content-type'] ||
        event.headers['Content-Type'] ||
        '';

    const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
    if (!boundaryMatch) throw new Error('No boundary found in Content-Type');

    const boundary = boundaryMatch[1];
    const body = event.isBase64Encoded
        ? Buffer.from(event.body, 'base64')
        : Buffer.from(event.body || '', 'binary');

    const fields = {};
    const files = {};

    const boundaryBuf = Buffer.from('--' + boundary);
    const parts = splitBuffer(body, boundaryBuf);

    for (const part of parts) {
        if (part.length === 0) continue;

        const crlf2 = findSequence(part, Buffer.from('\r\n\r\n'));
        if (crlf2 === -1) continue;

        const headerSection = part.slice(0, crlf2).toString('utf-8');
        const cleanHeaders = headerSection.replace(/^\r\n/, '');
        const partBody = part.slice(crlf2 + 4);
        const content = partBody.slice(0, partBody.length - 2);

        const dispMatch = cleanHeaders.match(/Content-Disposition:[^\r\n]*name="([^"]+)"/i);
        if (!dispMatch) continue;
        const fieldName = dispMatch[1];

        const fileMatch = cleanHeaders.match(/Content-Disposition:[^\r\n]*filename="([^"]+)"/i);
        const ctMatch = cleanHeaders.match(/Content-Type:\s*([^\r\n]+)/i);

        if (fileMatch) {
            files[fieldName] = {
                buffer: content,
                filename: fileMatch[1],
                mimetype: (ctMatch ? ctMatch[1].trim() : 'application/octet-stream'),
            };
        } else {
            fields[fieldName] = content.toString('utf-8');
        }
    }

    return { fields, files };
}

function splitBuffer(buf, delimiter) {
    const parts = [];
    let start = 0;
    let pos = findSequence(buf, delimiter, start);
    while (pos !== -1) {
        parts.push(buf.slice(start, pos));
        start = pos + delimiter.length;
        pos = findSequence(buf, delimiter, start);
    }
    parts.push(buf.slice(start));
    return parts;
}

function findSequence(buf, seq, offset = 0) {
    outer: for (let i = offset; i <= buf.length - seq.length; i++) {
        for (let j = 0; j < seq.length; j++) {
            if (buf[i + j] !== seq[j]) continue outer;
        }
        return i;
    }
    return -1;
}

// ---------------------------------------------------------------------------
// Text extractor
// ---------------------------------------------------------------------------
async function extractText(buffer, mimetype) {
    try {
        if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            return extractReadableStrings(buffer);
        }
        if (mimetype === 'application/pdf') {
            return extractReadableStrings(buffer);
        }
        return buffer.toString('utf-8');
    } catch (e) {
        return extractReadableStrings(buffer);
    }
}

function extractReadableStrings(buffer) {
    const str = buffer.toString('latin1');
    const readable = [];
    let current = '';
    for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i);
        if (c >= 32 && c < 127) {
            current += str[i];
        } else {
            if (current.length >= 4) readable.push(current.trim());
            current = '';
        }
    }
    if (current.length >= 4) readable.push(current.trim());
    return readable.filter(s => s.length > 3).join(' ').substring(0, 8000);
}

// ---------------------------------------------------------------------------
// Mock fallback for single item
// ---------------------------------------------------------------------------
function generateMockSingleQuestion(type, topic) {
    const label = topic || 'Contenido General';
    const templates = {
        abierta: {
            text: `Explica detalladamente la importancia de "${label}", analizando sus causas y consecuencias principales.`,
            correctAnswer: `El alumno debe fundamentar utilizando los contenidos de la unidad sobre ${label}.`,
        },
        alternativas: {
            text: `¿Cuál de las siguientes afirmaciones describe de mejor manera el concepto de "${label}"?`,
            options: [`Definición principal de ${label}`, `Alternativa de distracción A`, `Alternativa de distracción B`, `Ninguna de las anteriores`],
            correctAnswer: 'A',
        },
        verdadero_falso: {
            text: `El concepto de "${label}" fue relevante en los procesos estudiados en esta unidad.`,
            justify: true,
            correctAnswer: 'V',
        },
        pareados: {
            text: `Relaciona los conceptos asociados a "${label}" con su definición correspondiente.`,
            matchingPairs: [
                { colA: `${label} (Básico)`, colB: `Definición básica de ${label}.` },
                { colA: `${label} (Intermedio)`, colB: `Definición intermedia del concepto.` },
                { colA: `${label} (Avanzado)`, colB: `Definición experta o compleja del tema.` },
            ],
            correctAnswer: '',
        },
        completacion: {
            text: `El concepto central relacionado con "${label}" en esta unidad es el _____.`,
            correctAnswer: 'conocimiento del tema',
        },
    };

    const tmpl = templates[type] || templates.abierta;
    const q = {
        type,
        text: tmpl.text,
        points: (type === 'alternativas' || type === 'verdadero_falso') ? 2 : (type === 'pareados' ? 3 : 1),
        correctAnswer: tmpl.correctAnswer || '',
    };
    if (type === 'alternativas') q.options = [...tmpl.options];
    if (type === 'verdadero_falso') q.justify = tmpl.justify;
    if (type === 'pareados') q.matchingPairs = tmpl.matchingPairs.map(p => ({ ...p }));
    return q;
}

// ---------------------------------------------------------------------------
// OpenAI single-item call using native fetch
// ---------------------------------------------------------------------------
async function callOpenAISingle(text, subject, level, matrixType, type, topic) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.trim() === '' || apiKey === 'tu_api_key_aqui') {
        console.log('Sin API Key → usando simulación.');
        return generateMockSingleQuestion(type, topic);
    }

    const systemPrompt = `Eres un diseñador instruccional experto y docente de educación de Chile.
Genera UNA ÚNICA pregunta de tipo "${type}" sobre el tema "${topic}".

Asignatura: ${subject}
Nivel: ${level}
Tipo de Instrumento: ${(matrixType || '').replace('_', ' ')}

Devuelve ÚNICAMENTE un objeto JSON (sin markdown, sin bloques de código):
{
  "type": "${type}",
  "text": "Texto de la pregunta (sin prefijos como '[IA] Basado en...')",
  "points": 2,
  "correctAnswer": "Para abierta: criterios. Para alternativas: 'A','B','C' o 'D'. Para verdadero_falso: 'V' o 'F'. Para completacion: la(s) palabra(s). Para pareados: vacío.",
  "options": ["opción A", "opción B", "opción C", "opción D"],
  "justify": true,
  "matchingPairs": [
    {"colA": "Concepto 1", "colB": "Definición 1"},
    {"colA": "Concepto 2", "colB": "Definición 2"},
    {"colA": "Concepto 3", "colB": "Definición 3"}
  ]
}`;

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Materia base:\n\n${text.substring(0, 6000)}` },
                ],
                temperature: 0.5,
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`OpenAI API error ${response.status}: ${errText}`);
        }

        const json = await response.json();
        const raw = json.choices[0].message.content.trim();
        const clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
        return JSON.parse(clean);

    } catch (err) {
        console.error('OpenAI fetch error → simulación:', err.message);
        return generateMockSingleQuestion(type, topic);
    }
}

// ---------------------------------------------------------------------------
// Netlify Function handler
// ---------------------------------------------------------------------------
exports.handler = async function (event) {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: CORS_HEADERS, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    try {
        const authHeader = event.headers.authorization || event.headers.Authorization;
        if (!authHeader) {
            return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Falta token de autorización' }) };
        }

        const { fields, files } = parseMultipartForm(event);
        const { subject, level, matrixType, type, topic } = fields;

        let text = 'Sin documento base.';
        if (files && files.materia) {
            text = await extractText(files.materia.buffer, files.materia.mimetype);
        }

        const question = await callOpenAISingle(text, subject, level, matrixType, type, topic);

        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({ success: true, question }),
        };
    } catch (err) {
        console.error('Handler error:', err);
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: `Error al regenerar: ${err.message}` }),
        };
    }
};
