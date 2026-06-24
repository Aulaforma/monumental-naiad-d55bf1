# Estructura del Proyecto: Constructor de Evaluaciones

## Estructura actual encontrada

```text
/
├── asignaturas/
│   ├── simbolos_matemáticos/ (2 archivos)
│   └── simbolos_musicales/ (11 archivos)
├── fondo/
│   └── fondo_principal.jpg
└── matriz/
    ├── matriz_escala_apreciacion.docx
    ├── matriz_evaluacion_escrita.docx
    └── matriz_rubrica.docx
```

## Estructura sugerida

```text
/
├── asignaturas/
│   ├── historia/
│   │   ├── imagenes_docente/
│   │   ├── recursos/
│   │   └── plantillas/
│   ├── lenguaje/
│   │   ├── imagenes_docente/
│   │   ├── recursos/
│   │   └── plantillas/
│   ├── matematicas/
│   │   ├── imagenes_docente/
│   │   ├── recursos/
│   │   └── plantillas/
│   ├── ciencias_naturales/
│   │   ├── imagenes_docente/
│   │   ├── recursos/
│   │   └── plantillas/
│   ├── simbolos_matematicos/
│   │   ├── operaciones/
│   │   ├── geometria/
│   │   ├── algebra/
│   │   ├── unidades_medida/
│   │   └── graficos/
│   └── simbolos_musicales/
│       ├── notas/
│       ├── figuras_ritmicas/
│       ├── pentagrama/
│       ├── instrumentos/
│       └── otros/
├── fondo/
└── matriz/
```

## Cambios recomendados

1. **Renombrar carpetas**: Cambiar el nombre de `matríz` a `matriz` y `simbolos_matemáticos` a `simbolos_matematicos` (¡Completado!).
2. **Crear carpetas de asignaturas**: Incorporar las carpetas `historia`, `lenguaje`, `matematicas` y `ciencias_naturales` con sus subcarpetas correspondientes.
3. **Subdividir símbolos**: Crear las subcarpetas sugeridas dentro de `simbolos_matematicos` y `simbolos_musicales`.
4. **Renombrar archivos**: Muchos archivos de imágenes tienen nombres como `descarga.jpg`, `descarga (1).jpg` o nombres muy largos y con caracteres especiales. Se recomienda estandarizar los nombres de archivo.
5. **Mover archivos**: Reubicar los archivos existentes en la estructura de carpetas sugerida, una vez aprobada y creada.

## Archivos pendientes

Faltan incorporar manualmente en la carpeta `fondo`:
* `logo.png`
* `colores_referencia.png`
* `ejemplo_diseno.png`

## Recursos visuales disponibles

* **Fondos**: `fondo_principal.jpg`
* **Música**: Diversas imágenes relacionadas a música (teclados, claves, pentagramas y niños cantando).
* **Matemáticas**: Imágenes genéricas descargadas (pendientes de revisar su contenido exacto por los nombres `descarga.jpg`).

## Matrices disponibles

* Plantilla de evaluación escrita (`matriz_evaluacion_escrita.docx`)
* Plantilla de rúbrica (`matriz_rubrica.docx`)
* Plantilla de escala de apreciación (`matriz_escala_apreciacion.docx`)

## Símbolos disponibles

Se detectaron archivos bajo la categoría de símbolos matemáticos y musicales, sin embargo, los nombres actuales de los archivos no indican de forma descriptiva qué símbolo representan (ej. `descarga.jpg`). Deben ser renombrados según su categoría y contenido (ej. operaciones, notas, etc.).

## Espacios reservados para imágenes del docente

La aplicación deberá considerar la posibilidad de que el docente cargue y utilice sus propias imágenes. Se debe documentar en el código e interfaz el espacio para:

* `imagen_principal_docente`
* `imagen_recurso_1`
* `imagen_recurso_2`
* `imagen_recurso_3`
* `imagen_apoyo_visual`
* `imagen_para_analisis`
* `imagen_grafico_o_fuente`

Estos espacios permitirán integrar a la evaluación: mapas, gráficos, fuentes históricas, imágenes científicas, fotografías, textos escaneados, ejercicios matemáticos, esquemas, imágenes de comprensión lectora, recursos visuales del libro o material propio del docente. 

La evaluación podrá generarse de distintas maneras: sin imágenes, con 1 o varias imágenes, con pie de imagen, con preguntas asociadas, y estas imágenes se incluirán directamente en el documento final (Word o PDF).

## Recomendaciones para el siguiente paso

* Revisar la estructura sugerida y dar aprobación.
* Luego de la aprobación, ejecutar un script/comando que se encargue de crear la nueva estructura de carpetas, renombrar las actuales y mover los archivos a sus ubicaciones apropiadas.
* Agregar los archivos pendientes en diseño antes de empezar el desarrollo frontend.
