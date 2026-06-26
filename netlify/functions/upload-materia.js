// upload-materia.js — Netlify Serverless Function
// Uses built-in fetch + manual multipart parsing (no external npm dependencies)

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

        // Find the double CRLF separating headers from body
        const crlf2 = findSequence(part, Buffer.from('\r\n\r\n'));
        if (crlf2 === -1) continue;

        const headerSection = part.slice(0, crlf2).toString('utf-8');
        // Remove leading CRLF if present
        const cleanHeaders = headerSection.replace(/^\r\n/, '');
        const partBody = part.slice(crlf2 + 4);

        // Remove trailing CRLF
        const content = partBody.slice(0, partBody.length - 2);

        // Parse Content-Disposition
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
// Text extractor — DOCX: unzip + parse XML; PDF: pass raw text (best effort)
// ---------------------------------------------------------------------------
async function extractText(buffer, mimetype) {
    try {
        if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            // Extract text from DOCX using the zlib/unzip approach
            return extractDocxText(buffer);
        }
        if (mimetype === 'application/pdf') {
            // PDF binary → try to pull readable text strings
            return extractPdfText(buffer);
        }
        return buffer.toString('utf-8');
    } catch (e) {
        console.error('extractText error:', e.message);
        return buffer.toString('utf-8');
    }
}

function extractDocxText(buffer) {
    try {
        // DOCX is a ZIP; extract readable XML text between <w:t> tags
        const str = buffer.toString('binary');
        // Look for XML patterns
        const xmlStart = str.indexOf('<?xml');
        if (xmlStart === -1) {
            // Try to find w:t patterns directly (may be compressed)
            // Fall back to any readable text
            return extractReadableStrings(buffer);
        }
        const xml = str.slice(xmlStart);
        const textParts = [];
        const regex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
        let match;
        while ((match = regex.exec(xml)) !== null) {
            if (match[1].trim()) textParts.push(match[1]);
        }
        return textParts.join(' ') || extractReadableStrings(buffer);
    } catch (e) {
        return extractReadableStrings(buffer);
    }
}

function extractPdfText(buffer) {
    try {
        // Extract readable ASCII strings from PDF binary
        return extractReadableStrings(buffer);
    } catch (e) {
        return buffer.toString('latin1');
    }
}

function extractReadableStrings(buffer) {
    // Pull readable strings (min length 4) from binary buffer
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
// Mock fallback
// ---------------------------------------------------------------------------
function generateMockQuestions(subject, quantities, generalInstruction, matrixType, rubricType, rubricLevels, rubricCriteria, escalaDescriptoresCount) {
    const isRubric = matrixType === 'rubrica' || matrixType === 'escala_apreciacion';
    if (isRubric) {
        const isEscala = matrixType === 'escala_apreciacion';
        const isHolistica = matrixType === 'rubrica' && rubricType === 'holistica';
        const levels = rubricLevels ? rubricLevels.split(',').map(s => s.trim()) : ['Excelente', 'Bueno', 'En proceso', 'Insuficiente'];
        const criteriaList = rubricCriteria ? rubricCriteria.split(',').map(s => s.trim()) : ['Contenido', 'Claridad', 'Presentación', 'Creatividad'];
        const numIndicadores = parseInt(escalaDescriptoresCount) || 3;
        
        if (isHolistica) {
            return levels.map((lvl, lIdx) => {
                const pts = levels.length - lIdx;
                return {
                    nivel: lvl,
                    puntaje: pts,
                    descripcion: `[Simulado] Descripción detallada del desempeño global para el nivel ${lvl} (${pts} puntos).`,
                    type: 'rubric_row_holistic'
                };
            });
        }

        return criteriaList.map(crit => {
            const row = { criterio: crit, niveles: {} };
            if (!isEscala) {
                levels.forEach(lvl => {
                    row.niveles[lvl] = `[Simulado] Descriptor para el criterio de ${crit} en el nivel ${lvl}.`;
                });
                row.factor = 1;
            } else {
                levels.forEach(lvl => {
                    row.niveles[lvl] = '';
                });
                row.indicadores = Array.from({ length: numIndicadores }, (_, i) => `[Simulado] Indicador observable ${i + 1} para el criterio de ${crit}.`);
            }
            row.type = 'rubric_row';
            return row;
        });
    }

    const pool = {
        abierta: [
            { text: 'Explica los principales conceptos evaluados en esta unidad y su relevancia actual.', correctAnswer: 'El alumno debe explicar los conceptos con fundamentos, ejemplos y coefiencia argumental.' },
            { text: 'Describe las causas y consecuencias del proceso histórico/científico abordado en la unidad.', correctAnswer: 'El alumno debe mencionar al menos 3 causas y 3 consecuencias con justificación.' },
        ],
        alternativas: [
            { text: '¿Cuál de las siguientes afirmaciones describe correctamente el concepto principal de la unidad?', options: ['Definición correcta y completa del concepto central.', 'Definición parcial con elementos incorrectos.', 'Definición que confunde dos conceptos distintos.', 'Ninguna de las opciones anteriores.'], correctAnswer: 'A' },
        ],
        verdadero_falso: [
            { text: 'Los conceptos centrales de esta unidad tienen un impacto directo en el contexto histórico, social o científico estudiado.', justify: true, correctAnswer: 'V' },
        ],
        pareados: [
            { text: 'Relaciona cada concepto de la Columna A con su definición en la Columna B.', matchingPairs: [{ colA: 'Concepto principal', colB: 'Fundamento teórico central del tema evaluado.' }, { colA: 'Proceso clave', colB: 'Secuencia de pasos que da origen al fenómeno estudiado.' }, { colA: 'Resultado observable', colB: 'Evidencia empírica o histórica del proceso en acción.' }], correctAnswer: '' },
        ],
        completacion: [
            { text: 'El proceso principal abordado en esta unidad se denomina _____.', correctAnswer: 'el concepto central de la unidad' },
        ],
    };

    const questions = [];
    Object.keys(quantities).forEach(type => {
        const qty = parseInt(quantities[type]) || 0;
        const typePool = pool[type] || pool.abierta;
        for (let i = 0; i < qty; i++) {
            const tmpl = typePool[i % typePool.length];
            const suffix = generalInstruction ? ` (Énfasis: ${generalInstruction.substring(0, 30)})` : '';
            const q = {
                type,
                text: `${tmpl.text}${suffix}`,
                points: (type === 'alternativas' || type === 'verdadero_falso') ? 2 : (type === 'pareados' ? 3 : 1),
                correctAnswer: tmpl.correctAnswer || '',
            };
            if (type === 'alternativas') q.options = [...tmpl.options];
            if (type === 'verdadero_falso') q.justify = tmpl.justify;
            if (type === 'pareados') q.matchingPairs = tmpl.matchingPairs.map(p => ({ ...p }));
            questions.push(q);
        }
    });
    return questions;
}

// ---------------------------------------------------------------------------
// OpenAI API call using native fetch (no npm dependency)
// ---------------------------------------------------------------------------
async function callOpenAI(text, subject, level, matrixType, quantities, generalInstruction, rubricType, rubricLevels, rubricCriteria, escalaDescriptoresCount) {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey || apiKey.trim() === '' || apiKey === 'tu_api_key_aqui') {
        console.log('Sin API Key → usando simulación.');
        return generateMockQuestions(subject, quantities, generalInstruction, matrixType, rubricType, rubricLevels, rubricCriteria, escalaDescriptoresCount);
    }

    let systemPrompt = '';
    const isRubric = matrixType === 'rubrica' || matrixType === 'escala_apreciacion';

    if (isRubric) {
        const isEscala = matrixType === 'escala_apreciacion';
        const numDescriptores = parseInt(escalaDescriptoresCount) || 3;

        if (isEscala) {
            systemPrompt = `Eres un diseñador instruccional experto y docente de educación en Chile.
Tu tarea es leer la materia entregada y crear una Escala de Apreciación para evaluar la siguiente actividad.

Asignatura: ${subject}
Nivel: ${level}
Instrucción del Docente: "${generalInstruction || 'Ninguna'}"
Criterios Sugeridos: "${rubricCriteria || 'Define los criterios más apropiados según la materia y actividad'}"
Niveles de Desempeño: "${rubricLevels}"
Número de descriptores/indicadores por criterio: ${numDescriptores}

Formato de salida requerido:
Devuelve ÚNICAMENTE un array JSON (sin markdown, sin bloques de código). Cada objeto representa un criterio a evaluar.
Cada criterio debe tener:
- "criterio": nombre del criterio
- "niveles": objeto con los niveles de desempeño (las claves deben coincidir EXACTAMENTE con los provistos en "Niveles de Desempeño")
- "indicadores": array de exactamente ${numDescriptores} strings. Cada uno es un indicador observable y concreto.

Ejemplo:
[
  {
    "criterio": "Contenido",
    "niveles": {"Logrado": "", "Medianamente Logrado": "", "No Logrado": ""},
    "indicadores": ["Menciona al menos 2 fechas importantes", "Explica las causas principales", "Relaciona el tema con el contexto actual"]
  }
]`;
        } else if (rubricType === 'holistica') {
            systemPrompt = `Eres un diseñador instruccional experto y docente de educación en Chile.
Tu tarea es leer la materia entregada y crear una Rúbrica Holística (Evaluación Global) para evaluar la siguiente actividad.

Asignatura: ${subject}
Nivel: ${level}
Tipo de Instrumento: Rúbrica Holística (Evaluación global sin desglosar por criterios)
Instrucción del Docente: "${generalInstruction || 'Ninguna'}"
Niveles de Desempeño a utilizar: "${rubricLevels}"

Formato de salida requerido:
Devuelve ÚNICAMENTE un array JSON (sin markdown, sin bloques de código). Cada objeto representa un nivel de desempeño de la escala con:
- "nivel": nombre del nivel o escala (deben coincidir EXACTAMENTE con los provistos en "Niveles de Desempeño a utilizar", o ser ordenados de mayor a menor puntaje)
- "puntaje": el puntaje correspondiente a este nivel (número entero, ej: si hay 4 niveles, el máximo es 4 y el mínimo es 1; o si son números del 0 al 5, usar ese número directamente)
- "descripcion": la descripción global y detallada de lo que el estudiante debe lograr para obtener este nivel en la actividad.
- "type": "rubric_row_holistic"

Ejemplo de esquema exacto:
[
  {
    "nivel": "Excelente",
    "puntaje": 4,
    "descripcion": "Descripción detallada del desempeño global excelente...",
    "type": "rubric_row_holistic"
  },
  {
    "nivel": "Bueno",
    "puntaje": 3,
    "descripcion": "Descripción detallada del desempeño global bueno...",
    "type": "rubric_row_holistic"
  }
]`;
        } else {
            systemPrompt = `Eres un diseñador instruccional experto y docente de educación en Chile.
Tu tarea es leer la materia entregada y crear una Rúbrica para evaluar la siguiente actividad.

Asignatura: ${subject}
Nivel: ${level}
Tipo de Instrumento: Rúbrica Analítica (Desglosada por criterios)
Instrucción del Docente: "${generalInstruction || 'Ninguna'}"
Criterios Sugeridos: "${rubricCriteria || 'Define los criterios más apropiados según la materia y actividad'}"
Niveles de Desempeño: "${rubricLevels}"

Formato de salida requerido:
Devuelve ÚNICAMENTE un array JSON (sin markdown, sin bloques de código). Cada objeto tiene:
- "criterio": nombre del criterio
- "niveles": objeto donde cada clave es un nivel y el valor es el descriptor detallado (las claves deben coincidir EXACTAMENTE con los provistos en "Niveles de Desempeño")
- "factor": número entero 1 (el docente podrá cambiarlo a 2 o 3 en la interfaz)

Ejemplo:
[
  {
    "criterio": "Contenido",
    "niveles": {
      "Excelente": "Descriptor detallado...",
      "Bueno": "Descriptor detallado...",
      "En proceso": "Descriptor detallado...",
      "Insuficiente": "Descriptor detallado..."
    },
    "factor": 1
  }
]`;
        }
    } else {
        const qTypesDesc = Object.entries(quantities)
            .filter(([, qty]) => qty > 0)
            .map(([type, qty]) => `- ${qty} preguntas de tipo "${type}"`)
            .join('\n');

        systemPrompt = `Eres un diseñador instruccional experto y docente de educación básica y media de Chile.
Lee la materia entregada y genera una evaluación oficial.

Asignatura: ${subject}
Nivel: ${level}
Tipo de Instrumento: ${(matrixType || '').replace('_', ' ')}
Instrucción del docente: "${generalInstruction || 'Ninguna especificada'}"

Genera EXACTAMENTE:
${qTypesDesc}

Devuelve ÚNICAMENTE un array JSON (sin markdown, sin bloques de código) con este esquema:
[
  {
    "type": "abierta|alternativas|verdadero_falso|pareados|completacion",
    "text": "Texto de la pregunta (sin ningún prefijo como '[IA] Basado en...')",
    "points": 2,
    "correctAnswer": "Para abierta: criterios de corrección. Para alternativas: 'A','B','C' o 'D'. Para verdadero_falso: 'V' o 'F'. Para completacion: la(s) palabra(s) correcta(s). Para pareados: dejar vacío.",
    "options": ["opción A", "opción B", "opción C", "opción D"],
    "justify": true,
    "matchingPairs": [
      {"colA": "Concepto 1", "colB": "Definición 1"},
      {"colA": "Concepto 2", "colB": "Definición 2"},
      {"colA": "Concepto 3", "colB": "Definición 3"}
    ]
  }
]`;
    }

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
                    { role: 'user', content: `Materia base para generar las preguntas:\n\n${text.substring(0, 6000)}` },
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
        console.error('OpenAI fetch error → usando simulación:', err.message);
        return generateMockQuestions(subject, quantities, generalInstruction);
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
        const { fields, files } = parseMultipartForm(event);
        const { subject, level, matrixType, activityType, quantitiesJson, generalInstruction, rubricType, rubricLevels, rubricCriteria, escalaDescriptoresCount, cost: costStr } = fields;
        const quantities = JSON.parse(quantitiesJson || '{}');

        // Autenticación y Descuento de créditos (Supabase)
        const authHeader = event.headers.authorization || event.headers.Authorization;
        if (!authHeader) {
            return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Falta token de autorización' }) };
        }
        
        const cost = parseInt(costStr) || 1;
        const supabaseUrl = process.env.SUPABASE_URL || 'https://wqxirepowxepclatszge.supabase.co';
        const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_QV7HuSdWwVra9G6HgZ8Uqw_T3zJlAwM';
        
        try {
            const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/descontar_creditos`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': authHeader,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({ cantidad: cost })
            });

            if (!rpcResponse.ok) {
                console.error("Error RPC Supabase:", await rpcResponse.text());
                throw new Error('Error al conectar con base de datos de créditos.');
            }
            
            const hasCredits = await rpcResponse.json();
            if (!hasCredits) {
                return { statusCode: 402, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Créditos insuficientes.' }) };
            }
        } catch (dbErr) {
            console.error("Error validando créditos:", dbErr);
            return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Error interno validando créditos.' }) };
        }

        let text = 'Sin texto base disponible.';
        if (files && files.materia) {
            text = await extractText(files.materia.buffer, files.materia.mimetype);
            console.log(`Texto extraído: ${text.length} caracteres.`);
        }

        const questions = await callOpenAI(text, subject, level, matrixType, quantities, generalInstruction, rubricType, rubricLevels, rubricCriteria, escalaDescriptoresCount);

        // Guardar registro en documentos_generados (fire and forget)
        fetch(`${supabaseUrl}/rest/v1/documentos_generados`, {
            method: 'POST',
            headers: {
                'apikey': supabaseKey,
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                asignatura: subject,
                curso: level,
                tipo_instrumento: matrixType || 'Desconocido',
                creditos_usados: cost,
                nombre_documento: (files && files.materia) ? files.materia.filename : 'Material IA'
            })
        }).catch(err => console.error("Error guardando historial:", err));

        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({ success: true, questions, characterCount: text.length }),
        };
    } catch (err) {
        console.error('Handler error:', err);
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: `Error al procesar: ${err.message}` }),
        };
    }
};
