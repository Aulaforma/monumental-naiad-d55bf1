const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
});

async function extractText(fileBuffer, mimeType) {
    if (mimeType === 'application/pdf') {
        const data = await pdfParse(fileBuffer);
        return data.text;
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        return result.value;
    } else {
        return fileBuffer.toString('utf-8');
    }
}

// Helper: Call OpenAI ChatGPT for batch generation
async function callChatGPTBatch(text, subject, level, activityType, matrixType, quantities, generalInstruction, rubricType, rubricLevels, rubricCriteria, escalaDescriptoresCount) {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey || apiKey === 'tu_api_key_aqui' || apiKey.trim() === '') {
        console.log('Utilizando simulación de IA (API Key ausente)...');
        return generateMockQuestionsBatch(text, subject, level, activityType, matrixType, quantities, generalInstruction, rubricType, rubricLevels, rubricCriteria, escalaDescriptoresCount);
    }

    try {
        const { OpenAI } = require('openai');
        const openai = new OpenAI({ apiKey });
        
        let systemPrompt = '';
        const isRubric = matrixType === 'rubrica' || matrixType === 'escala_apreciacion';

        if (isRubric) {
            const isEscala = matrixType === 'escala_apreciacion';
            const numDescriptores = parseInt(escalaDescriptoresCount) || 3;
            
            if (isEscala) {
                systemPrompt = `Eres un diseñador instruccional experto y docente de educación en Chile.
Tu tarea es leer la materia entregada y crear una Escala de Apreciación para evaluar la siguiente actividad: ${activityType}.

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
- "indicadores": array de exactamente ${numDescriptores} strings. Cada uno es un indicador observable y concreto (ej: "Menciona al menos 2 fechas importantes", "Explica correctamente las causas del evento").

Ejemplo de esquema:
[
  {
    "criterio": "Contenido",
    "niveles": {
      "Logrado": "",
      "Medianamente Logrado": "",
      "No Logrado": ""
    },
    "indicadores": ["Indicador observable 1", "Indicador observable 2", "Indicador observable 3"]
  }
]`;
            } else {
                systemPrompt = `Eres un diseñador instruccional experto y docente de educación en Chile.
Tu tarea es leer la materia entregada y crear una Rúbrica para evaluar la siguiente actividad: ${activityType}.

Asignatura: ${subject}
Nivel: ${level}
Tipo de Instrumento: Rúbrica ${rubricType === 'analitica' ? 'Analítica (Desglosada por criterios)' : 'Holística (Evaluación global)'}
Instrucción del Docente: "${generalInstruction || 'Ninguna'}"
Criterios Sugeridos: "${rubricCriteria || 'Define los criterios más apropiados según la materia y actividad'}"
Niveles de Desempeño: "${rubricLevels}"

Formato de salida requerido:
Devuelve ÚNICAMENTE un array JSON (sin markdown, sin bloques de código). Cada objeto representa un criterio a evaluar con:
- "criterio": nombre del criterio
- "niveles": objeto donde cada clave es un nivel y el valor es el descriptor detallado (las claves deben coincidir EXACTAMENTE con los provistos en "Niveles de Desempeño")
- "factor": número entero 1 (valor por defecto; el docente podrá cambiarlo a 2 o 3 en la interfaz)

Ejemplo de esquema exacto:
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
                .filter(([_, qty]) => qty > 0)
                .map(([type, qty]) => `- ${qty} preguntas del tipo "${type}"`)
                .join('\n');

            systemPrompt = `Eres un diseñador instruccional experto y docente de educación básica y media de Chile.
Tu tarea es leer la materia entregada por el docente y generar una evaluación oficial.

Asignatura: ${subject}
Nivel: ${level}
Actividad: ${activityType}
Tipo de Instrumento: ${matrixType.replace('_', ' ')}
Instrucción de Enfoque General del Docente: "${generalInstruction || 'Ninguna especificada'}"

Debes generar EXACTAMENTE el siguiente número de preguntas de cada tipo:
${qTypesDesc}

Tipos válidos a generar:
- "abierta": Desarrollo abierto (con enunciado).
- "alternativas": Selección única (con 4 alternativas).
- "verdadero_falso": Enunciado V/F (con justificación).
- "pareados": Relacionar términos (Columna A y Columna B, exactamente 3 pares).
- "completacion": Oraciones con guiones bajos (___).

Formato de salida requerido:
Devuelve ÚNICAMENTE un array JSON (sin markdown, sin bloques de código) con el siguiente esquema exacto:
[
  {
    "type": "abierta | alternativas | verdadero_falso | pareados | completacion",
    "text": "Texto completo de la pregunta",
    "points": 2,
    "correctAnswer": "Para abierta: la respuesta esperada o criterios de corrección. Para alternativas: 'A', 'B', 'C' o 'D'. Para verdadero_falso: 'V' o 'F'. Para completacion: la palabra o palabras correctas (separadas por comas si son varias). Para pareados: dejar vacío o no incluir.",
    "options": ["A", "B", "C", "D"], // Solo para tipo alternativas. De lo contrario, omitir.
    "justify": true, // Solo para tipo verdadero_falso. De lo contrario, omitir.
    "matchingPairs": [ // Solo para tipo pareados. Exactamente 3 pares. De lo contrario, omitir.
      {"colA": "Concepto 1", "colB": "Definición 1"},
      {"colA": "Concepto 2", "colB": "Definición 2"},
      {"colA": "Concepto 3", "colB": "Definición 3"}
    ]
  }
]`;
        }

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Materia o contenido base:\n\n${text.substring(0, 6000)}` }
            ],
            temperature: 0.5,
        });

        const content = response.choices[0].message.content.trim();
        const cleanJson = content.replace(/^```json/, '').replace(/```$/, '').trim();
        return JSON.parse(cleanJson);
    } catch (err) {
        console.error('Error llamando a la API de OpenAI, cayendo a simulación:', err);
        return generateMockQuestionsBatch(text, subject, level, activityType, matrixType, quantities, generalInstruction, rubricType, rubricLevels, rubricCriteria, escalaDescriptoresCount);
    }
}

// Helper: Call OpenAI ChatGPT for single question regeneration
async function callChatGPTRegenerate(text, subject, level, matrixType, type, topic) {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey || apiKey === 'tu_api_key_aqui' || apiKey.trim() === '') {
        console.log('Utilizando simulación de IA para regenerar (API Key ausente)...');
        return generateSingleMockQuestion(subject, type, topic);
    }

    try {
        const { OpenAI } = require('openai');
        const openai = new OpenAI({ apiKey });
        
        const systemPrompt = `Eres un diseñador instruccional experto y docente de educación de Chile.
Tu tarea es leer la materia entregada por el docente y generar una única pregunta de tipo "${type}" sobre el tema específico "${topic}".

Asignatura: ${subject}
Nivel: ${level}
Tipo de Instrumento: ${matrixType.replace('_', ' ')}

Tipos de pregunta:
- "abierta": Desarrollo abierto.
- "alternativas": Selección única (con 4 alternativas).
- "verdadero_falso": Enunciado V/F (con justificación).
- "pareados": Relacionar conceptos (3 parejas Columna A y Columna B).
- "completacion": Oración con guiones bajos (___).

Formato de salida requerido:
Devuelve ÚNICAMENTE un objeto JSON (sin markdown, sin bloques de código) con el siguiente esquema exacto:
{
  "type": "${type}",
  "text": "Texto completo de la pregunta (sin ningún prefijo como '[IA] Basado en...')",
  "points": 2,
  "correctAnswer": "Para abierta: la respuesta esperada o criterios de corrección. Para alternativas: 'A', 'B', 'C' o 'D'. Para verdadero_falso: 'V' o 'F'. Para completacion: la palabra o palabras correctas (separadas por comas si son varias). Para pareados: dejar vacío o no incluir.",
  "options": ["A", "B", "C", "D"], // Solo para alternativas
  "justify": true, // Solo para verdadero_falso
  "matchingPairs": [ // Solo para pareados
    {"colA": "Concepto 1", "colB": "Definición 1"},
    {"colA": "Concepto 2", "colB": "Definición 2"},
    {"colA": "Concepto 3", "colB": "Definición 3"}
  ]
}`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Materia o contenido base:\n\n${text.substring(0, 6000)}` }
            ],
            temperature: 0.5,
        });

        const content = response.choices[0].message.content.trim();
        const cleanJson = content.replace(/^```json/, '').replace(/```$/, '').trim();
        return JSON.parse(cleanJson);
    } catch (err) {
        console.error('Error llamando a la API de OpenAI para regenerar:', err);
        return generateSingleMockQuestion(subject, type, topic);
    }
}

function getNormalizedSubjectKey(subject, text, generalInstruction) {
    let textToAnalyze = (subject || '').toLowerCase().trim();
    
    // If subject is General or empty, try to infer it from other details
    if (textToAnalyze === 'general' || !textToAnalyze) {
        const combined = `${text || ''} ${generalInstruction || ''}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (combined.includes('matematica') || combined.includes('calculo') || combined.includes('suma') || combined.includes('numero') || combined.includes('algebra') || combined.includes('aritmetica')) {
            textToAnalyze = 'matematica';
        } else if (combined.includes('historia') || combined.includes('geografia') || combined.includes('colonia') || combined.includes('independencia') || combined.includes('sociales')) {
            textToAnalyze = 'historia';
        } else if (combined.includes('ciencia') || combined.includes('naturales') || combined.includes('celula') || combined.includes('fotosintesis') || combined.includes('agua')) {
            textToAnalyze = 'ciencias naturales';
        } else {
            textToAnalyze = 'lenguaje';
        }
    }

    const s = textToAnalyze.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove accents
    
    if (s.includes('matematica')) return 'Matemáticas';
    if (s.includes('lenguaje') || s.includes('literatura') || s.includes('comunicacion') || s.includes('castellano') || s.includes('espanol') || s.includes('lectura') || s.includes('gramatica')) return 'Lenguaje';
    if (s.includes('historia') || s.includes('geografia') || s.includes('sociales')) return 'Historia';
    if (s.includes('ciencia') || s.includes('biologia') || s.includes('quimica') || s.includes('fisica') || s.includes('naturales') || s.includes('medio ambiente')) return 'Ciencias Naturales';
    if (s.includes('ingles') || s.includes('english')) return 'Inglés';
    if (s.includes('musica') || s.includes('musical')) return 'Música';
    if (s.includes('tecnologia')) return 'Tecnología';
    if (s.includes('artes') || s.includes('dibujo') || s.includes('plastica')) return 'Artes Visuales';
    if (s.includes('religion') || s.includes('teologia')) return 'Religión';
    if (s.includes('fisica') && (s.includes('educacion') || s.includes('deporte'))) return 'Educación Física';
    
    return 'Lenguaje';
}

// Generate structured
function generateMockQuestionsBatch(text, subject, level, activityType, matrixType, quantities, generalInstruction, rubricType, rubricLevels, rubricCriteria) {
    const isRubric = matrixType === 'rubrica' || matrixType === 'escala_apreciacion';
    
    if (isRubric) {
        const levels = rubricLevels ? rubricLevels.split(',').map(s => s.trim()) : ['Excelente', 'Bueno', 'En proceso', 'Insuficiente'];
        const criteriaList = rubricCriteria ? rubricCriteria.split(',').map(s => s.trim()) : ['Contenido', 'Claridad', 'Presentación', 'Creatividad'];
        
        return criteriaList.map(crit => {
            const row = { criterio: crit, niveles: {} };
            levels.forEach(lvl => {
                row.niveles[lvl] = `[Simulado] Descriptor para el criterio de ${crit} en el nivel ${lvl}.`;
            });
            row.type = 'rubric_row'; // Internal identifier for frontend
            return row;
        });
    }

    const questions = [];

    const pool = {
        'Matemáticas': {
            'abierta': [
                { text: 'Resuelve la operación: 145 ＋ 238 = [ ]. Muestra los pasos.', correctAnswer: 'El alumno debe mostrar la suma columna por columna, llevando 1 a las decenas: 145 + 238 = 383.' },
                { text: 'Calcula el perímetro de un rectángulo cuyos lados miden 12 cm y 6 cm.', correctAnswer: 'Perímetro = 12 + 6 + 12 + 6 = 36 cm.' }
            ],
            'alternativas': [
                { text: '¿Cuál es el valor de x en la ecuación: 3x － 6 = 12?', options: ['x = 4', 'x = 6', 'x = 8', 'x = 18'], correctAnswer: 'B' },
                { text: '¿Cuál es el valor aproximado del símbolo pi (π)?', options: ['3,1416', '2,7182', '1,4142', '0,5772'], correctAnswer: 'A' }
            ],
            'verdadero_falso': [
                { text: 'El área de un triángulo se calcula multiplicando la base por la altura y dividiendo por tres.', justify: true, correctAnswer: 'F' },
                { text: 'El número 0 es un número entero positivo.', justify: true, correctAnswer: 'F' }
            ],
            'pareados': [
                {
                    text: 'Asocia cada concepto geométrico con su definición matemática.',
                    matchingPairs: [
                        { colA: 'Perímetro', colB: 'La suma de las longitudes de los lados.' },
                        { colA: 'Área', colB: 'La medida de la superficie de una figura.' },
                        { colA: 'Hipotenusa', colB: 'El lado de mayor longitud de un triángulo rectángulo.' }
                    ],
                    correctAnswer: ''
                }
            ],
            'completacion': [
                { text: 'Un círculo completo tiene una circunferencia equivalente a _____ grados.', correctAnswer: '360' },
                { text: 'La operación contraria a la multiplicación es la _____.', correctAnswer: 'división' }
            ]
        },
        'Historia': {
            'abierta': [
                { text: 'Explica qué impacto tuvo la Revolución Francesa en la caída de las monarquías absolutas en Europa occidental.', correctAnswer: 'Instauró los principios de soberanía popular, división de poderes y derechos ciudadanos, inspirando movimientos revolucionarios que debilitaron el absolutismo.' },
                { text: 'Describe las causas de la crisis de la sociedad feudal durante el siglo XIV.', correctAnswer: 'Se debió a crisis demográficas (Peste Negra), hambrunas, revueltas campesinas por sobreexplotación y guerras prolongadas que debilitaron el poder señorial.' }
            ],
            'alternativas': [
                { text: '¿En qué año se firmó la Declaración de la Independencia de Chile?', options: ['1810', '1818', '1823', '1826'], correctAnswer: 'B' },
                { text: '¿Cuál fue la principal potencia colonial en América del Norte durante el siglo XVII?', options: ['España', 'Francia', 'Gran Bretaña', 'Portugal'], correctAnswer: 'C' }
            ],
            'verdadero_falso': [
                { text: 'El feudalismo fue el sistema político dominante en Europa Occidental durante la Edad Moderna.', justify: true, correctAnswer: 'F' },
                { text: 'La Primera Guerra Mundial comenzó tras el asesinato del archiduque Francisco Fernando.', justify: true, correctAnswer: 'V' }
            ],
            'pareados': [
                {
                    text: 'Une el personaje histórico con el rol clave que cumplió en el proceso independentista chileno.',
                    matchingPairs: [
                        { colA: 'Bernardo O\'Higgins', colB: 'Director Supremo de la nueva nación soberana.' },
                        { colA: 'José Miguel Carrera', colB: 'Líder patriota impulsor de los primeros símbolos patrios.' },
                        { colA: 'Manuel Rodríguez', colB: 'Guerrillero clave en la resistencia patriota durante la Reconquista.' }
                    ],
                    correctAnswer: ''
                }
            ],
            'completacion': [
                { text: 'La principal actividad económica durante la época de la Colonia en Chile fue la _____ y el comercio de cueros.', correctAnswer: 'agricultura' },
                { text: 'El período comprendido entre 1823 y 1830 en Chile es conocido como el de la Organización de la _____.', correctAnswer: 'República' }
            ]
        },
        'Lenguaje': {
            'abierta': [
                { text: 'Lee el fragmento de la obra y responde: ¿Qué sentimientos intenta expresar el protagonista?', correctAnswer: 'Debe aludir a la melancolía y la nostalgia del protagonista por el hogar perdido, justificando con citas textuales.' },
                { text: 'Explica las principales funciones que cumple un narrador omnisciente en un relato literario.', correctAnswer: 'Conoce todos los pensamientos, sentimientos y motivaciones de los personajes, organiza la trama y posee una perspectiva externa y objetiva.' }
            ],
            'alternativas': [
                { text: '¿Cuál de las siguientes palabras es un sinónimo de "Efímero"?', options: ['Duradero', 'Pasajero', 'Permanente', 'Eterno'], correctAnswer: 'B' },
                { text: 'El conector "sin embargo" se clasifica dentro de la categoría de:', options: ['Causales', 'Adversativos', 'Consecutivos', 'Explicativos'], correctAnswer: 'B' }
            ],
            'verdadero_falso': [
                { text: 'Las novelas son textos dramáticos que están escritos principalmente para ser representados.', justify: true, correctAnswer: 'F' },
                { text: 'Las palabras esdrújulas siempre llevan tilde en su antepenúltima sílaba.', justify: true, correctAnswer: 'V' }
            ],
            'pareados': [
                {
                    text: 'Asocia cada figura retórica con su respectivo ejemplo poético.',
                    matchingPairs: [
                        { colA: 'Metáfora', colB: 'Tus cabellos son hilos de oro puro.' },
                        { colA: 'Hipérbole', colB: 'Te lloré todo un río de lágrimas.' },
                        { colA: 'Personificación', colB: 'El viento silbaba una triste canción.' }
                    ],
                    correctAnswer: ''
                }
            ],
            'completacion': [
                { text: 'La palabra "canción" es aguda porque su sílaba tónica se encuentra en la _____ sílaba y termina en N.', correctAnswer: 'última' },
                { text: 'El núcleo del predicado en una oración simple siempre corresponde a un _____.', correctAnswer: 'verbo' }
            ]
        },
        'Ciencias Naturales': {
            'abierta': [
                { text: 'Explica los procesos de evaporación y condensación que ocurren dentro del ciclo del agua.', correctAnswer: 'La evaporación es el paso de líquido a gas por calentamiento solar. La condensación es el paso de gas a líquido por enfriamiento en la atmósfera, formando nubes.' },
                { text: 'Describe las diferencias estructurales principales entre una célula procariota y una eucariota.', correctAnswer: 'Las células procariotas carecen de núcleo delimitado por membrana y organelos membranosos, mientras que las eucariotas los poseen.' }
            ],
            'alternativas': [
                { text: '¿Qué organelo de la célula vegetal se encarga del proceso de fotosíntesis?', options: ['Mitocondria', 'Cloroplasto', 'Núcleo', 'Ribosoma'], correctAnswer: 'B' },
                { text: 'La unidad básica de la materia que conserva sus propiedades químicas es el:', options: ['Átomo', 'Molécula', 'Elemento', 'Compuesto'], correctAnswer: 'A' }
            ],
            'verdadero_falso': [
                { text: 'La materia experimenta un cambio químico cuando sus propiedades internas cambian formando nuevas sustancias.', justify: true, correctAnswer: 'V' },
                { text: 'La fuerza de gravedad atrae los cuerpos hacia la superficie terrestre solo en el vacío.', justify: true, correctAnswer: 'F' }
            ],
            'pareados': [
                {
                    text: 'Asocia cada nivel ecológico con el ejemplo correspondiente.',
                    matchingPairs: [
                        { colA: 'Individuo', colB: 'Un zorro chilla específico en el bosque.' },
                        { colA: 'Población', colB: 'Un grupo de zorros chilla viviendo en la misma zona geográfica.' },
                        { colA: 'Ecosistema', colB: 'El bosque completo con sus factores bióticos y abióticos.' }
                    ],
                    correctAnswer: ''
                }
            ],
            'completacion': [
                { text: 'El estado de la materia donde las partículas tienen máxima movilidad y no poseen forma fija es el estado _____.', correctAnswer: 'gaseoso' },
                { text: 'El proceso por el cual las plantas producen su alimento a partir de luz solar es la _____.', correctAnswer: 'fotosíntesis' }
            ]
        }
    };

    const normalizedSub = getNormalizedSubjectKey(subject, text, generalInstruction);
    const db = pool[normalizedSub] || pool['Lenguaje'];

    Object.keys(quantities).forEach(type => {
        const qty = parseInt(quantities[type]) || 0;
        const typeList = db[type] || [];

        for (let i = 0; i < qty; i++) {
            const template = typeList[i % typeList.length];
            const instructionSuffix = generalInstruction ? ` (Enfoque: ${generalInstruction.substring(0, 30)})` : '';
            const textContent = `${template.text}${instructionSuffix}`;
            
            if (type === 'alternativas') {
                questions.push({
                    type: 'alternativas',
                    text: textContent,
                    points: 2,
                    options: [...template.options],
                    correctAnswer: template.correctAnswer
                });
            } else if (type === 'verdadero_falso') {
                questions.push({
                    type: 'verdadero_falso',
                    text: textContent,
                    points: 2,
                    justify: template.justify,
                    correctAnswer: template.correctAnswer
                });
            } else if (type === 'pareados') {
                questions.push({
                    type: 'pareados',
                    text: textContent,
                    points: 3,
                    matchingPairs: template.matchingPairs.map(p => ({ ...p })),
                    correctAnswer: ''
                });
            } else if (type === 'completacion') {
                questions.push({
                    type: 'completacion',
                    text: textContent,
                    points: 1,
                    correctAnswer: template.correctAnswer
                });
            } else {
                // abierta
                questions.push({
                    type: 'abierta',
                    text: textContent,
                    points: 3,
                    correctAnswer: template.correctAnswer
                });
            }
        }
    });

    return questions;
}

// Generate a single mock question based on specific topic
function generateSingleMockQuestion(subject, type, topic) {
    const topicLabel = topic ? topic.trim() : 'Contenido General';
    const fallbackDb = {
        'abierta': { text: `Explica detalladamente la importancia de "${topicLabel}" analizando sus causas y efectos.`, correctAnswer: `El alumno debe fundamentar utilizando los contenidos de la unidad sobre ${topicLabel}.` },
        'alternativas': {
            text: `¿Cuál de las siguientes afirmaciones describe de mejor manera el concepto de "${topicLabel}"?`,
            options: [`Definición principal de ${topicLabel}`, `Alternativa de distracción A`, `Alternativa de distracción B`, `Ninguna de las anteriores`],
            correctAnswer: 'A'
        },
        'verdadero_falso': {
            text: `El concepto de "${topicLabel}" fue sumamente relevante en los procesos históricos y sociales estudiados.`,
            justify: true,
            correctAnswer: 'V'
        },
        'pareados': {
            text: `Relaciona los conceptos principales asociados a "${topicLabel}" con su respectivo ejemplo o definición.`,
            matchingPairs: [
                { colA: `${topicLabel} (Básico)`, colB: `Definición básica relacionada con ${topicLabel}.` },
                { colA: `${topicLabel} (Medio)`, colB: `Definición intermedia del concepto.` },
                { colA: `${topicLabel} (Complejo)`, colB: `Definición experta del tema.` }
            ],
            correctAnswer: ''
        },
        'completacion': { text: `El descubrimiento o el análisis de la materia sobre "${topicLabel}" concluye que el _____ es fundamental.`, correctAnswer: 'conocimiento' }
    };

    const template = fallbackDb[type] || fallbackDb['abierta'];

    if (type === 'alternativas') {
        return {
            type: 'alternativas',
            text: template.text,
            points: 2,
            options: [...template.options],
            correctAnswer: template.correctAnswer
        };
    } else if (type === 'verdadero_falso') {
        return {
            type: 'verdadero_falso',
            text: template.text,
            points: 2,
            justify: template.justify,
            correctAnswer: template.correctAnswer
        };
    } else if (type === 'pareados') {
        return {
            type: 'pareados',
            text: template.text,
            points: 3,
            matchingPairs: template.matchingPairs.map(p => ({ ...p })),
            correctAnswer: ''
        };
    } else if (type === 'completacion') {
        return {
            type: 'completacion',
            text: template.text,
            points: 1,
            correctAnswer: template.correctAnswer
        };
    } else {
        return {
            type: 'abierta',
            text: template.text,
            points: 3,
            correctAnswer: template.correctAnswer
        };
    }
}

// API Endpoint: Upload material and generate questions by quantity mapping
app.post('/api/upload-materia', upload.single('materia'), async (req, res) => {
    try {
        const { subject, level, activityType, matrixType, quantitiesJson, generalInstruction, rubricType, rubricLevels, rubricCriteria, escalaDescriptoresCount } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'No se subió ningún archivo de materia.' });
        }

        const quantities = JSON.parse(quantitiesJson || '{}');
        console.log(`Procesando materia para: ${subject}, ${level}, Actividad: ${activityType}, Matriz: ${matrixType}.`, quantities);

        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'Falta token de autorización' });
        }
        
        const cost = parseInt(req.body.cost) || 1;

        // Validar y descontar créditos en Supabase
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

            if (!rpcResponse.ok) throw new Error('Error al conectar con base de datos de créditos.');
            
            const hasCredits = await rpcResponse.json();
            if (!hasCredits) {
                return res.status(402).json({ error: 'Créditos insuficientes.' });
            }
        } catch (dbErr) {
            console.error("Error validando créditos:", dbErr);
            return res.status(500).json({ error: 'Error interno validando créditos.' });
        }

        // 1. Extract text
        const text = await extractText(file.buffer, file.mimetype);
        console.log(`Texto extraído con éxito (${text.length} caracteres).`);

        // 2. Call ChatGPT
        const generatedQuestions = await callChatGPTBatch(text, subject, level, activityType, matrixType, quantities, generalInstruction, rubricType, rubricLevels, rubricCriteria, escalaDescriptoresCount);

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
                tipo_instrumento: matrixType,
                creditos_usados: cost,
                nombre_documento: file.name || 'Material IA'
            })
        }).catch(err => console.error("Error guardando historial:", err));

        res.json({
            success: true,
            questions: generatedQuestions,
            characterCount: text.length
        });

    } catch (err) {
        console.error('Error en /api/upload-materia:', err);
        res.status(500).json({ error: 'Ocurrió un error al procesar el archivo o llamar a la IA.' });
    }
});

// API Endpoint: Regenerate single item based on topic instruction
app.post('/api/regenerate-item', upload.single('materia'), async (req, res) => {
    try {
        const { subject, level, matrixType, type, topic } = req.body;
        const file = req.file;
        let text = '';

        if (file) {
            text = await extractText(file.buffer, file.mimetype);
        } else {
            text = 'No document loaded';
        }

        console.log(`Regenerando ítem individual para: ${subject}, tipo: ${type}, tema: ${topic}.`);
        const question = await callChatGPTRegenerate(text, subject, level, matrixType, type, topic);

        res.json({
            success: true,
            question
        });
    } catch (err) {
        console.error('Error en /api/regenerate-item:', err);
        res.status(500).json({ error: 'Error al regenerar la pregunta.' });
    }
});

// API Endpoint: Mock docx generation
app.post('/api/generate-docx', (req, res) => {
    const { subject, level, matrixType, questions, totalPoints, docente, depto, institucion } = req.body;
    
    res.json({
        success: true,
        message: `Archivo matriz_${matrixType}.docx modificado con éxito.`,
        downloadUrl: `#`,
        details: {
            subject,
            level,
            matrixType,
            docente,
            depto,
            institucion,
            questionsCount: questions.length,
            totalPoints
        }
    });
});

// Bridge Netlify Functions to Express for local testing
const createPaymentHandler = require('./netlify/functions/create-payment').handler;
const webhookHandler = require('./netlify/functions/mercadopago-webhook').handler;

function netlifyExpressBridge(handler) {
    return async (req, res) => {
        const event = {
            httpMethod: req.method,
            body: JSON.stringify(req.body),
            headers: req.headers,
            queryStringParameters: req.query
        };
        try {
            const result = await handler(event);
            res.status(result.statusCode).set(result.headers).send(result.body);
        } catch (err) {
            console.error("Local Bridge Error:", err);
            res.status(500).json({ error: err.message });
        }
    };
}

app.all('/api/create-payment', netlifyExpressBridge(createPaymentHandler));
app.all('/api/mercadopago-webhook', netlifyExpressBridge(webhookHandler));

app.listen(PORT, () => {
    console.log(`Servidor de desarrollo escuchando en http://localhost:${PORT}`);
});

module.exports = app;
