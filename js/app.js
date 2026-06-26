document.addEventListener('DOMContentLoaded', () => {
    // Views
    const dashboardView = document.getElementById('dashboard-view');
    const creatorView = document.getElementById('creator-view');
    const headerText = document.getElementById('header-text');

    // State
    let currentSubject = '';
    let questions = [];
    let insigniaImage = null; // Will store Base64 data URL
    let principalImage = null;
    let apoyoGenImage = null;
    let recurso1Image = null;
    let recurso2Image = null;
    let recurso3Image = null;
    let analisisImage = null;
    let graficoImage = null;
    let currentPreviewTab = 'student'; // 'student' or 'teacher'
    let subjectStates = {}; // Store independent state per subject

    // DOM Elements - Navigation
    const btnDashboard = document.getElementById('btn-dashboard');
    const btnNuevaEvaluacion = document.getElementById('btn-nueva-evaluacion');
    const btnVolver = document.getElementById('btn-volver');
    const navItems = document.querySelectorAll('.nav-menu .nav-item');
    const selectedSubjectBadge = document.getElementById('selected-subject-badge');

    // DOM Elements - Dashboard New Elements
    const subjectSelector = document.getElementById('subject-selector');
    const otraSubjectContainer = document.getElementById('otra-subject-container');
    const subjectOtraInput = document.getElementById('subject-otra-input');
    const btnStartEvaluation = document.getElementById('btn-start-evaluation');

    // DOM Elements - Institutional Details
    const evalDocente = document.getElementById('eval-docente');
    const evalDepto = document.getElementById('eval-depto');
    const evalInstitucion = document.getElementById('eval-institucion');
    const imgInsignia = document.getElementById('img-insignia');
    const badgeInsigniaLabel = document.getElementById('badge-insignia-label');

    const previewTeacherName = document.getElementById('preview-teacher-name');
    const previewDeptName = document.getElementById('preview-dept-name');
    const previewSchoolName = document.getElementById('preview-school-name');
    const previewInsigniaImg = document.getElementById('preview-insignia-img');
    const previewInsigniaText = document.getElementById('preview-insignia-text');

    const evalUnit = document.getElementById('eval-unit');
    const evalObjectives = document.getElementById('eval-objectives');
    const evalIncludeAutoeval = document.getElementById('eval-include-autoeval');

    const previewUnit = document.getElementById('preview-unit');
    const previewObjectives = document.getElementById('preview-objectives');

    // DOM Elements - Form / Preview Config
    const evalLevel = document.getElementById('eval-level');
    const evalActivity = document.getElementById('eval-activity');
    const evalMatrix = document.getElementById('eval-matrix');
    const btnAddQuestion = document.getElementById('btn-add-question');
    const questionsList = document.getElementById('questions-list');
    const btnGenerate = document.getElementById('btn-generate');

    // DOM Elements - Panels and Rubrics
    const panelCantidades = document.getElementById('panel-cantidades');
    const panelRubrica = document.getElementById('panel-rubrica');
    const rubricType = document.getElementById('rubric-type');
    const rubricLevels = document.getElementById('rubric-levels');
    const rubricCriteria = document.getElementById('rubric-criteria');
    const rubricFactorRow = document.getElementById('rubric-factor-row');
    const escalaDescriptoresRow = document.getElementById('escala-descriptores-row');
    const escalaDescriptoresCount = document.getElementById('escala-descriptores-count');
    const rubricTypeRow = document.getElementById('rubric-type-row');

    // DOM Elements - IA Upload
    const materiaUpload = document.getElementById('materia-upload');
    const btnGenerateIA = document.getElementById('btn-generate-ia');
    const iaLoadingSpinner = document.getElementById('ia-loading-spinner');
    const previewQuestions = document.getElementById('preview-questions');
    const previewTotalPoints = document.getElementById('preview-total-points');
    const previewLevelBadge = document.getElementById('preview-level-badge');
    const previewTitle = document.getElementById('preview-title');
    const iaInstructionGeneral = document.getElementById('ia-instruction-general');

    // DOM Elements - IA Quantities inputs
    const cntAbierta = document.getElementById('cnt-abierta');
    const cntAlternativas = document.getElementById('cnt-alternativas');
    const cntVf = document.getElementById('cnt-vf');
    const cntPareados = document.getElementById('cnt-pareados');
    const cntCompletacion = document.getElementById('cnt-completacion');

    // Helper: Convert File to Base64
    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });
    }

    function getNormalizedSubjectKey(subject) {
        let textToAnalyze = (subject || '').toLowerCase().trim();
        
        // If subject is General or empty, try to infer it from other visible inputs in DOM
        if (textToAnalyze === 'general' || !textToAnalyze) {
            const unitVal = document.getElementById('eval-unit')?.value || '';
            const objVal = document.getElementById('eval-objectives')?.value || '';
            const instVal = document.getElementById('ia-instruction-general')?.value || '';
            const combined = `${unitVal} ${objVal} ${instVal}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            
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

        const s = textToAnalyze.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove accents/tildes
        
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
        
        return 'Lenguaje'; // Default fallback
    }

    // Mock Questions Database for local browser simulation
    const mockQuestionsDb = {
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

    // --- Navigation Functions ---
    function showDashboard() {
        dashboardView.style.display = 'block';
        creatorView.style.display = 'none';
        headerText.style.display = 'block';
        
        navItems.forEach(nav => nav.classList.remove('active'));
        btnDashboard.classList.add('active');
    }

    function saveCurrentSubjectState() {
        if (!currentSubject) return;
        subjectStates[currentSubject] = {
            questions: [...questions],
            evalUnit: evalUnit ? evalUnit.value : '',
            evalObjectives: evalObjectives ? evalObjectives.value : '',
            iaInstructionGeneral: iaInstructionGeneral ? iaInstructionGeneral.value : '',
            evalIncludeAutoeval: evalIncludeAutoeval ? evalIncludeAutoeval.checked : true,
            evalLevel: evalLevel ? evalLevel.value : '1° básico',
            evalActivity: evalActivity ? evalActivity.value : 'prueba_sumativa',
            evalMatrix: evalMatrix ? evalMatrix.value : 'evaluacion_escrita',
            cntAbierta: cntAbierta ? cntAbierta.value : '2',
            cntAlternativas: cntAlternativas ? cntAlternativas.value : '2',
            cntVf: cntVf ? cntVf.value : '2',
            cntPareados: cntPareados ? cntPareados.value : '1',
            cntCompletacion: cntCompletacion ? cntCompletacion.value : '1',
            rubricType: rubricType ? rubricType.value : 'analitica',
            rubricLevels: rubricLevels ? rubricLevels.value : 'Excelente, Bueno, En proceso, Insuficiente',
            rubricCriteria: rubricCriteria ? rubricCriteria.value : ''
        };
    }

    function showCreator(subject) {
        saveCurrentSubjectState();
        currentSubject = subject || 'General';
        dashboardView.style.display = 'none';
        creatorView.style.display = 'flex';
        headerText.style.display = 'none';
        
        selectedSubjectBadge.textContent = currentSubject;
        previewTitle.textContent = `Evaluación de ${currentSubject}`;
        
        navItems.forEach(nav => nav.classList.remove('active'));
        btnNuevaEvaluacion.classList.add('active');

        // Load existing state for the selected subject, or initialize default
        const state = subjectStates[currentSubject] || {
            questions: [],
            evalUnit: '',
            evalObjectives: '',
            iaInstructionGeneral: '',
            evalIncludeAutoeval: true,
            evalLevel: '1° básico',
            evalActivity: 'prueba_sumativa',
            evalMatrix: 'evaluacion_escrita',
            cntAbierta: '2',
            cntAlternativas: '2',
            cntVf: '2',
            cntPareados: '1',
            cntCompletacion: '1',
            rubricType: 'analitica',
            rubricLevels: 'Excelente, Bueno, En proceso, Insuficiente',
            rubricCriteria: ''
        };

        questions = [...state.questions];
        questionsList.innerHTML = '';
        materiaUpload.value = ''; // Always clear file input for security/ux
        
        if (evalUnit) evalUnit.value = state.evalUnit;
        if (evalObjectives) evalObjectives.value = state.evalObjectives;
        if (iaInstructionGeneral) iaInstructionGeneral.value = state.iaInstructionGeneral;
        if (evalIncludeAutoeval) evalIncludeAutoeval.checked = state.evalIncludeAutoeval;
        if (evalLevel) evalLevel.value = state.evalLevel;
        if (evalActivity) evalActivity.value = state.evalActivity;
        if (evalMatrix) evalMatrix.value = state.evalMatrix;
        if (cntAbierta) cntAbierta.value = state.cntAbierta;
        if (cntAlternativas) cntAlternativas.value = state.cntAlternativas;
        if (cntVf) cntVf.value = state.cntVf;
        if (cntPareados) cntPareados.value = state.cntPareados;
        if (cntCompletacion) cntCompletacion.value = state.cntCompletacion;
        if (rubricType) rubricType.value = state.rubricType;
        if (rubricLevels) rubricLevels.value = state.rubricLevels;
        if (rubricCriteria) rubricCriteria.value = state.rubricCriteria;

        // Trigger change event to update UI visibility
        if (evalActivity) {
            evalActivity.dispatchEvent(new Event('change'));
        }

        updateMetadataHeader();
        
        renderQuestions();
    }

    // --- Institutional Profile Handler ---
    function updateSchoolHeader() {
        previewTeacherName.textContent = evalDocente.value.trim() || '_________________';
        previewDeptName.textContent = evalDepto.value.trim() || '_________________';
        previewSchoolName.textContent = evalInstitucion.value.trim() || '_________________';
    }

    function updateMetadataHeader() {
        if (previewUnit && evalUnit) {
            previewUnit.textContent = evalUnit.value.trim() || '_________________________________';
        }
        if (previewObjectives && evalObjectives) {
            previewObjectives.textContent = evalObjectives.value.trim() || '_________________________________';
        }
        if (previewLevelBadge && evalLevel) {
            previewLevelBadge.textContent = `Nivel: ${evalLevel.value}`;
        }
    }

    evalDocente.addEventListener('input', updateSchoolHeader);
    evalDepto.addEventListener('input', updateSchoolHeader);
    evalInstitucion.addEventListener('input', updateSchoolHeader);

    evalUnit.addEventListener('input', updateMetadataHeader);
    evalObjectives.addEventListener('input', updateMetadataHeader);
    evalLevel.addEventListener('change', updateMetadataHeader);

    // Dynamic visibility for Activity and Matrix
    function updatePanelVisibility() {
        const matVal = evalMatrix ? evalMatrix.value : 'evaluacion_escrita';
        if (matVal === 'evaluacion_escrita') {
            if (panelCantidades) panelCantidades.style.display = 'flex';
            if (panelRubrica) panelRubrica.style.display = 'none';
            if (rubricFactorRow) rubricFactorRow.style.display = 'none';
            if (escalaDescriptoresRow) escalaDescriptoresRow.style.display = 'none';
            if (rubricTypeRow) rubricTypeRow.style.display = 'none';
        } else if (matVal === 'rubrica') {
            if (panelCantidades) panelCantidades.style.display = 'none';
            if (panelRubrica) panelRubrica.style.display = 'flex';
            if (rubricFactorRow) rubricFactorRow.style.display = 'flex';
            if (escalaDescriptoresRow) escalaDescriptoresRow.style.display = 'none';
            if (rubricTypeRow) rubricTypeRow.style.display = 'flex';
        } else if (matVal === 'escala_apreciacion') {
            if (panelCantidades) panelCantidades.style.display = 'none';
            if (panelRubrica) panelRubrica.style.display = 'flex';
            if (rubricFactorRow) rubricFactorRow.style.display = 'none';
            if (escalaDescriptoresRow) escalaDescriptoresRow.style.display = 'flex';
            if (rubricTypeRow) rubricTypeRow.style.display = 'none';
        }
    }

    if (evalActivity && evalMatrix) {
        evalActivity.addEventListener('change', () => {
            if (evalActivity.value === 'prueba_sumativa') {
                evalMatrix.value = 'evaluacion_escrita';
                evalMatrix.options[1].disabled = true;
                evalMatrix.options[2].disabled = true;
            } else {
                evalMatrix.options[1].disabled = false;
                evalMatrix.options[2].disabled = false;
                if (evalMatrix.value === 'evaluacion_escrita') {
                    evalMatrix.value = 'rubrica';
                }
            }
            updatePanelVisibility();
        });

        evalMatrix.addEventListener('change', () => {
            updatePanelVisibility();
        });
    }

    if (evalIncludeAutoeval) {
        evalIncludeAutoeval.addEventListener('change', () => {
            renderQuestions(); // Re-render to toggle Autoevaluación
        });
    }

    // Insignia Upload handler (Convert to Base64)
    imgInsignia.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                insigniaImage = await fileToBase64(file);
                previewInsigniaImg.src = insigniaImage;
                previewInsigniaImg.style.display = 'block';
                previewInsigniaText.style.display = 'none';
                badgeInsigniaLabel.textContent = `✓ Insignia`;
                imgInsignia.parentElement.classList.add('has-file');
            } catch (err) {
                console.error('Error al leer la insignia:', err);
            }
        } else {
            insigniaImage = null;
            previewInsigniaImg.style.display = 'none';
            previewInsigniaText.style.display = 'block';
            badgeInsigniaLabel.textContent = 'Subir Insignia';
            imgInsignia.parentElement.classList.remove('has-file');
        }
    });

    // Resource Images Upload Setup
    const setupResourceImageUploader = (inputId, labelId, stateVarSetter) => {
        const input = document.getElementById(inputId);
        const label = document.getElementById(labelId);
        if (input && label) {
            input.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    try {
                        const base64 = await fileToBase64(file);
                        stateVarSetter(base64);
                        label.textContent = `✓ ${file.name.substring(0, 12)}...`;
                        input.parentElement.classList.add('has-file');
                        renderQuestions(); // Re-render preview
                    } catch (err) {
                        console.error(`Error al leer imagen ${inputId}:`, err);
                    }
                } else {
                    stateVarSetter(null);
                    label.textContent = 'Subir Imagen';
                    input.parentElement.classList.remove('has-file');
                    renderQuestions();
                }
            });
        }
    };

    setupResourceImageUploader('img-principal', 'label-img-principal', (val) => { principalImage = val; });
    setupResourceImageUploader('img-apoyo-gen', 'label-img-apoyo-gen', (val) => { apoyoGenImage = val; });
    setupResourceImageUploader('img-recurso1', 'label-img-recurso1', (val) => { recurso1Image = val; });
    setupResourceImageUploader('img-recurso2', 'label-img-recurso2', (val) => { recurso2Image = val; });
    setupResourceImageUploader('img-recurso3', 'label-img-recurso3', (val) => { recurso3Image = val; });
    setupResourceImageUploader('img-analisis', 'label-img-analisis', (val) => { analisisImage = val; });
    setupResourceImageUploader('img-grafico', 'label-img-grafico', (val) => { graficoImage = val; });

    // --- IA Generation Logic ---
    btnGenerateIA.addEventListener('click', async () => {
        const file = materiaUpload.files[0];
        if (!file) {
            alert('Por favor, selecciona un archivo de materia (.pdf, .docx o .txt) primero.');
            return;
        }

        const quantities = {
            abierta: parseInt(cntAbierta.value) || 0,
            alternativas: parseInt(cntAlternativas.value) || 0,
            verdadero_falso: parseInt(cntVf.value) || 0,
            pareados: parseInt(cntPareados.value) || 0,
            completacion: parseInt(cntCompletacion.value) || 0
        };

        const isRubric = evalMatrix.value === 'rubrica' || evalMatrix.value === 'escala_apreciacion';
        const totalToGenerate = Object.values(quantities).reduce((a, b) => a + b, 0);
        
        if (!isRubric && totalToGenerate === 0) {
            alert('Por favor, configura al menos 1 pregunta en las cantidades por tipo.');
            return;
        }

        // --- Verificación de Créditos ---
        const session = await getCurrentSession();
        if (!session) {
            alert('Debes iniciar sesión para usar el generador.');
            window.location.href = 'auth.html';
            return;
        }

        let cost = 1;
        if (evalMatrix.value === 'evaluacion_escrita' && evalIncludeAutoeval.checked) {
            cost = 2; // Evaluación con pauta
        } else if (evalMatrix.value === 'rubrica' || evalMatrix.value === 'escala_apreciacion') {
            cost = 1; // Rúbrica o Escala por sí sola
            if (evalActivity.value !== 'prueba_sumativa') {
                // Si viene de otra actividad, asume que solo genera rubrica
                cost = 1; 
            }
        }
        // Nota: El costo exacto se validará mejor en el backend según la complejidad.

        const { profile, error } = await getOrCreateProfile(session);
        if (!profile) {
            console.error("Error al obtener o crear perfil:", error);
            alert('No se pudo cargar tu información de perfil. Si eres el administrador, por favor verifica que hayas ejecutado el archivo sql/schema.sql en tu panel de Supabase.');
            return;
        }
        if (profile.creditos_disponibles < cost) {
            alert('No tienes créditos suficientes. Compra un pack para seguir generando documentos en Word.');
            window.location.href = 'precios.html';
            return;
        }
        // --------------------------------

        btnGenerateIA.disabled = true;
        iaLoadingSpinner.style.display = 'flex';
        questionsList.innerHTML = '';
        previewQuestions.innerHTML = '<p class="empty-questions-notice">Procesando documento con IA...</p>';

        const formData = new FormData();
        formData.append('materia', file);
        formData.append('subject', currentSubject);
        formData.append('level', evalLevel.value);
        formData.append('activityType', evalActivity.value);
        formData.append('matrixType', evalMatrix.value);
        formData.append('generalInstruction', iaInstructionGeneral.value);
        formData.append('quantitiesJson', JSON.stringify(quantities));
        formData.append('cost', cost); // Enviar el costo calculado al backend
        
        if (isRubric) {
            formData.append('rubricType', rubricType.value);
            formData.append('rubricLevels', rubricLevels.value);
            formData.append('rubricCriteria', rubricCriteria.value);
            if (evalMatrix.value === 'escala_apreciacion' && escalaDescriptoresCount) {
                formData.append('escalaDescriptoresCount', escalaDescriptoresCount.value || '3');
            }
        }

        try {
            const response = await fetch('/api/upload-materia', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: formData
            });

            if (!response.ok) {
                if(response.status === 402) {
                    throw new Error('Créditos insuficientes.');
                }
                throw new Error('Error de conexión');
            }

            const data = await response.json();
            if (data.success && data.questions) {
                loadQuestionsIntoState(data.questions);
                alert(`[Servidor Local] ¡Evaluación generada con éxito! Se procesó "${file.name}" y la IA recomendó ${questions.length} preguntas distribuidas por tipos.`);
            } else {
                throw new Error('Fallo de estructura');
            }

        } catch (error) {
            console.warn('El servidor local no está disponible. Iniciando simulación local en el navegador...', error);
            
            setTimeout(() => {
                const isRubric = evalMatrix.value === 'rubrica' || evalMatrix.value === 'escala_apreciacion';
                if (isRubric) {
                    const rLevels = rubricLevels.value ? rubricLevels.value.split(',').map(s => s.trim()) : ['Excelente', 'Bueno', 'En proceso', 'Insuficiente'];
                    const rCriteria = rubricCriteria.value ? rubricCriteria.value.split(',').map(s => s.trim()) : ['Contenido', 'Claridad', 'Presentación', 'Creatividad'];
                    const isEscala = evalMatrix.value === 'escala_apreciacion';
                    const numIndicadores = escalaDescriptoresCount ? parseInt(escalaDescriptoresCount.value) || 3 : 3;
                    
                    const generated = rCriteria.map(crit => {
                        const row = { criterio: crit, niveles: {} };
                        if (!isEscala) {
                            rLevels.forEach(lvl => {
                                row.niveles[lvl] = `[Simulado] Descriptor para el criterio de ${crit} en el nivel ${lvl} para la actividad de ${evalActivity.options[evalActivity.selectedIndex].text}.`;
                            });
                            row.factor = 1;
                        } else {
                            // Escala de apreciación: solo niveles Logrado/Medianamente Logrado/No Logrado
                            rLevels.forEach(lvl => {
                                row.niveles[lvl] = '';
                            });
                            row.indicadores = Array.from({ length: numIndicadores }, (_, i) => `[Simulado] Indicador ${i + 1} para el criterio de ${crit}.`);
                        }
                        row.type = 'rubric_row';
                        return row;
                    });
                    
                    loadQuestionsIntoState(generated);
                    alert(`[Simulación del Navegador] ¡${evalMatrix.value === 'rubrica' ? 'Rúbrica' : 'Escala'} generada con éxito!`);
                    return;
                }

                const normalizedSub = getNormalizedSubjectKey(currentSubject);
                const db = mockQuestionsDb[normalizedSub] || mockQuestionsDb['Lenguaje'];
                const generated = [];

                Object.keys(quantities).forEach(type => {
                    const qty = quantities[type];
                    const typeList = db[type] || [];

                    for (let i = 0; i < qty; i++) {
                        const template = typeList[i % typeList.length];
                        const instructionText = iaInstructionGeneral.value ? ` (Enfoque: ${iaInstructionGeneral.value.substring(0, 30)})` : '';
                        
                        const questionObj = {
                            type: type,
                            text: `${template.text}${instructionText}`,
                            points: type === 'alternativas' || type === 'verdadero_falso' ? 2 : (type === 'pareados' ? 3 : 1),
                            correctAnswer: template.correctAnswer || ''
                        };

                        if (type === 'alternativas') {
                            questionObj.options = [...template.options];
                        } else if (type === 'verdadero_falso') {
                            questionObj.justify = template.justify;
                        } else if (type === 'pareados') {
                            questionObj.matchingPairs = template.matchingPairs.map(p => ({ ...p }));
                        }

                        generated.push(questionObj);
                    }
                });

                loadQuestionsIntoState(generated);
                alert(`[Simulación del Navegador] ¡Evaluación generada con éxito!
-------------------------------------------------------------------
Se procesaron los contadores de tipo. Generados exactamente:
${quantities.abierta} Abiertas, ${quantities.alternativas} Alternativas, ${quantities.verdadero_falso} V/F, ${quantities.pareados} Pareados y ${quantities.completacion} Completación.
Usando el contenido simulado del archivo "${file.name}".`);
            }, 1500);
        } finally {
            setTimeout(() => {
                btnGenerateIA.disabled = false;
                iaLoadingSpinner.style.display = 'none';
            }, 1500);
        }
    });

    function loadQuestionsIntoState(rawQuestions) {
        const isRubricMode = evalMatrix.value === 'rubrica' || evalMatrix.value === 'escala_apreciacion';
        questions = rawQuestions.map(q => {
            const mapped = {
                id: q.id || Math.random().toString(36).substring(2, 9),
                type: isRubricMode ? 'rubric_row' : (q.type || 'abierta'),
                text: q.text || '',
                topic: q.topic || '',
                points: q.points || 2,
                imageUrl: q.imageUrl || null,
                imageName: q.imageName || '',
                options: q.options ? [...q.options] : ['', '', '', ''],
                justify: q.justify !== undefined ? q.justify : false,
                matchingPairs: q.matchingPairs ? q.matchingPairs.map(p => ({ ...p })) : [
                    { colA: '', colB: '' },
                    { colA: '', colB: '' },
                    { colA: '', colB: '' }
                ],
                correctAnswer: q.correctAnswer || (q.type === 'alternativas' ? 'A' : (q.type === 'verdadero_falso' ? 'V' : ''))
            };
            if (q.criterio !== undefined) mapped.criterio = q.criterio;
            if (q.niveles !== undefined) mapped.niveles = { ...q.niveles };
            if (q.factor !== undefined) mapped.factor = q.factor;
            else if (isRubricMode && evalMatrix.value === 'rubrica') mapped.factor = 1;
            if (q.indicadores !== undefined) mapped.indicadores = [...q.indicadores];
            return mapped;
        });
        renderQuestions();
    }

    // --- Dynamic Questions Editor & A4 Renderer ---
    btnAddQuestion.addEventListener('click', () => {
        const id = Date.now().toString();
        questions.push({
            id,
            type: 'abierta',
            text: '',
            topic: '',
            points: 2,
            imageUrl: null,
            imageName: '',
            options: ['', '', '', ''],
            justify: false,
            matchingPairs: [
                { colA: '', colB: '' },
                { colA: '', colB: '' },
                { colA: '', colB: '' }
            ],
            correctAnswer: ''
        });
        
        renderQuestions();
    });

    // Lógica para regenerar un ítem unitario con IA
    async function regenerateItemWithIA(qId, btnEl) {
        const qIndex = questions.findIndex(q => q.id === qId);
        if (qIndex === -1) return;

        const q = questions[qIndex];
        const file = materiaUpload.files[0];
        const topicVal = q.topic ? q.topic.trim() : 'Contenido general';

        btnEl.disabled = true;
        btnEl.textContent = '✨ Generando...';

        const formData = new FormData();
        if (file) {
            formData.append('materia', file);
        }
        formData.append('subject', currentSubject);
        formData.append('level', evalLevel.value);
        formData.append('matrixType', evalMatrix.value);
        formData.append('type', q.type);
        formData.append('topic', topicVal);

        const session = await getCurrentSession();
        if (!session) {
            alert('Debes iniciar sesión para usar el generador.');
            window.location.href = 'auth.html';
            return;
        }

        try {
            const response = await fetch('/api/regenerate-item', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: formData
            });

            if (!response.ok) throw new Error('Error al conectar');

            const data = await response.json();
            if (data.success && data.question) {
                const newQ = data.question;
                q.text = newQ.text;
                q.points = newQ.points || q.points;
                if (newQ.options) q.options = [...newQ.options];
                if (newQ.justify !== undefined) q.justify = newQ.justify;
                if (newQ.matchingPairs) q.matchingPairs = newQ.matchingPairs.map(p => ({ ...p }));
                
                renderQuestions();
                alert(`[Servidor Local] Ítem ${qIndex + 1} regenerado con IA enfocándose en "${topicVal}".`);
            } else {
                throw new Error('Estructura incorrecta');
            }

        } catch (error) {
            console.warn('El servidor no respondió. Simulando regeneración local del ítem...', error);
            
            setTimeout(() => {
                const docName = file ? file.name : 'Materia Manual';
                
                const fallbackDb = {
                    'abierta': `Explica detalladamente la importancia de "${topicVal}" analizando las fuentes leídas de ${docName}.`,
                    'alternativas': {
                        text: `¿Cuál de las siguientes afirmaciones describe de forma precisa el concepto de "${topicVal}"?`,
                        options: [`Definición principal del concepto ${topicVal}`, `Elemento complementario de ${topicVal}`, `Factor de distracción secundaria`, `Ninguna de las opciones anteriores`]
                    },
                    'verdadero_falso': {
                        text: `El concepto de "${topicVal}" generó importantes controversias en la sociedad de la época colonial.`,
                        justify: true
                    },
                    'pareados': {
                        text: `Relaciona los conceptos principales asociados a "${topicVal}" con su hito respectivo.`,
                        matchingPairs: [
                            { colA: `${topicVal} (Pre-fase)`, colB: `Contexto previo a la aparición de ${topicVal}.` },
                            { colA: `${topicVal} (Fase de auge)`, colB: `Hito de mayor representatividad.` },
                            { colA: `${topicVal} (Post-fase)`, colB: `Efectos históricos/científicos posteriores.` }
                        ]
                    },
                    'completacion': `La teoría principal que fundamenta la materia de "${topicVal}" se resume en que la _____ es fundamental.`
                };

                const template = fallbackDb[q.type] || fallbackDb['abierta'];

                if (q.type === 'alternativas') {
                    q.text = template.text;
                    q.options = [...template.options];
                } else if (q.type === 'verdadero_falso') {
                    q.text = template.text;
                    q.justify = template.justify;
                } else if (q.type === 'pareados') {
                    q.text = template.text;
                    q.matchingPairs = template.matchingPairs.map(p => ({ ...p }));
                } else if (q.type === 'completacion') {
                    q.text = template;
                } else {
                    q.text = template;
                }

                renderQuestions();
                alert(`[Simulación del Navegador] Ítem ${qIndex + 1} regenerado con éxito!
-------------------------------------------------------------------
La IA simulada leyó el documento "${docName}" y generó una nueva pregunta de tipo "${q.type}" enfocándose en el tema: "${topicVal}".`);
            }, 1000);
        } finally {
            setTimeout(() => {
                btnEl.disabled = false;
                btnEl.textContent = '✨ Regenerar con IA';
            }, 1000);
        }
    }

    function getSectionPointsText(qList) {
        if (qList.length === 0) return '0 puntos';
        const firstPoints = parseInt(qList[0].points) || 0;
        const allSame = qList.every(q => (parseInt(q.points) || 0) === firstPoints);
        if (allSame) {
            return `${firstPoints} punto${firstPoints !== 1 ? 's' : ''}`;
        } else {
            return 'el puntaje indicado en cada ítem';
        }
    }

    function renderQuestions() {
        questionsList.innerHTML = '';
        
        if (questions.length === 0) {
            previewQuestions.innerHTML = '<p class="empty-questions-notice">Aún no has cargado materia para generar preguntas. Sube un archivo arriba y presiona "Generar Preguntas con IA".</p>';
            previewTotalPoints.textContent = '0';
            return;
        }

        let totalPoints = 0;
        previewQuestions.innerHTML = '';

        // Render principal image at top if present
        if (principalImage) {
            const div = document.createElement('div');
            div.style.textAlign = 'center';
            div.style.marginBottom = '1rem';
            div.innerHTML = `<img src="${principalImage}" style="max-width: 100%; max-height: 160px; border-radius: 4px; border: 1px solid var(--border);" />`;
            previewQuestions.appendChild(div);
        }

        // Render other resources list in annex box if present
        const resourcesToRender = [
            { name: 'Apoyo Visual General', img: apoyoGenImage },
            { name: 'Recurso 1', img: recurso1Image },
            { name: 'Recurso 2', img: recurso2Image },
            { name: 'Recurso 3', img: recurso3Image },
            { name: 'Imagen para Análisis', img: analisisImage },
            { name: 'Gráfico / Fuente', img: graficoImage }
        ].filter(r => r.img !== null);

        if (resourcesToRender.length > 0) {
            const resourcesDiv = document.createElement('div');
            resourcesDiv.style.marginBottom = '1.25rem';
            resourcesDiv.style.border = '1px solid #000';
            resourcesDiv.style.padding = '8px';
            resourcesDiv.style.borderRadius = '4px';
            resourcesDiv.style.backgroundColor = '#fafafa';
            
            let innerHTML = `<div style="text-align: center; font-weight: bold; border-bottom: 1px dashed #666; padding-bottom: 4px; margin-bottom: 8px; font-size: 8pt; color: #000;">MATERIAL DE APOYO Y RECURSOS</div>`;
            innerHTML += `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px;">`;
            
            resourcesToRender.forEach(r => {
                innerHTML += `
                    <div style="text-align: center; border: 1px solid #ccc; padding: 4px; background: white; border-radius: 4px;">
                        <span style="font-size: 7pt; font-weight: bold; display: block; margin-bottom: 2px; color: #000;">${r.name}</span>
                        <img src="${r.img}" style="max-width: 100%; max-height: 90px; object-fit: contain;" />
                    </div>
                `;
            });
            innerHTML += `</div>`;
            resourcesDiv.innerHTML = innerHTML;
            previewQuestions.appendChild(resourcesDiv);
        }

        const isRubric = evalMatrix.value === 'rubrica' || evalMatrix.value === 'escala_apreciacion';
        if (isRubric && questions.length > 0 && questions[0].type === 'rubric_row') {
            renderRubricPreview();
            return;
        }

        // Render editor items
        questions.forEach((q, index) => {
            totalPoints += parseInt(q.points) || 0;

            const qItem = document.createElement('div');
            qItem.className = 'question-item';
            
            let typeSpecificFormHTML = '';
            
            if (q.type === 'abierta') {
                typeSpecificFormHTML = `
                    <div style="margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.25rem;">
                        <label style="font-size: 0.7rem; font-weight: 600; color: var(--text-muted);">Respuesta Esperada / Criterios de Corrección</label>
                        <textarea class="form-control correct-answer-input" rows="2" placeholder="Ej. El alumno debe mencionar la escasez de recursos..." style="font-size: 0.75rem; resize: none;">${q.correctAnswer || ''}</textarea>
                    </div>
                `;
            } else if (q.type === 'alternativas') {
                typeSpecificFormHTML = `
                    <div class="item-options-editor">
                        <div class="option-edit-row"><span>A)</span><input type="text" class="form-control opt-input" data-index="0" placeholder="Opción A" value="${q.options[0]}"></div>
                        <div class="option-edit-row"><span>B)</span><input type="text" class="form-control opt-input" data-index="1" placeholder="Opción B" value="${q.options[1]}"></div>
                        <div class="option-edit-row"><span>C)</span><input type="text" class="form-control opt-input" data-index="2" placeholder="Opción C" value="${q.options[2]}"></div>
                        <div class="option-edit-row"><span>D)</span><input type="text" class="form-control opt-input" data-index="3" placeholder="Opción D" value="${q.options[3]}"></div>
                    </div>
                    <div style="margin-top: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                        <label style="font-size: 0.7rem; font-weight: 600; color: var(--text-muted); margin-bottom: 0;">Opción Correcta:</label>
                        <select class="form-control correct-answer-select" style="width: 80px; min-height: auto; padding: 0.25rem 0.5rem; height: 28px; font-size: 0.75rem;">
                            <option value="A" ${q.correctAnswer === 'A' ? 'selected' : ''}>A</option>
                            <option value="B" ${q.correctAnswer === 'B' ? 'selected' : ''}>B</option>
                            <option value="C" ${q.correctAnswer === 'C' ? 'selected' : ''}>C</option>
                            <option value="D" ${q.correctAnswer === 'D' ? 'selected' : ''}>D</option>
                        </select>
                    </div>
                `;
            } else if (q.type === 'verdadero_falso') {
                typeSpecificFormHTML = `
                    <div style="margin-top: 0.5rem; display: flex; align-items: center; gap: 1rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem;">
                            <input type="checkbox" id="justify-${q.id}" class="justify-checkbox" ${q.justify ? 'checked' : ''}>
                            <label for="justify-${q.id}" style="font-size: 0.7rem; font-weight: 600; color: var(--text-muted);">Justificar si es falsa</label>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <label style="font-size: 0.7rem; font-weight: 600; color: var(--text-muted); margin-bottom: 0;">Respuesta:</label>
                            <select class="form-control correct-answer-select" style="width: 80px; min-height: auto; padding: 0.25rem 0.5rem; height: 28px; font-size: 0.75rem;">
                                <option value="V" ${q.correctAnswer === 'V' ? 'selected' : ''}>V</option>
                                <option value="F" ${q.correctAnswer === 'F' ? 'selected' : ''}>F</option>
                            </select>
                        </div>
                    </div>
                `;
            } else if (q.type === 'pareados') {
                typeSpecificFormHTML = `
                    <div class="matching-pairs-editor">
                        <span style="font-size: 0.75rem; font-weight: bold; color: var(--text-muted);">Pares Columna A - Columna B (Clave Correcta)</span>
                        <div class="matching-pair-row">
                            <input type="text" class="form-control match-a" data-index="0" placeholder="Concepto A1" value="${q.matchingPairs[0].colA}">
                            <input type="text" class="form-control match-b" data-index="0" placeholder="Definición B1" value="${q.matchingPairs[0].colB}">
                        </div>
                        <div class="matching-pair-row">
                            <input type="text" class="form-control match-a" data-index="1" placeholder="Concepto A2" value="${q.matchingPairs[1].colA}">
                            <input type="text" class="form-control match-b" data-index="1" placeholder="Definición B2" value="${q.matchingPairs[1].colB}">
                        </div>
                        <div class="matching-pair-row">
                            <input type="text" class="form-control match-a" data-index="2" placeholder="Concepto A3" value="${q.matchingPairs[2].colA}">
                            <input type="text" class="form-control match-b" data-index="2" placeholder="Definición B3" value="${q.matchingPairs[2].colB}">
                        </div>
                    </div>
                `;
            } else if (q.type === 'completacion') {
                typeSpecificFormHTML = `
                    <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.25rem;">
                        Usa guiones bajos (ej. "____") para indicar los espacios que el alumno completará.
                    </div>
                    <div style="margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.25rem;">
                        <label style="font-size: 0.7rem; font-weight: 600; color: var(--text-muted);">Palabras Correctas (Separadas por comas)</label>
                        <input type="text" class="form-control correct-answer-input" placeholder="Ej. fotosíntesis, cloroplasto" value="${q.correctAnswer || ''}" style="font-size: 0.75rem;">
                    </div>
                `;
            }

            qItem.innerHTML = `
                <div class="question-item-header">
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <strong>Ítem ${index + 1}</strong>
                        <select class="form-control question-type-select" style="min-height: auto; width: 140px;">
                            <option value="abierta" ${q.type === 'abierta' ? 'selected' : ''}>Pregunta Abierta</option>
                            <option value="alternativas" ${q.type === 'alternativas' ? 'selected' : ''}>Alternativas</option>
                            <option value="verdadero_falso" ${q.type === 'verdadero_falso' ? 'selected' : ''}>Verdadero y Falso</option>
                            <option value="pareados" ${q.type === 'pareados' ? 'selected' : ''}>Términos Pareados</option>
                            <option value="completacion" ${q.type === 'completacion' ? 'selected' : ''}>Completación</option>
                        </select>
                    </div>
                    <button class="btn-remove-question" data-id="${q.id}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                </div>
                <div class="question-row-inputs" style="margin-top: 0.5rem; display: flex; gap: 0.75rem; align-items: flex-end;">
                    <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 0.25rem;">
                        <label style="font-size: 0.7rem; font-weight: 600; color: var(--text-muted); text-align: left;">Enunciado de la Pregunta</label>
                        <input type="text" class="form-control question-text-input" placeholder="Enunciado del ítem o pregunta..." value="${q.text}">
                    </div>
                    <div style="width: 80px; display: flex; flex-direction: column; gap: 0.25rem;">
                        <label style="font-size: 0.7rem; font-weight: 600; color: var(--text-muted); text-align: left;">Puntaje</label>
                        <input type="number" class="form-control question-points-input" min="0" placeholder="Pts" value="${q.points}">
                    </div>
                </div>
                
                ${typeSpecificFormHTML}

                <!-- Discriminación de Materia por Ítem (Refinado de la IA) -->
                <div class="form-group" style="margin-top: 0.55rem; background-color: rgba(99, 102, 241, 0.03); border: 1px solid var(--border); padding: 0.5rem; border-radius: var(--radius-sm);">
                    <label style="font-size: 0.7rem; color: var(--text-muted); font-weight: 600; margin-bottom: 0.15rem;">Materia o concepto específico para este ítem:</label>
                    <div style="display: flex; gap: 0.35rem;">
                        <input type="text" class="form-control question-topic-input" placeholder="Ej. El feudalismo (deja en blanco para general)" value="${q.topic || ''}" style="font-size: 0.75rem; flex-grow: 1; height: 28px; min-height: auto; padding: 0.25rem 0.5rem;">
                        <button class="btn btn-secondary btn-regenerate-item-ia" data-id="${q.id}" style="padding: 0.25rem 0.5rem; height: 28px; font-size: 0.7rem; flex-shrink: 0; min-height: auto;" title="Regenerar esta pregunta con IA leyendo la materia">
                            ✨ Regenerar con IA
                        </button>
                    </div>
                </div>

                <!-- Apoyo Visual por Ítem -->
                <div class="item-image-uploader-box">
                    <div class="image-upload-box ${q.imageUrl ? 'has-file' : ''}" style="min-height: 38px; padding: 0.25rem;">
                        <span class="item-img-label" style="font-size: 0.7rem;">${q.imageName ? '✓ ' + q.imageName : 'Subir Apoyo Visual'}</span>
                        <input type="file" accept="image/*" class="file-input item-image-input">
                    </div>
                </div>
            `;

            // Listeners
            const typeSelect = qItem.querySelector('.question-type-select');
            typeSelect.addEventListener('change', (e) => {
                q.type = e.target.value;
                if (q.type === 'alternativas') {
                    q.correctAnswer = 'A';
                } else if (q.type === 'verdadero_falso') {
                    q.correctAnswer = 'V';
                } else {
                    q.correctAnswer = '';
                }
                renderQuestions();
            });

            const textInput = qItem.querySelector('.question-text-input');
            textInput.addEventListener('input', (e) => {
                q.text = e.target.value;
                renderQuestionsOnlyPreviews();
            });

            const pointsInput = qItem.querySelector('.question-points-input');
            pointsInput.addEventListener('input', (e) => {
                q.points = e.target.value;
                renderQuestionsOnlyPreviews();
                updateTotalPointsSum();
            });

            const topicInput = qItem.querySelector('.question-topic-input');
            topicInput.addEventListener('input', (e) => {
                q.topic = e.target.value;
            });

            const btnRegenerate = qItem.querySelector('.btn-regenerate-item-ia');
            btnRegenerate.addEventListener('click', () => {
                regenerateItemWithIA(q.id, btnRegenerate);
            });

            qItem.querySelectorAll('.opt-input').forEach(opt => {
                opt.addEventListener('input', (e) => {
                    const idx = parseInt(e.target.dataset.index);
                    q.options[idx] = e.target.value;
                    renderQuestionsOnlyPreviews();
                });
            });

            const checkboxJustify = qItem.querySelector('.justify-checkbox');
            if (checkboxJustify) {
                checkboxJustify.addEventListener('change', (e) => {
                    q.justify = e.target.checked;
                    renderQuestionsOnlyPreviews();
                });
            }

            qItem.querySelectorAll('.match-a').forEach(input => {
                input.addEventListener('input', (e) => {
                    const idx = parseInt(e.target.dataset.index);
                    q.matchingPairs[idx].colA = e.target.value;
                    renderQuestionsOnlyPreviews();
                });
            });
            qItem.querySelectorAll('.match-b').forEach(input => {
                input.addEventListener('input', (e) => {
                    const idx = parseInt(e.target.dataset.index);
                    q.matchingPairs[idx].colB = e.target.value;
                    renderQuestionsOnlyPreviews();
                });
            });

            const correctAnswerInput = qItem.querySelector('.correct-answer-input');
            if (correctAnswerInput) {
                correctAnswerInput.addEventListener('input', (e) => {
                    q.correctAnswer = e.target.value;
                    renderQuestionsOnlyPreviews();
                });
            }

            const correctAnswerSelect = qItem.querySelector('.correct-answer-select');
            if (correctAnswerSelect) {
                correctAnswerSelect.addEventListener('change', (e) => {
                    q.correctAnswer = e.target.value;
                    renderQuestions();
                });
            }

            // Image support upload by question item (Convert to Base64)
            const itemImageInput = qItem.querySelector('.item-image-input');
            itemImageInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    try {
                        q.imageUrl = await fileToBase64(file);
                        q.imageName = file.name;
                        renderQuestions();
                    } catch (err) {
                        console.error('Error al leer la imagen del ítem:', err);
                    }
                } else {
                    q.imageUrl = null;
                    q.imageName = '';
                    renderQuestions();
                }
            });

            qItem.querySelector('.btn-remove-question').addEventListener('click', () => {
                removeQuestion(q.id);
            });

            questionsList.appendChild(qItem);
        });

        // Group questions by type in A4 preview
        const grouped = {
            'verdadero_falso': [],
            'alternativas': [],
            'pareados': [],
            'completacion': [],
            'abierta': []
        };
        questions.forEach(q => {
            if (grouped[q.type]) {
                grouped[q.type].push(q);
            } else {
                grouped['abierta'].push(q);
            }
        });

        const sectionTypes = [
            { type: 'verdadero_falso', title: 'ÍTEM DE VERDADERO O FALSO', defaultInstructions: 'Lee las siguientes afirmaciones y escribe una V si es verdadera o una F si es falsa en la línea. Justifica las respuestas falsas. Cada afirmación tiene un valor de {points}.' },
            { type: 'alternativas', title: 'ÍTEM DE SELECCIÓN MÚLTIPLE', defaultInstructions: 'Lee atentamente cada pregunta y marca la alternativa correcta. Cada pregunta vale {points}.' },
            { type: 'pareados', title: 'ÍTEM DE TÉRMINOS PAREADOS', defaultInstructions: 'Asocia cada concepto de la Columna A con su definición de la Columna B. Cada par vale {points}.' },
            { type: 'completacion', title: 'ÍTEM DE COMPLETACIÓN', defaultInstructions: 'Completa los espacios en blanco con la palabra adecuada. Cada espacio vale {points}.' },
            { type: 'abierta', title: 'ÍTEM DE DESARROLLO / PREGUNTAS ABIERTAS', defaultInstructions: 'Responde detalladamente a las siguientes preguntas en el espacio asignado. Cada pregunta vale {points}.' }
        ];

        let activeSectionCount = 0;
        const romanNumerals = ['I', 'II', 'III', 'IV', 'V'];

        sectionTypes.forEach(sect => {
            const qList = grouped[sect.type];
            if (qList.length === 0) return;

            const roman = romanNumerals[activeSectionCount] || 'I';
            activeSectionCount++;

            const sectionDiv = document.createElement('div');
            sectionDiv.className = 'a4-section';
            sectionDiv.style.marginBottom = '1.5rem';

            const pointsText = getSectionPointsText(qList);
            const instructions = sect.defaultInstructions.replace('{points}', pointsText);

            sectionDiv.innerHTML = `
                <div class="a4-section-header">
                    <span>${roman}. ${sect.title}</span>
                </div>
                <div class="a4-section-instructions">${instructions}</div>
                <div class="section-questions-container" style="display: flex; flex-direction: column; gap: 0.85rem;"></div>
            `;

            const qContainer = sectionDiv.querySelector('.section-questions-container');

            qList.forEach((q, sIdx) => {
                const pItem = document.createElement('div');
                pItem.className = 'preview-question-item';
                pItem.id = `preview-q-${q.id}`;

                let imgHTML = '';
                if (q.imageUrl) {
                    imgHTML = `
                        <div class="item-visual-support">
                            <img src="${q.imageUrl}" alt="Apoyo Visual">
                        </div>
                    `;
                }

                let previewHTML = '';

                if (q.type === 'abierta') {
                    previewHTML = `
                        <div class="preview-question-header">
                            <span>${sIdx + 1}. <span class="q-text-placeholder">${q.text || '___________________________'}</span></span>
                            <span>(${q.points || 0} pts)</span>
                        </div>
                        ${imgHTML}
                        <div class="preview-question-lines">
                            <div class="preview-question-line"></div>
                            <div class="preview-question-line"></div>
                        </div>
                    `;
                    if (currentPreviewTab === 'teacher') {
                        previewHTML += `
                            <div class="preview-correct-open-criteria">
                                <strong>Pauta de Corrección:</strong> ${q.correctAnswer || 'Sin registrar respuesta esperada.'}
                            </div>
                        `;
                    }
                } else if (q.type === 'alternativas') {
                    const isCorrectA = q.correctAnswer === 'A';
                    const isCorrectB = q.correctAnswer === 'B';
                    const isCorrectC = q.correctAnswer === 'C';
                    const isCorrectD = q.correctAnswer === 'D';

                    previewHTML = `
                        <div class="preview-question-header">
                            <span>${sIdx + 1}. <span class="q-text-placeholder">${q.text || '___________________________'}</span></span>
                            <span>(${q.points || 0} pts)</span>
                        </div>
                        ${imgHTML}
                        <div class="preview-options-grid">
                            <div class="preview-option-item ${currentPreviewTab === 'teacher' && isCorrectA ? 'preview-correct-option-text' : ''}">🔘 A) ${q.options[0] || '___________'}</div>
                            <div class="preview-option-item ${currentPreviewTab === 'teacher' && isCorrectB ? 'preview-correct-option-text' : ''}">🔘 B) ${q.options[1] || '___________'}</div>
                            <div class="preview-option-item ${currentPreviewTab === 'teacher' && isCorrectC ? 'preview-correct-option-text' : ''}">🔘 C) ${q.options[2] || '___________'}</div>
                            <div class="preview-option-item ${currentPreviewTab === 'teacher' && isCorrectD ? 'preview-correct-option-text' : ''}">🔘 D) ${q.options[3] || '___________'}</div>
                        </div>
                    `;
                } else if (q.type === 'verdadero_falso') {
                    previewHTML = `
                        <div class="preview-vf-item">
                            <span class="preview-vf-line">${currentPreviewTab === 'teacher' ? (q.correctAnswer || '') : ''}</span>
                            <div class="preview-question-header" style="flex-grow: 1; border: none; padding: 0; margin: 0;">
                                <span>${sIdx + 1}. <span class="q-text-placeholder">${q.text || '___________________________'}</span></span>
                            </div>
                        </div>
                        ${imgHTML}
                        ${q.justify ? '<div class="preview-justification-line">Justificación en caso de ser falsa: ________________________________________________</div>' : ''}
                    `;
                } else if (q.type === 'pareados') {
                    const colBShuffled = q.matchingPairs
                        .map((p, idx) => ({ text: p.colB || '___________', originalIdx: idx }))
                        .sort((a, b) => a.text.localeCompare(b.text));

                    let leftColHTML = '';
                    let rightColHTML = '';

                    q.matchingPairs.forEach((pair, idx) => {
                        leftColHTML += `
                            <div class="preview-matching-item">
                                <span class="preview-matching-index">${idx + 1}.</span>
                                <span>${pair.colA || '___________'}</span>
                            </div>
                        `;
                    });

                    colBShuffled.forEach((shuffledPair) => {
                        const valueInsideParenthesis = currentPreviewTab === 'teacher' ? (shuffledPair.originalIdx + 1) : '&nbsp;';
                        const activeClass = currentPreviewTab === 'teacher' ? 'style="color: #1d4ed8; font-weight: bold;"' : '';
                        rightColHTML += `
                            <div class="preview-matching-item">
                                <span class="preview-matching-parenthesis" ${activeClass}>( &nbsp;${valueInsideParenthesis}&nbsp; )</span>
                                <span>${shuffledPair.text}</span>
                            </div>
                        `;
                    });

                    previewHTML = `
                        <div class="preview-question-header">
                            <span>${sIdx + 1}. <span class="q-text-placeholder">${q.text || 'Relaciona los conceptos de la columna A con la columna B.'}</span></span>
                            <span>(${q.points || 0} pts)</span>
                        </div>
                        ${imgHTML}
                        <div class="preview-matching-section">
                            <div class="preview-matching-column">${leftColHTML}</div>
                            <div class="preview-matching-column">${rightColHTML}</div>
                        </div>
                    `;
                    if (currentPreviewTab === 'teacher') {
                        previewHTML += `
                            <div class="preview-correct-matching-key">
                                <strong>Clave de Asociación:</strong> ${q.matchingPairs.map((pair, idx) => `${idx + 1} ➔ ${pair.colB || '?'}`).join(' | ')}
                            </div>
                        `;
                    }
                } else if (q.type === 'completacion') {
                    previewHTML = `
                        <div class="preview-question-header">
                            <span>${sIdx + 1}. Completación</span>
                            <span>(${q.points || 0} pts)</span>
                        </div>
                        ${imgHTML}
                        <div class="preview-completacion-text" style="margin-top: 0.5rem; padding-left: 0.5rem; font-style: italic;">
                            "${q.text || 'Completa la siguiente oración: El __________ es la base de __________.'}"
                        </div>
                    `;
                    if (currentPreviewTab === 'teacher') {
                        previewHTML += `
                            <div style="margin-top: 0.4rem; font-size: 0.7rem; color: #1d4ed8;">
                                <strong>Respuesta correcta:</strong> <span class="preview-correct-completion-word">${q.correctAnswer || 'Sin registrar.'}</span>
                            </div>
                        `;
                    }
                }

                pItem.innerHTML = previewHTML;
                qContainer.appendChild(pItem);
            });

            previewQuestions.appendChild(sectionDiv);
        });

        // Append Autoevaluación if checkbox is checked
        const includeAutoeval = evalIncludeAutoeval ? evalIncludeAutoeval.checked : true;
        if (includeAutoeval) {
            const autoevalDiv = document.createElement('div');
            autoevalDiv.className = 'a4-autoevaluacion';
            autoevalDiv.style.marginTop = '2rem';
            autoevalDiv.style.borderTop = '1px dashed #000000';
            autoevalDiv.style.paddingTop = '1rem';
            autoevalDiv.innerHTML = `
                <h4 style="font-size: 0.8rem; font-weight: bold; text-align: center; text-transform: uppercase; margin-bottom: 0.5rem; color: #000000;">Cuestionario de Autoevaluación</h4>
                <p style="font-size: 0.65rem; font-style: italic; margin-bottom: 0.8rem; text-align: center; color: #334155;">Marca con una X la opción que mejor represente tu desempeño durante esta evaluación:</p>
                <table style="width: 100%; border-collapse: collapse; font-size: 0.65rem; text-align: center; border: 1px solid #000000;">
                    <thead>
                        <tr style="background-color: #f1f5f9; border-bottom: 1px solid #000000;">
                            <th style="border: 1px solid #000000; padding: 5px; text-align: left; width: 55%; color: #000000;">Criterio / Indicador de Desempeño</th>
                            <th style="border: 1px solid #000000; padding: 5px; width: 15%; color: #000000;">Logrado (L)</th>
                            <th style="border: 1px solid #000000; padding: 5px; width: 15%; color: #000000;">M. Logrado (ML)</th>
                            <th style="border: 1px solid #000000; padding: 5px; width: 15%; color: #000000;">Por Lograr (PL)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="border-bottom: 1px solid #000000;">
                            <td style="border: 1px solid #000000; padding: 5px; text-align: left; color: #000000;">1. Leí atentamente todas las instrucciones y preguntas antes de responder.</td>
                            <td style="border: 1px solid #000000; padding: 5px;"></td>
                            <td style="border: 1px solid #000000; padding: 5px;"></td>
                            <td style="border: 1px solid #000000; padding: 5px;"></td>
                        </tr>
                        <tr style="border-bottom: 1px solid #000000;">
                            <td style="border: 1px solid #000000; padding: 5px; text-align: left; color: #000000;">2. Identifico con claridad los conceptos clave evaluados en esta unidad.</td>
                            <td style="border: 1px solid #000000; padding: 5px;"></td>
                            <td style="border: 1px solid #000000; padding: 5px;"></td>
                            <td style="border: 1px solid #000000; padding: 5px;"></td>
                        </tr>
                        <tr style="border-bottom: 1px solid #000000;">
                            <td style="border: 1px solid #000000; padding: 5px; text-align: left; color: #000000;">3. Me preparé adecuadamente estudiando y repasando la materia de clases.</td>
                            <td style="border: 1px solid #000000; padding: 5px;"></td>
                            <td style="border: 1px solid #000000; padding: 5px;"></td>
                            <td style="border: 1px solid #000000; padding: 5px;"></td>
                        </tr>
                        <tr style="border-bottom: 1px solid #000000;">
                            <td style="border: 1px solid #000000; padding: 5px; text-align: left; color: #000000;">4. Revisé ordenadamente mi prueba antes de entregarla al docente.</td>
                            <td style="border: 1px solid #000000; padding: 5px;"></td>
                            <td style="border: 1px solid #000000; padding: 5px;"></td>
                            <td style="border: 1px solid #000000; padding: 5px;"></td>
                        </tr>
                    </tbody>
                </table>
            `;
            previewQuestions.appendChild(autoevalDiv);
        }

        previewTotalPoints.textContent = totalPoints;
    }

    function renderRubricPreview() {
        questionsList.innerHTML = '<div style="padding: 1rem; color: var(--text-muted); font-size: 0.8rem; text-align: center; border: 1px dashed var(--border); border-radius: var(--radius-md);">Los criterios se han generado. Puedes verlos en la Vista Previa y descargarlos en Word.<br><br><em>(La edición manual interactiva estará disponible en una futura actualización).</em></div>';
        
        const isEscala = evalMatrix.value === 'escala_apreciacion';
        const matrixTitle = isEscala ? 'Escala de Apreciación' : 'Rúbrica de Evaluación';
        const activityTitle = evalActivity.options[evalActivity.selectedIndex].text;
        
        let html = `
            <div style="margin-bottom: 1.5rem; text-align: center;">
                <h3 style="font-size: 1.1rem; font-weight: bold; margin-bottom: 0.25rem;">${matrixTitle}</h3>
                <h4 style="font-size: 0.9rem; font-weight: normal;">Actividad: ${activityTitle}</h4>
            </div>
        `;
        
        if (isEscala) {
            // === ESCALA DE APRECIACIÓN: criterio + indicadores + columnas Logrado/M.Logrado/No Logrado ===
            html += '<table style="width: 100%; border-collapse: collapse; font-size: 0.75rem; text-align: left; border: 1px solid #000000; margin-bottom: 1.5rem;">';
            html += '<thead style="background-color: #f1f5f9;"><tr>';
            html += '<th style="border: 1px solid #000000; padding: 8px; color: #000; width: 15%;">Criterio</th>';
            html += '<th style="border: 1px solid #000000; padding: 8px; color: #000; width: 35%;">Indicadores de Evaluación</th>';
            html += '<th style="border: 1px solid #000000; padding: 8px; color: #000; text-align: center; width: 9%;">Logrado<br>(3 pts)</th>';
            html += '<th style="border: 1px solid #000000; padding: 8px; color: #000; text-align: center; width: 9%;">Med. logrado<br>(2 pts)</th>';
            html += '<th style="border: 1px solid #000000; padding: 8px; color: #000; text-align: center; width: 9%;">Por lograr<br>(1 pt)</th>';
            html += '<th style="border: 1px solid #000000; padding: 8px; color: #000; text-align: center; width: 9%;">No observado<br>(0 pts)</th>';
            html += '<th style="border: 1px solid #000000; padding: 8px; color: #000; text-align: center; width: 8%;">Multiplicador</th>';
            html += '<th style="border: 1px solid #000000; padding: 8px; color: #000; text-align: center; width: 8%;">Puntaje Final</th>';
            html += '</tr></thead><tbody>';

            window._escalaSelections = window._escalaSelections || {};
            window._escalaMultipliers = window._escalaMultipliers || {};

            questions.forEach((q, qIdx) => {
                const indicators = q.indicadores || [q.criterio];
                const numRows = indicators.length;
                
                indicators.forEach((ind, indIdx) => {
                    const rowKey = `${qIdx}-${indIdx}`;
                    
                    if (window._escalaMultipliers[rowKey] === undefined) {
                        window._escalaMultipliers[rowKey] = 1;
                    }
                    
                    const selectedPoints = window._escalaSelections[rowKey] !== undefined ? window._escalaSelections[rowKey] : null;
                    const mult = window._escalaMultipliers[rowKey];
                    const finalScoreStr = selectedPoints !== null ? `${selectedPoints * mult} / ${3 * mult}` : `0 / ${3 * mult}`;

                    html += `<tr>`;
                    
                    if (indIdx === 0) {
                        html += `<td rowspan="${numRows}" style="border: 1px solid #000000; padding: 8px; vertical-align: top; color: #000; font-weight: bold; background: #fafafa;">${q.criterio}</td>`;
                    }
                    
                    html += `<td style="border: 1px solid #000000; padding: 8px; vertical-align: top; color: #333;">${ind}</td>`;
                    
                    const ptsValues = [3, 2, 1, 0];
                    ptsValues.forEach(pts => {
                        const isChecked = selectedPoints === pts ? 'checked' : '';
                        html += `
                        <td style="border: 1px solid #000000; padding: 8px; text-align: center; vertical-align: middle;">
                            <input type="radio" name="escala-row-${qIdx}-${indIdx}" value="${pts}" ${isChecked} 
                                   onchange="window._escalaSelections['${rowKey}']=parseInt(this.value); window._updateEscalaScores();" 
                                   style="cursor: pointer; width: 14px; height: 14px;">
                        </td>`;
                    });
                    
                    html += `
                    <td style="border: 1px solid #000000; padding: 4px; text-align: center; vertical-align: middle;">
                        <select onchange="window._escalaMultipliers['${rowKey}']=parseInt(this.value); window._updateEscalaScores();" 
                                style="font-size: 0.72rem; padding: 2px; border-radius: 4px; border: 1px solid #ccc; background: #fff; width: 52px; cursor: pointer;">
                            <option value="1" ${mult === 1 ? 'selected' : ''}>x1</option>
                            <option value="2" ${mult === 2 ? 'selected' : ''}>x2</option>
                            <option value="3" ${mult === 3 ? 'selected' : ''}>x3</option>
                        </select>
                    </td>`;
                    
                    html += `<td id="escala-score-cell-${rowKey}" style="border: 1px solid #000000; padding: 8px; text-align: center; vertical-align: middle; font-weight: bold; color: #000;">${finalScoreStr}</td>`;
                    html += `</tr>`;
                });
            });

            html += '</tbody></table>';

            html += `
            <div id="escala-summary-block" style="margin-top: 1rem; padding: 1rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; max-width: 320px; margin-left: auto;">
                <h4 style="font-size: 0.85rem; font-weight: bold; margin-bottom: 0.5rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; color: #0f172a;">Resumen de Puntajes</h4>
                <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 4px; color: #334155;">
                    <span>Puntaje Ideal Total:</span>
                    <strong id="escala-ideal-total-val">0 pts</strong>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 4px; color: #334155;">
                    <span>Puntaje Obtenido:</span>
                    <strong id="escala-obtenido-total-val">0 pts</strong>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.75rem; border-top: 1px dashed #cbd5e1; padding-top: 4px; margin-top: 4px; color: #0f172a;">
                    <span>Porcentaje de Logro:</span>
                    <strong id="escala-logro-porcentaje-val">0%</strong>
                </div>
            </div>
            `;

            window._updateEscalaScores = function() {
                let totalIdeal = 0;
                let totalObtenido = 0;
                
                questions.forEach((q, qIdx) => {
                    const indicators = q.indicadores || [q.criterio];
                    indicators.forEach((ind, indIdx) => {
                        const rowKey = `${qIdx}-${indIdx}`;
                        const mult = window._escalaMultipliers[rowKey] || 1;
                        const selectedPoints = window._escalaSelections[rowKey] !== undefined ? window._escalaSelections[rowKey] : 0;
                        
                        totalIdeal += 3 * mult;
                        totalObtenido += selectedPoints * mult;
                        
                        const cell = document.getElementById(`escala-score-cell-${rowKey}`);
                        if (cell) {
                            cell.textContent = `${selectedPoints * mult} / ${3 * mult}`;
                        }
                    });
                });
                
                const idealValEl = document.getElementById('escala-ideal-total-val');
                const obtenidoValEl = document.getElementById('escala-obtenido-total-val');
                const logroEl = document.getElementById('escala-logro-porcentaje-val');
                
                if (idealValEl) idealValEl.textContent = `${totalIdeal} pts`;
                if (obtenidoValEl) obtenidoValEl.textContent = `${totalObtenido} pts`;
                
                const percentage = totalIdeal > 0 ? Math.round((totalObtenido / totalIdeal) * 100) : 0;
                if (logroEl) logroEl.textContent = `${percentage}%`;

                if (previewTotalPoints) {
                    previewTotalPoints.textContent = totalIdeal;
                }
            };

            setTimeout(() => {
                if (window._updateEscalaScores) window._updateEscalaScores();
            }, 0);

        } else {
            // === RÚBRICA: criterio + niveles + columna Factor ===
            const levels = questions[0].niveles ? Object.keys(questions[0].niveles) : [];
            html += '<table style="width: 100%; border-collapse: collapse; font-size: 0.75rem; text-align: left; border: 1px solid #000000; margin-bottom: 1.5rem;">';
            html += '<thead style="background-color: #f1f5f9;"><tr>';
            html += '<th style="border: 1px solid #000000; padding: 8px; color: #000; width: 18%;">Criterio</th>';
            levels.forEach(lvl => {
                html += `<th style="border: 1px solid #000000; padding: 8px; color: #000;">${lvl}</th>`;
            });
            html += '<th style="border: 1px solid #000000; padding: 8px; color: #000; text-align: center; width: 9%;">Factor</th>';
            html += '</tr></thead><tbody>';

            questions.forEach((q, idx) => {
                html += `<tr><td style="border: 1px solid #000000; padding: 8px; font-weight: bold; color: #000; vertical-align: top;">${q.criterio}</td>`;
                levels.forEach(lvl => {
                    html += `<td style="border: 1px solid #000000; padding: 8px; color: #333; vertical-align: top;">${q.niveles[lvl] || ''}</td>`;
                });
                const factor = q.factor !== undefined ? q.factor : 1;
                html += `<td style="border: 1px solid #000000; padding: 4px; text-align: center; vertical-align: middle;">
                    <select id="factor-q-${q.id || idx}" onchange="window._rubricFactors=window._rubricFactors||{}; window._rubricFactors['${q.id || idx}']=parseInt(this.value);" style="font-size: 0.72rem; padding: 2px; border-radius: 4px; border: 1px solid #ccc; background: #fff; width: 52px;">
                        <option value="1" ${factor===1?'selected':''}>x1</option>
                        <option value="2" ${factor===2?'selected':''}>x2</option>
                        <option value="3" ${factor===3?'selected':''}>x3</option>
                    </select>
                </td>`;
                html += '</tr>';
            });

            html += '</tbody></table>';
            html += '<p style="font-size: 0.7rem; color: #555; font-style: italic; text-align: center;">💡 El Factor multiplica el puntaje de ese criterio para ponderar su importancia en la evaluación final.</p>';
        }
        
        previewQuestions.innerHTML = html;
        if (!isEscala) {
            previewTotalPoints.textContent = '-';
        }
    }

    function renderQuestionsOnlyPreviews() {
        questions.forEach((q, index) => {
            const pItem = document.getElementById(`preview-q-${q.id}`);
            if (!pItem) return;

            if (q.type === 'abierta' || q.type === 'alternativas' || q.type === 'pareados') {
                const placeholder = pItem.querySelector('.q-text-placeholder');
                if (placeholder) {
                    placeholder.textContent = q.text || (q.type === 'pareados' ? 'Relaciona los conceptos de la columna A con la columna B.' : '___________________________');
                }
            } else if (q.type === 'verdadero_falso') {
                const placeholder = pItem.querySelector('.q-text-placeholder');
                if (placeholder) {
                    placeholder.textContent = q.text || '___________________________';
                }
            } else if (q.type === 'completacion') {
                const placeholder = pItem.querySelector('.preview-completacion-text');
                if (placeholder) {
                    placeholder.textContent = `"${q.text || 'Completa la siguiente oración: ___________________________'}"`;
                }
            }

            // Real-time correct answer updates for open questions and completion fields
            if (q.type === 'abierta') {
                const openCriteriaEl = pItem.querySelector('.preview-correct-open-criteria');
                if (openCriteriaEl) {
                    openCriteriaEl.innerHTML = `<strong>Pauta de Corrección:</strong> ${q.correctAnswer || 'Sin registrar respuesta esperada.'}`;
                }
            }

            if (q.type === 'completacion') {
                const compCorrectEl = pItem.querySelector('.preview-correct-completion-word');
                if (compCorrectEl) {
                    compCorrectEl.textContent = q.correctAnswer || 'Sin registrar.';
                }
            }

            const pointsEl = pItem.querySelector('.preview-question-header span:last-child');
            if (pointsEl) {
                pointsEl.textContent = `(${q.points || 0} pts)`;
            }

            if (q.type === 'alternativas') {
                const optionsElements = pItem.querySelectorAll('.preview-option-item');
                if (optionsElements.length === 4) {
                    optionsElements[0].textContent = `🔘 A) ${q.options[0] || '___________'}`;
                    optionsElements[1].textContent = `🔘 B) ${q.options[1] || '___________'}`;
                    optionsElements[2].textContent = `🔘 C) ${q.options[2] || '___________'}`;
                    optionsElements[3].textContent = `🔘 D) ${q.options[3] || '___________'}`;
                }
            }

            if (q.type === 'pareados') {
                const matchItems = pItem.querySelectorAll('.preview-matching-column:first-child .preview-matching-item');
                q.matchingPairs.forEach((pair, idx) => {
                    if (matchItems[idx]) {
                        matchItems[idx].querySelector('span:last-child').textContent = pair.colA || '___________';
                    }
                });
                
                const matchBItems = pItem.querySelectorAll('.preview-matching-column:last-child .preview-matching-item');
                const colBShuffled = q.matchingPairs
                    .map((p, idx) => ({ text: p.colB || '___________', originalIdx: idx }))
                    .sort((a, b) => a.text.localeCompare(b.text));

                colBShuffled.forEach((shuffledPair, idx) => {
                    if (matchBItems[idx]) {
                        matchBItems[idx].querySelector('span:last-child').textContent = shuffledPair.text;
                    }
                });
            }
        });
    }

    function updateTotalPointsSum() {
        let total = 0;
        questions.forEach(q => {
            total += parseInt(q.points) || 0;
        });
        previewTotalPoints.textContent = total;
    }

    // --- Action Listeners ---
    btnDashboard.addEventListener('click', (e) => {
        e.preventDefault();
        showDashboard();
    });

    btnNuevaEvaluacion.addEventListener('click', (e) => {
        e.preventDefault();
        showCreator('General');
    });

    btnVolver.addEventListener('click', () => {
        showDashboard();
    });

    // --- Initialization and Event Listeners ---
    if (subjectSelector && otraSubjectContainer) {
        subjectSelector.addEventListener('change', (e) => {
            if (e.target.value === 'Otra') {
                otraSubjectContainer.style.display = 'block';
            } else {
                otraSubjectContainer.style.display = 'none';
            }
        });
    }

    if (btnStartEvaluation) {
        btnStartEvaluation.addEventListener('click', () => {
            let selected = subjectSelector.value;
            if (selected === 'Otra') {
                selected = subjectOtraInput.value.trim() || 'General';
            }
            showCreator(selected);
        });
    }

    const btnDescargarWordNav = document.getElementById('btn-descargar-word-nav');
    if (btnDescargarWordNav) {
        btnDescargarWordNav.addEventListener('click', (e) => {
            e.preventDefault();
            btnGenerate.click();
        });
    }

    // Preview tab toggling
    const tabStudent = document.getElementById('tab-student');
    const tabTeacher = document.getElementById('tab-teacher');

    if (tabStudent && tabTeacher) {
        tabStudent.addEventListener('click', () => {
            currentPreviewTab = 'student';
            tabStudent.classList.add('active');
            tabTeacher.classList.remove('active');
            renderQuestions();
        });

        tabTeacher.addEventListener('click', () => {
            currentPreviewTab = 'teacher';
            tabTeacher.classList.add('active');
            tabStudent.classList.remove('active');
            renderQuestions();
        });
    }

    // --- WORD DOCUMENT (.DOC) DOWNLOAD GENERATION ---
    btnGenerate.addEventListener('click', () => {
        const matrixValue = evalMatrix.value;
        const matrixText = evalMatrix.options[evalMatrix.selectedIndex].text;
        
        if (questions.length === 0) {
            alert('Por favor, agrega o genera al menos una pregunta antes de exportar a Word.');
            return;
        }

        // 1. Build Insignia HTML part
        let docInsigniaHTML = '';
        if (insigniaImage) {
            docInsigniaHTML = `<img src="${insigniaImage}" width="65" height="65" style="float: left; margin-right: 15px; border-radius: 4px;" />`;
        } else {
            docInsigniaHTML = `<div style="width: 60px; height: 60px; border: 1px dashed #666666; float: left; margin-right: 15px; text-align: center; font-size: 8pt; line-height: 60px; color: #666666;">[Insignia]</div>`;
        }

        // 1b. Build Resource Images HTML parts
        let docPrincipalHTML = '';
        if (principalImage) {
            docPrincipalHTML = `
                <div style="text-align: center; margin-bottom: 15px;">
                    <img src="${principalImage}" width="380" style="width: 380px; max-width: 100%;" />
                </div>
            `;
        }

        let docResourcesHTML = '';
        const resourcesList = [
            { name: 'Apoyo Visual General', img: apoyoGenImage },
            { name: 'Recurso 1', img: recurso1Image },
            { name: 'Recurso 2', img: recurso2Image },
            { name: 'Recurso 3', img: recurso3Image },
            { name: 'Imagen para Análisis', img: analisisImage },
            { name: 'Gráfico / Fuente', img: graficoImage }
        ].filter(r => r.img !== null);

        if (resourcesList.length > 0) {
            docResourcesHTML = `
                <table style="width: 100%; border: 1px solid #000000; border-collapse: collapse; margin-bottom: 15px;" cellpadding="6">
                    <tr style="background-color: #f3f4f6;">
                        <td style="border: 1px solid #000000; text-align: center; font-weight: bold; font-size: 10pt;">RECURSOS Y MATERIAL DE APOYO</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #000000; padding: 10px;">
                            <table style="width: 100%; border: none; border-collapse: collapse;">
                                <tr>
            `;
            
            resourcesList.forEach((r, idx) => {
                if (idx > 0 && idx % 3 === 0) {
                    docResourcesHTML += `</tr><tr>`;
                }
                docResourcesHTML += `
                    <td style="text-align: center; vertical-align: top; padding: 8px; width: 33%;">
                        <p style="margin: 0 0 5px 0; font-size: 8.5pt; font-weight: bold;">${r.name}</p>
                        <img src="${r.img}" width="130" style="width: 130px; max-width: 100%;" />
                    </td>
                `;
            });

            const emptyCells = (3 - (resourcesList.length % 3)) % 3;
            for (let i = 0; i < emptyCells; i++) {
                docResourcesHTML += `<td style="width: 33%;"></td>`;
            }

            docResourcesHTML += `
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            `;
        }

        // 2. Build Questions or Rubric HTML part
        const isRubric = matrixValue === 'rubrica' || matrixValue === 'escala_apreciacion';
        let docQuestionsHTML = '';
        let docPautaHTML = '';

        if (isRubric && questions.length > 0 && questions[0].type === 'rubric_row') {
            const isEscalaExport = matrixValue === 'escala_apreciacion';
            const levels = Object.keys(questions[0].niveles || {});

            docQuestionsHTML += `
                <div style="margin-top: 15px; margin-bottom: 10px; text-align: center;">
                    <h3 style="font-size: 12pt; font-weight: bold; font-family: 'Arial', sans-serif; margin-bottom: 3px;">${matrixText}</h3>
                    <h4 style="font-size: 10.5pt; font-weight: normal; font-family: 'Arial', sans-serif; margin: 0 0 15px 0;">Actividad a evaluar: ${evalActivity.options[evalActivity.selectedIndex].text}</h4>
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 9.5pt; border: 1px solid #000000; font-family: 'Arial', sans-serif;" cellpadding="6">
                    <thead>
                        <tr style="background-color: #f3f4f6;">
            `;

            if (isEscalaExport) {
                docQuestionsHTML += `
                    <th style="border: 1px solid #000000; text-align: left; font-weight: bold; width: 15%; color: #000000;">Criterio</th>
                    <th style="border: 1px solid #000000; text-align: left; font-weight: bold; width: 45%; color: #000000;">Criterio de evaluación / Indicadores</th>
                    <th style="border: 1px solid #000000; text-align: center; font-weight: bold; width: 8%; color: #000000;">Logrado<br>(3 pts)</th>
                    <th style="border: 1px solid #000000; text-align: center; font-weight: bold; width: 8%; color: #000000;">Med. logrado<br>(2 pts)</th>
                    <th style="border: 1px solid #000000; text-align: center; font-weight: bold; width: 8%; color: #000000;">Por lograr<br>(1 pt)</th>
                    <th style="border: 1px solid #000000; text-align: center; font-weight: bold; width: 8%; color: #000000;">No observado<br>(0 pts)</th>
                    <th style="border: 1px solid #000000; text-align: center; font-weight: bold; width: 8%; color: #000000;">Multiplicador</th>
                    <th style="border: 1px solid #000000; text-align: center; font-weight: bold; width: 8%; color: #000000;">Puntaje Final</th>
                `;
            } else {
                docQuestionsHTML += `<th style="border: 1px solid #000000; text-align: left; font-weight: bold; width: 18%; color: #000000;">Criterio</th>`;
                levels.forEach(lvl => {
                    docQuestionsHTML += `<th style="border: 1px solid #000000; text-align: center; font-weight: bold; color: #000000;">${lvl}</th>`;
                });
                docQuestionsHTML += `<th style="border: 1px solid #000000; text-align: center; font-weight: bold; color: #000000; width: 8%;">Factor</th>`;
            }

            docQuestionsHTML += `
                        </tr>
                    </thead>
                    <tbody>
            `;

            let totalIdealScore = 0;

            questions.forEach((q, qIdx) => {
                if (isEscalaExport) {
                    const indicators = q.indicadores || [q.criterio];
                    const numRows = indicators.length;
                    
                    indicators.forEach((ind, indIdx) => {
                        const rowKey = `${qIdx}-${indIdx}`;
                        const mult = (window._escalaMultipliers && window._escalaMultipliers[rowKey]) || 1;
                        totalIdealScore += 3 * mult;

                        docQuestionsHTML += `<tr>`;
                        if (indIdx === 0) {
                            docQuestionsHTML += `<td rowspan="${numRows}" style="border: 1px solid #000000; font-weight: bold; vertical-align: top; color: #000000; background-color: #fafafa; font-size: 8.5pt; width: 15%;">${q.criterio || ''}</td>`;
                        }
                        docQuestionsHTML += `
                            <td style="border: 1px solid #000000; vertical-align: top; color: #333333; font-size: 8.5pt; width: 45%;">${ind}</td>
                            <td style="border: 1px solid #000000; text-align: center; vertical-align: middle; font-size: 13pt; width: 8%;">☐</td>
                            <td style="border: 1px solid #000000; text-align: center; vertical-align: middle; font-size: 13pt; width: 8%;">☐</td>
                            <td style="border: 1px solid #000000; text-align: center; vertical-align: middle; font-size: 13pt; width: 8%;">☐</td>
                            <td style="border: 1px solid #000000; text-align: center; vertical-align: middle; font-size: 13pt; width: 8%;">☐</td>
                            <td style="border: 1px solid #000000; text-align: center; vertical-align: middle; font-weight: bold; font-size: 9pt; width: 8%;">x${mult}</td>
                            <td style="border: 1px solid #000000; text-align: center; vertical-align: middle; font-size: 9pt; color: #666666; width: 8%;">______ / ${3 * mult}</td>
                        </tr>`;
                    });
                } else {
                    const qFactor = (window._rubricFactors && window._rubricFactors[q.id]) || q.factor || 1;
                    docQuestionsHTML += `
                        <tr>
                            <td style="border: 1px solid #000000; font-weight: bold; vertical-align: top; color: #000000;">${q.criterio || ''}</td>
                    `;
                    levels.forEach(lvl => {
                        const desc = (q.niveles && q.niveles[lvl]) ? q.niveles[lvl] : '';
                        docQuestionsHTML += `<td style="border: 1px solid #000000; vertical-align: top; font-size: 8.5pt; color: #333333;">${desc}</td>`;
                    });
                    docQuestionsHTML += `<td style="border: 1px solid #000000; text-align: center; font-weight: bold; color: #000000; font-size: 10pt;">x${qFactor}</td>`;
                    docQuestionsHTML += `</tr>`;
                }
            });

            if (isEscalaExport) {
                docQuestionsHTML += `
                    <tr style="background-color: #f3f4f6; font-weight: bold;">
                        <td colspan="2" style="border: 1px solid #000000; padding: 8px; text-align: right; font-size: 9.5pt; color: #000000;">TOTALES:</td>
                        <td colspan="4" style="border: 1px solid #000000; padding: 8px; font-size: 8.5pt; color: #555555; font-style: italic;">Puntaje final = puntaje obtenido × multiplicador</td>
                        <td style="border: 1px solid #000000; padding: 8px; text-align: center; font-size: 9.5pt; color: #000000;">Ideal:</td>
                        <td style="border: 1px solid #000000; padding: 8px; text-align: center; font-size: 9.5pt; color: #000000;">______ / ${totalIdealScore} pts</td>
                    </tr>
                `;
            }

            docQuestionsHTML += `
                    </tbody>
                </table>
            `;
            if (!isEscalaExport) {
                docQuestionsHTML += `<p style="font-family: 'Arial', sans-serif; font-size: 8.5pt; color: #555; font-style: italic; text-align: center; margin-top: 6px;">* El Factor (x1, x2, x3) multiplica el puntaje del criterio para ponderar su importancia en la evaluación final.</p>`;
            }
            docPautaHTML = `
                <div style="font-family: 'Arial', sans-serif; font-size: 10pt; font-style: italic;">
                    La pauta de corrección corresponde a la misma rúbrica/escala detallada anteriormente.
                </div>
            `;
        } else {
            const grouped = {
                'verdadero_falso': [],
                'alternativas': [],
                'pareados': [],
                'completacion': [],
                'abierta': []
            };
            questions.forEach(q => {
                if (grouped[q.type]) {
                    grouped[q.type].push(q);
                } else {
                    grouped['abierta'].push(q);
                }
            });

            const sectionTypes = [
                { type: 'verdadero_falso', title: 'ÍTEM DE VERDADERO O FALSO', defaultInstructions: 'Lee las siguientes afirmaciones y escribe una V si es verdadera o una F si es falsa en la línea. Justifica las respuestas falsas. Cada afirmación tiene un valor de {points}.' },
                { type: 'alternativas', title: 'ÍTEM DE SELECCIÓN MÚLTIPLE', defaultInstructions: 'Lee atentamente cada pregunta y marca la alternativa correcta. Cada pregunta vale {points}.' },
                { type: 'pareados', title: 'ÍTEM DE TÉRMINOS PAREADOS', defaultInstructions: 'Asocia cada concepto de la Columna A con su definición de la Columna B. Cada par vale {points}.' },
                { type: 'completacion', title: 'ÍTEM DE COMPLETACIÓN', defaultInstructions: 'Completa los espacios en blanco con la palabra adecuada. Cada espacio vale {points}.' },
                { type: 'abierta', title: 'ÍTEM DE DESARROLLO / PREGUNTAS ABIERTAS', defaultInstructions: 'Responde detalladamente a las siguientes preguntas en el espacio asignado. Cada pregunta vale {points}.' }
            ];

            let activeSectionCount = 0;
            const romanNumerals = ['I', 'II', 'III', 'IV', 'V'];

            sectionTypes.forEach(sect => {
                const qList = grouped[sect.type];
                if (qList.length === 0) return;

                const roman = romanNumerals[activeSectionCount] || 'I';
                activeSectionCount++;

                // Student section header
                const pointsText = getSectionPointsText(qList);
                const instructions = sect.defaultInstructions.replace('{points}', pointsText);

                docQuestionsHTML += `
                    <div style="margin-top: 20px; margin-bottom: 5px; border-bottom: 2px solid #000000; padding-bottom: 3px;">
                        <span style="font-size: 11pt; font-weight: bold; font-family: 'Arial', sans-serif;">${roman}. ${sect.title}</span>
                    </div>
                    <div style="font-size: 9.5pt; font-style: italic; color: #333333; margin-bottom: 12px; font-family: 'Arial', sans-serif;">
                        ${instructions}
                    </div>
                `;

                // Teacher pauta section header
                docPautaHTML += `
                    <div style="margin-top: 15px; margin-bottom: 5px; border-bottom: 1.5px solid #000000; padding-bottom: 2px;">
                        <span style="font-size: 11pt; font-weight: bold; font-family: 'Arial', sans-serif;">${roman}. ${sect.title} (Respuestas Clave)</span>
                    </div>
                `;

                qList.forEach((q, sIdx) => {
                    let imgHTML = '';
                    if (q.imageUrl) {
                        imgHTML = `<div style="text-align: center; margin: 10px 0;"><img src="${q.imageUrl}" width="220" style="width: 220px; border: 1px solid #cccccc; padding: 2px; border-radius: 4px;" /></div>`;
                    }

                    let bodyHTML = '';
                    let pautaItemHTML = '';

                    if (q.type === 'abierta') {
                        bodyHTML = `
                            <div style="margin-top: 5px; font-size: 10.5pt; font-family: 'Arial', sans-serif;">
                                <strong>${sIdx + 1}. ${q.text || '___________________________'}</strong>
                                <span style="float: right; font-weight: normal; font-size: 9.5pt;">(${q.points || 0} pts)</span>
                            </div>
                            ${imgHTML}
                            <div style="border-bottom: 1px dotted #888888; height: 25px; margin-top: 10px;"></div>
                            <div style="border-bottom: 1px dotted #888888; height: 25px; margin-top: 5px;"></div>
                        `;

                        pautaItemHTML = `
                            <div style="margin-top: 5px; font-size: 10pt; margin-bottom: 8px; font-family: 'Arial', sans-serif;">
                                <strong>${sIdx + 1}. ${q.text || 'Pregunta Abierta'}</strong> (${q.points || 0} pts)<br/>
                                <div style="margin-top: 3px; margin-left: 15px; background-color: #f3f4f6; border-left: 3px solid #6b7280; padding: 5px; font-style: italic;">
                                    <strong>Respuesta Esperada / Criterios:</strong> ${q.correctAnswer || 'No registrada por el docente.'}
                                </div>
                            </div>
                        `;
                    } else if (q.type === 'alternativas') {
                        bodyHTML = `
                            <div style="margin-top: 5px; font-size: 10.5pt; font-family: 'Arial', sans-serif;">
                                <strong>${sIdx + 1}. ${q.text || '___________________________'}</strong>
                                <span style="float: right; font-weight: normal; font-size: 9.5pt;">(${q.points || 0} pts)</span>
                            </div>
                            ${imgHTML}
                            <table style="width: 100%; margin-top: 8px; border: none;">
                                <tr style="border: none;">
                                    <td style="width: 50%; border: none; font-size: 10pt; font-family: 'Arial', sans-serif;">[  ] A) ${q.options[0] || '___________'}</td>
                                    <td style="width: 50%; border: none; font-size: 10pt; font-family: 'Arial', sans-serif;">[  ] B) ${q.options[1] || '___________'}</td>
                                </tr>
                                <tr style="border: none;">
                                    <td style="width: 50%; border: none; font-size: 10pt; font-family: 'Arial', sans-serif;">[  ] C) ${q.options[2] || '___________'}</td>
                                    <td style="width: 50%; border: none; font-size: 10pt; font-family: 'Arial', sans-serif;">[  ] D) ${q.options[3] || '___________'}</td>
                                </tr>
                            </table>
                        `;

                        const correctLetter = q.correctAnswer || 'A';
                        const correctText = q.options[['A', 'B', 'C', 'D'].indexOf(correctLetter)] || '';

                        pautaItemHTML = `
                            <div style="margin-top: 5px; font-size: 10pt; margin-bottom: 8px; font-family: 'Arial', sans-serif;">
                                <strong>${sIdx + 1}. ${q.text || 'Pregunta de alternativa'}</strong> (${q.points || 0} pts)<br/>
                                <div style="margin-left: 15px; color: #16a34a; font-weight: bold;">
                                    ✓ Alternativa Correcta: ${correctLetter}) ${correctText}
                                </div>
                            </div>
                        `;
                    } else if (q.type === 'verdadero_falso') {
                        bodyHTML = `
                            <div style="margin-top: 6px; font-size: 10.5pt; font-family: 'Arial', sans-serif;">
                                <span style="font-family: 'Courier New', monospace; font-weight: bold; margin-right: 5px;">____</span>
                                <strong>${sIdx + 1}. ${q.text || '___________________________'}</strong>
                            </div>
                            ${imgHTML}
                            ${q.justify ? `<div style="margin-top: 5px; margin-left: 35px; font-size: 9.5pt; font-style: italic; color: #555555; border-bottom: 1px dotted #888888; height: 20px;">Justificación si es falsa: </div>` : ''}
                        `;

                        const correctVal = q.correctAnswer || 'V';
                        pautaItemHTML = `
                            <div style="margin-top: 5px; font-size: 10pt; margin-bottom: 8px; font-family: 'Arial', sans-serif;">
                                <strong>${sIdx + 1}. ${q.text || 'Afirmación V/F'}</strong> (${q.points || 0} pts)<br/>
                                <div style="margin-left: 15px; color: #16a34a; font-weight: bold;">
                                    Respuesta Clave: [ ${correctVal} ]
                                </div>
                            </div>
                        `;
                    } else if (q.type === 'pareados') {
                        const colBShuffled = q.matchingPairs
                            .map((p, idx) => ({ text: p.colB || '___________', originalIdx: idx }))
                            .sort((a, b) => a.text.localeCompare(b.text));

                        let leftColHTML = '<table style="width: 100%; border: none;">';
                        let rightColHTML = '<table style="width: 100%; border: none;">';

                        q.matchingPairs.forEach((pair, idx) => {
                            leftColHTML += `<tr style="border: none;"><td style="border: none; padding: 4px; font-size: 10pt; font-family: 'Arial', sans-serif;"><strong>${idx + 1}.</strong> ${pair.colA || '___________'}</td></tr>`;
                        });
                        leftColHTML += '</table>';

                        colBShuffled.forEach((shuffledPair) => {
                            rightColHTML += `<tr style="border: none;"><td style="border: none; padding: 4px; font-size: 10pt; font-family: 'Arial', sans-serif;">( &nbsp; &nbsp; ) ${shuffledPair.text}</td></tr>`;
                        });
                        rightColHTML += '</table>';

                        bodyHTML = `
                            <div style="margin-top: 5px; font-size: 10.5pt; margin-bottom: 5px; font-family: 'Arial', sans-serif;">
                                <strong>${sIdx + 1}. ${q.text || 'Relaciona los conceptos de la columna A con la columna B.'}</strong>
                                <span style="float: right; font-weight: normal; font-size: 9.5pt;">(${q.points || 0} pts)</span>
                            </div>
                            ${imgHTML}
                            <table style="width: 100%; border: none; margin-top: 5px;">
                                <tr style="border: none;">
                                    <td style="width: 48%; border: none; vertical-align: top;">${leftColHTML}</td>
                                    <td style="width: 4%; border: none;"></td>
                                    <td style="width: 48%; border: none; vertical-align: top;">${rightColHTML}</td>
                                </tr>
                            </table>
                        `;

                        const associationKeyText = q.matchingPairs
                            .map((pair, idx) => `[ ${idx + 1} ➔ ${pair.colB || '?'} ]`)
                            .join(', ');

                        pautaItemHTML = `
                            <div style="margin-top: 5px; font-size: 10pt; margin-bottom: 8px; font-family: 'Arial', sans-serif;">
                                <strong>${sIdx + 1}. ${q.text || 'Términos Pareados'}</strong> (${q.points || 0} pts)<br/>
                                <div style="margin-left: 15px; color: #16a34a; font-weight: bold;">
                                    Clave: ${associationKeyText}
                                </div>
                            </div>
                        `;
                    } else if (q.type === 'completacion') {
                        bodyHTML = `
                            <div style="margin-top: 5px; font-size: 10.5pt; font-family: 'Arial', sans-serif;">
                                <strong>${sIdx + 1}. Completación</strong>
                                <span style="float: right; font-weight: normal; font-size: 9.5pt;">(${q.points || 0} pts)</span>
                            </div>
                            ${imgHTML}
                            <div style="margin-top: 5px; padding-left: 10px; font-style: italic; color: #111111; font-size: 10pt; font-family: 'Arial', sans-serif;">
                                "${q.text || 'Completa la oración: El __________ es la base de __________.'}"
                            </div>
                        `;

                        pautaItemHTML = `
                            <div style="margin-top: 5px; font-size: 10pt; margin-bottom: 8px; font-family: 'Arial', sans-serif;">
                                <strong>${sIdx + 1}. Completación:</strong> "${q.text || '...'}" (${q.points || 0} pts)<br/>
                                <div style="margin-left: 15px; color: #16a34a; font-weight: bold;">
                                    Respuesta correcta: ${q.correctAnswer || 'No registrada'}
                                </div>
                            </div>
                        `;
                    }

                    docQuestionsHTML += `<div style="margin-bottom: 20px;">${bodyHTML}</div>`;
                    docPautaHTML += pautaItemHTML;
                });
            });
        }

        // 3. Build Autoevaluación HTML if checked
        let docAutoevalHTML = '';
        const includeAutoeval = evalIncludeAutoeval ? evalIncludeAutoeval.checked : true;
        if (includeAutoeval) {
            docAutoevalHTML = `
                <div style="margin-top: 30px; border-top: 1px dashed #000000; padding-top: 15px; font-family: 'Arial', sans-serif;">
                    <h3 style="font-size: 11pt; font-weight: bold; text-align: center; text-transform: uppercase; margin-bottom: 5px;">Cuestionario de Autoevaluación</h3>
                    <p style="font-size: 9pt; font-style: italic; margin-bottom: 10px; text-align: center; color: #444444;">Marca con una X la opción que mejor represente tu desempeño durante esta evaluación:</p>
                    <table style="width: 100%; border-collapse: collapse; font-size: 9pt; border: 1px solid #000000;" cellpadding="5">
                        <tr style="background-color: #f3f4f6; font-weight: bold;">
                            <td style="border: 1px solid #000000; text-align: left; width: 55%;">Criterio / Indicador de Desempeño</td>
                            <td style="border: 1px solid #000000; text-align: center; width: 15%;">Logrado (L)</td>
                            <td style="border: 1px solid #000000; text-align: center; width: 15%;">M. Logrado (ML)</td>
                            <td style="border: 1px solid #000000; text-align: center; width: 15%;">Por Lograr (PL)</td>
                        </tr>
                        <tr>
                            <td style="border: 1px solid #000000; text-align: left;">1. Leí atentamente todas las instrucciones y preguntas antes de responder.</td>
                            <td style="border: 1px solid #000000; text-align: center;"></td>
                            <td style="border: 1px solid #000000; text-align: center;"></td>
                            <td style="border: 1px solid #000000; text-align: center;"></td>
                        </tr>
                        <tr>
                            <td style="border: 1px solid #000000; text-align: left;">2. Identifico con claridad los conceptos clave evaluados en esta unidad.</td>
                            <td style="border: 1px solid #000000; text-align: center;"></td>
                            <td style="border: 1px solid #000000; text-align: center;"></td>
                            <td style="border: 1px solid #000000; text-align: center;"></td>
                        </tr>
                        <tr>
                            <td style="border: 1px solid #000000; text-align: left;">3. Me preparé adecuadamente estudiando y repasando la materia de clases.</td>
                            <td style="border: 1px solid #000000; text-align: center;"></td>
                            <td style="border: 1px solid #000000; text-align: center;"></td>
                            <td style="border: 1px solid #000000; text-align: center;"></td>
                        </tr>
                        <tr>
                            <td style="border: 1px solid #000000; text-align: left;">4. Revisé ordenadamente mi prueba antes de entregarla al docente.</td>
                            <td style="border: 1px solid #000000; text-align: center;"></td>
                            <td style="border: 1px solid #000000; text-align: center;"></td>
                            <td style="border: 1px solid #000000; text-align: center;"></td>
                        </tr>
                    </table>
                </div>
            `;
        }

        // 4. Construct Word-Compatible HTML document structure (single clean header block)
        const htmlDoc = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <meta charset="utf-8">
            <title>${matrixText} de ${currentSubject}</title>
            <!--[if gte mso 9]>
            <xml>
                <w:WordDocument>
                    <w:View>Print</w:View>
                    <w:Zoom>100</w:Zoom>
                    <w:DoNotOptimizeForBrowser/>
                </w:WordDocument>
            </xml>
            <![endif]-->
            <style>
                @page Section1 {
                    size: 8.5in 11in;
                    margin: 1.5in 1.0in 1.0in 1.0in;
                    mso-header-margin: 0.5in;
                    mso-header: h1;
                }
                div.Section1 {
                    page: Section1;
                }
                body {
                    font-family: 'Arial', sans-serif;
                    font-size: 10.5pt;
                    color: #000000;
                    line-height: 1.4;
                }
                .student-info-table {
                    width: 100%;
                    border: 1px solid #000000;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                }
                .student-info-table td {
                    border: 1px solid #000000;
                    padding: 8px;
                    font-size: 9.5pt;
                }
                .evaluation-body {
                    margin-top: 10px;
                }
            </style>
        </head>
        <body>
            <!-- ENCABEZADO DE WORD (Solo se renderiza en el encabezado de página) -->
            <div style="mso-element:header" id="h1">
                <p class="MsoHeader" style="margin:0;">
                    <table style="width: 100%; border-collapse: collapse; border-bottom: 2px solid #000000; margin-bottom: 12px;" cellpadding="0" cellspacing="0">
                        <tr>
                            <!-- Columna izquierda: Insignia + Título centrado -->
                            <td style="border: none; vertical-align: middle; padding-bottom: 10px; width: 70%;">
                                <table style="border: none; border-collapse: collapse; width: 100%;" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td style="border: none; vertical-align: middle; padding-right: 12px; width: 75px;">
                                            ${docInsigniaHTML}
                                        </td>
                                        <td style="border: none; vertical-align: middle;">
                                            <p style="margin: 0 0 2px 0; font-size: 14pt; font-weight: bold; font-family: 'Arial', sans-serif;">${matrixText} de ${currentSubject}</p>
                                            <p style="margin: 0; font-size: 10pt; font-weight: bold; font-family: 'Arial', sans-serif; color: #444444;">Nivel / Curso: ${evalLevel.value}</p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                            <!-- Columna derecha: Datos del establecimiento -->
                            <td style="border: none; vertical-align: middle; text-align: right; padding-bottom: 10px; font-size: 8.5pt; font-family: 'Arial', sans-serif;">
                                <p style="margin: 2px 0;"><strong>Establecimiento:</strong> ${evalInstitucion.value.trim() || '_________________________'}</p>
                                <p style="margin: 2px 0;"><strong>Docente:</strong> ${evalDocente.value.trim() || '_________________________'}</p>
                                <p style="margin: 2px 0;"><strong>Departamento:</strong> ${evalDepto.value.trim() || '_________________________'}</p>
                            </td>
                        </tr>
                    </table>
                </p>
            </div>

            <div class="Section1">
                <!-- UNIDAD Y OBJETIVOS -->
                <table style="width: 100%; border: 1px solid #000000; border-collapse: collapse; margin-bottom: 12px;">
                    <tr style="background-color: #f3f4f6;">
                        <td style="padding: 7px 10px; font-size: 9.5pt; font-family: 'Arial', sans-serif;">
                            <p style="margin: 0 0 3px 0;"><strong>Unidad a evaluar:</strong> ${(evalUnit && evalUnit.value.trim()) ? evalUnit.value.trim() : '_________________________'}</p>
                            <p style="margin: 0;"><strong>Objetivos y/o Contenidos:</strong> ${(evalObjectives && evalObjectives.value.trim()) ? evalObjectives.value.trim() : '_________________________'}</p>
                        </td>
                    </tr>
                </table>

                <!-- DATOS DEL ESTUDIANTE -->
                <table class="student-info-table">
                    <tr>
                        <td style="width: 60%;"><strong>Nombre del Estudiante:</strong> ___________________________________________</td>
                        <td style="width: 40%;"><strong>Fecha:</strong> ____/____/2026</td>
                    </tr>
                    <tr>
                        <td><strong>Curso:</strong> ${evalLevel.value}</td>
                        <td><strong>Puntaje:</strong> ____ / ${previewTotalPoints.textContent === '-' ? '____' : previewTotalPoints.textContent} puntos totales</td>
                    </tr>
                </table>

                <!-- CONTENT -->
                <div class="evaluation-body">
                    ${docPrincipalHTML}
                    ${docResourcesHTML}
                    ${docQuestionsHTML}
                </div>

                <!-- Cuestionario de Autoevaluación -->
                ${docAutoevalHTML}

                <!-- PAGE BREAK -->
                <br clear="all" style="page-break-before:always;" />

                <!-- ANSWER KEY / PAUTA DE CORRECCIÓN -->
                <div style="margin-top: 20px; font-family: 'Arial', sans-serif;">
                    <div style="text-align: center; border-bottom: 2.5px double #000000; padding-bottom: 10px; margin-bottom: 20px;">
                        <h2 style="font-size: 14pt; font-weight: bold; margin: 0; color: #000000;">PAUTA DE CORRECCIÓN - CLAVE DE RESPUESTAS</h2>
                        <p style="font-size: 10pt; margin: 3px 0 0 0; font-weight: bold; color: #555555;">Instrumento: ${matrixText} de ${currentSubject} (${evalLevel.value})</p>
                    </div>

                    <div class="pauta-body">
                        ${docPautaHTML}
                    </div>
                </div>
            </div>
        </body>
        </html>
        `;

        // 5. Download file as .doc (compatible with MS Word)
        const blob = new Blob(['\ufeff' + htmlDoc], {
            type: 'application/msword;charset=utf-8'
        });
        const url = URL.createObjectURL(blob);
        
        const filename = `evaluacion_${currentSubject.toLowerCase()}_${evalLevel.value.replace(/\s+/g, '_')}.doc`;
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert(`¡Documento Word generado con éxito! 
Se descargará el archivo "${filename}" que podrás abrir y editar directamente en Microsoft Word. Se han incorporado los datos del docente, la insignia, la unidad, los objetivos, la autoevaluación y las respuestas correctas en el documento.`);
    });

    // --- RESPONSIVE SIDEBAR MOBILE TOGGLE ---
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebarToggleCreator = document.getElementById('sidebar-toggle-creator');
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    function toggleSidebar() {
        if (sidebar && sidebarOverlay) {
            sidebar.classList.toggle('active');
            sidebarOverlay.classList.toggle('active');
        }
    }

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }
    if (sidebarToggleCreator) {
        sidebarToggleCreator.addEventListener('click', toggleSidebar);
    }
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', toggleSidebar);
    }

    // Close sidebar when clicking any navigation link on mobile
    const sidebarNavLinks = document.querySelectorAll('.nav-menu .nav-item');
    sidebarNavLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (sidebar && sidebar.classList.contains('active')) {
                toggleSidebar();
            }
        });
    });
});

